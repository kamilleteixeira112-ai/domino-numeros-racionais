import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, onValue, onDisconnect, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { createDeck, shuffleDeck } from "./domino-data.js";
import { hasAnyMove, orientTile, blockedWinner } from "./game-logic.js";

let app;
let auth;
let db;
let currentUid = null;

function assertConfigured() {
  if (!isFirebaseConfigured()) throw new Error("Firebase ainda não foi configurado neste projeto.");
}

/** Inicializa Firebase e cria uma sessão anônima, sem exigir cadastro dos alunos. */
export async function initializeFirebase() {
  assertConfigured();
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
  }
  if (!auth.currentUser) await signInAnonymously(auth);
  currentUid = auth.currentUser.uid;
  return currentUid;
}

export function isOnlineBackendReady() { return isFirebaseConfigured(); }

/** Gera código curto sem caracteres visualmente ambíguos. */
export function generateRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function roomRef(code) { return ref(db, `rooms/${code}`); }

function newGameState() {
  const deck = shuffleDeck(createDeck());
  return {
    hand1: deck.slice(0, 14),
    hand2: deck.slice(14),
    table: [],
    turn: "p1",
    consecutivePasses: 0,
    moveNumber: 0,
    winner: null,
    finishReason: null
  };
}

/** Cria uma sala inédita e registra o primeiro jogador. */
export async function createRoom() {
  const uid = await initializeFirebase();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRoomCode();
    const target = roomRef(code);
    if ((await get(target)).exists()) continue;
    await set(target, {
      version: 2,
      createdAt: Date.now(),
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
      status: "waiting",
      players: { p1: { uid, name: "Jogador 1", connected: true, joinedAt: Date.now() } },
      game: newGameState()
    });
    await configurePresence(code, "p1");
    return { code, role: "p1", uid };
  }
  throw new Error("Não foi possível gerar uma sala. Tente novamente.");
}

/**
 * Entra na sala como Jogador 2 e impede um terceiro participante.
 *
 * Fazemos primeiro uma leitura explícita da sala antes da transaction.
 * O Realtime Database pode chamar a função da transaction inicialmente com
 * o cache local vazio (null). Se tratarmos esse null como "sala inexistente",
 * a operação pode ser abortada antes de o SDK consultar o servidor.
 */
export async function joinRoom(code) {
  const uid = await initializeFirebase();
  const normalized = code.trim().toUpperCase();
  const target = roomRef(normalized);

  // Pré-leitura: confirma que a sala existe no servidor e aquece o cache local.
  const initialSnapshot = await get(target);
  if (!initialSnapshot.exists()) {
    throw new Error("Sala não encontrada. Confira o código.");
  }

  const initialRoom = initialSnapshot.val();
  if (initialRoom.expiresAt && initialRoom.expiresAt < Date.now()) {
    throw new Error("Esta sala expirou.");
  }
  if (initialRoom.players?.p2?.uid &&
      initialRoom.players.p1?.uid !== uid &&
      initialRoom.players.p2?.uid !== uid) {
    throw new Error("A sala já possui dois jogadores.");
  }

  let failure = null;
  const result = await runTransaction(target, (room) => {
    if (!room) {
      failure = "A sala deixou de existir durante a entrada. Tente novamente.";
      return;
    }
    if (room.expiresAt && room.expiresAt < Date.now()) {
      failure = "Esta sala expirou.";
      return;
    }
    if (room.players?.p1?.uid === uid || room.players?.p2?.uid === uid) return room;
    if (room.players?.p2?.uid) {
      failure = "A sala já possui dois jogadores.";
      return;
    }

    room.players.p2 = {
      uid,
      name: "Jogador 2",
      connected: true,
      joinedAt: Date.now()
    };
    room.status = "playing";
    return room;
  });

  if (!result.committed) throw new Error(failure || "Não foi possível entrar na sala.");

  const room = result.snapshot.val();
  if (!room) throw new Error("A sala não está mais disponível.");

  const role = room.players.p1.uid === uid ? "p1" : "p2";
  await configurePresence(normalized, role);
  return { code: normalized, role, uid };
}

/** Mantém o indicador de presença consistente mesmo se a aba fechar abruptamente. */
async function configurePresence(code, role) {
  const presence = ref(db, `rooms/${code}/players/${role}`);
  await update(presence, { connected: true, lastSeenAt: serverTimestamp() });
  await onDisconnect(presence).update({ connected: false, lastSeenAt: serverTimestamp() });
}

/** Observa todas as alterações da sala em tempo real. */
export function subscribeRoom(code, callback, onError) {
  return onValue(roomRef(code), (snapshot) => callback(snapshot.val()), onError);
}

export async function markConnected(code, role) {
  if (!db || !code || !role) return;
  await update(ref(db, `rooms/${code}/players/${role}`), { connected: true, lastSeenAt: serverTimestamp() });
}

/** Executa uma jogada em transaction para impedir conflitos entre cliques simultâneos. */
export async function playTile(code, role, tileId, side) {
  let failure = null;
  const target = roomRef(code);

  // Garante que a transaction comece com o estado atual da sala em cache.
  await get(target);

  const result = await runTransaction(target, (room) => {
    if (!room || room.status !== "playing") { failure = "A partida não está disponível para jogar."; return; }
    if (room.players?.[role]?.uid !== currentUid) { failure = "Este navegador não corresponde ao jogador da sala."; return; }
    if (room.game.turn !== role) { failure = "Ainda não é a sua vez."; return; }
    const handKey = role === "p1" ? "hand1" : "hand2";
    const hand = room.game[handKey] || [];
    const tileIndex = hand.findIndex((tile) => tile.id === tileId);
    if (tileIndex < 0) { failure = "A peça selecionada não está mais na sua mão."; return; }
    let oriented;
    try { oriented = orientTile(hand[tileIndex], room.game.table || [], side); }
    catch (error) { failure = error.message; return; }
    oriented.playedBy = role;
    oriented.move = (room.game.moveNumber || 0) + 1;
    room.game[handKey] = hand.filter((_, index) => index !== tileIndex);
    room.game.table = room.game.table || [];
    if (side === "left" && room.game.table.length) room.game.table.unshift(oriented);
    else room.game.table.push(oriented);
    room.game.moveNumber = oriented.move;
    room.game.consecutivePasses = 0;
    if (room.game[handKey].length === 0) {
      room.game.winner = role;
      room.game.finishReason = "empty-hand";
      room.status = "finished";
    } else room.game.turn = role === "p1" ? "p2" : "p1";
    return room;
  });
  if (!result.committed) throw new Error(failure || "A jogada não pôde ser concluída.");
}

/** Passa a vez somente se o próprio servidor confirmar que não existe jogada possível. */
export async function passTurn(code, role) {
  let failure = null;
  const target = roomRef(code);
  await get(target);

  const result = await runTransaction(target, (room) => {
    if (!room || room.status !== "playing") { failure = "A partida não está disponível."; return; }
    if (room.players?.[role]?.uid !== currentUid || room.game.turn !== role) { failure = "Não é possível passar a vez agora."; return; }
    const hand = role === "p1" ? (room.game.hand1 || []) : (room.game.hand2 || []);
    if (hasAnyMove(hand, room.game.table || [])) { failure = "Você ainda possui pelo menos uma jogada válida."; return; }
    room.game.consecutivePasses = (room.game.consecutivePasses || 0) + 1;
    if (room.game.consecutivePasses >= 2) {
      room.game.winner = blockedWinner(room.game.hand1 || [], room.game.hand2 || []);
      room.game.finishReason = "blocked";
      room.status = "finished";
    } else room.game.turn = role === "p1" ? "p2" : "p1";
    return room;
  });
  if (!result.committed) throw new Error(failure || "Não foi possível passar a vez.");
}

/** Reinicia a rodada mantendo a mesma sala e os mesmos dois participantes. */
export async function restartGame(code, role) {
  if (role !== "p1") throw new Error("Somente o Jogador 1 pode iniciar uma nova rodada.");
  let failure = null;
  const target = roomRef(code);
  await get(target);

  const result = await runTransaction(target, (room) => {
    if (!room?.players?.p2) { failure = "O segundo jogador ainda não entrou."; return; }
    if (room.players.p1.uid !== currentUid) { failure = "Este navegador não é o criador da sala."; return; }
    room.game = newGameState();
    room.status = "playing";
    room.expiresAt = Date.now() + 4 * 60 * 60 * 1000;
    return room;
  });
  if (!result.committed) throw new Error(failure || "Não foi possível reiniciar a partida.");
}
