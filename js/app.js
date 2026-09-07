import {
  isOnlineBackendReady,
  createRoom,
  joinRoom,
  subscribeRoom,
  playTile,
  passTurn,
  restartGame,
  markConnected
} from "./firebase-service.js";
import { canPlayTile, validSides, hasAnyMove } from "./game-logic.js";
import { createDemoGame, demoPlay, demoPass, demoOpponentTurn } from "./demo-service.js";

const $ = (id) => document.getElementById(id);
const els = {
  setup: $("setup-screen"), game: $("game-screen"), warning: $("configuration-warning"),
  create: $("create-room-btn"), join: $("join-room-btn"), input: $("room-code-input"), demo: $("demo-mode-btn"),
  roomCode: $("room-code-display"), copyCode: $("copy-code-btn"), leave: $("leave-room-btn"),
  p1Name: $("p1-name"), p2Name: $("p2-name"), p1You: $("p1-you"), p2You: $("p2-you"),
  p1Presence: $("p1-presence"), p2Presence: $("p2-presence"), status: $("status-banner"),
  scoreP1: $("score-p1"), scoreP2: $("score-p2"), tableCount: $("table-count"), turn: $("turn-label"),
  hint: $("hint-btn"), rules: $("rules-btn"), pass: $("pass-btn"),
  tableEmpty: $("table-empty"), chain: $("domino-chain"), hand: $("hand-area"),
  left: $("play-left-btn"), right: $("play-right-btn"), teacherNote: $("teacher-note"),
  messageDialog: $("message-dialog"), messageTitle: $("message-title"), messageBody: $("message-body"),
  rulesDialog: $("rules-dialog")
};

let state = {
  code: null,
  role: null,
  uid: null,
  room: null,
  unsubscribe: null,
  selectedTileId: null,
  demoMode: false,
  busy: false
};

function showMessage(title, message) {
  els.messageTitle.textContent = title;
  els.messageBody.textContent = message;
  els.messageDialog.showModal();
}

function setBusy(busy) {
  state.busy = busy;
  els.create.disabled = busy;
  els.join.disabled = busy;
}

function normalizeCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function showGame() {
  els.setup.classList.add("hidden");
  els.game.classList.remove("hidden");
}

function showSetup() {
  els.game.classList.add("hidden");
  els.setup.classList.remove("hidden");
}

function currentHand(room = state.room) {
  if (!room || !state.role) return [];
  return state.role === "p1" ? (room.game.hand1 || []) : (room.game.hand2 || []);
}

function renderTile(tile, { selected = false, playable = true, played = false } = {}) {
  const el = document.createElement("div");
  el.className = `domino ${played ? "played" : "selectable"} ${selected ? "selected" : ""} ${playable ? "" : "disabled"}`.trim();
  el.dataset.tileId = tile.id;
  const left = document.createElement("div");
  left.className = "half";
  left.textContent = tile.leftLabel;
  const right = document.createElement("div");
  right.className = "half";
  right.textContent = tile.rightLabel;
  el.append(left, right);
  return el;
}

function statusText(room) {
  if (!room) return "Sala indisponível.";
  if (room.status === "waiting") return "Envie o código ao segundo jogador.";
  if (room.status === "finished") {
    if (room.game.winner === "draw") return "Partida encerrada em empate.";
    const reason = room.game.finishReason === "blocked" ? " após bloqueio da mesa" : "";
    return `${room.game.winner === "p1" ? "Jogador 1" : "Jogador 2"} venceu${reason}!`;
  }
  if (room.game.turn === state.role) return "Sua vez.";
  return `Vez do ${room.game.turn === "p1" ? "Jogador 1" : "Jogador 2"}.`;
}

/** Recria a interface sempre que o estado local ou remoto muda. */
function render() {
  const room = state.room;
  if (!room) return;

  els.roomCode.textContent = state.code;
  els.p1Name.textContent = room.players?.p1?.name || "Jogador 1";
  els.p2Name.textContent = room.players?.p2?.name || "Jogador 2";
  els.p1You.textContent = state.role === "p1" ? " (você)" : "";
  els.p2You.textContent = state.role === "p2" ? " (você)" : "";
  els.p1Presence.classList.toggle("online", Boolean(room.players?.p1?.connected));
  els.p2Presence.classList.toggle("online", Boolean(room.players?.p2?.connected));
  els.status.textContent = statusText(room);
  els.scoreP1.textContent = room.game.hand1?.length ?? 0;
  els.scoreP2.textContent = room.game.hand2?.length ?? 0;
  els.tableCount.textContent = `${room.game.table?.length ?? 0}/28`;
  els.turn.textContent = room.status === "playing" ? (room.game.turn === state.role ? "Sua vez" : "Aguarde") : "—";

  const table = room.game.table || [];
  els.tableEmpty.classList.toggle("hidden", table.length > 0);
  els.chain.innerHTML = "";
  table.forEach((tile) => els.chain.appendChild(renderTile(tile, { played: true })));

  const hand = currentHand(room);
  const isMyTurn = room.status === "playing" && room.game.turn === state.role;
  els.hand.innerHTML = "";
  hand.forEach((tile) => {
    const playable = isMyTurn && canPlayTile(tile, table);
    const tileEl = renderTile(tile, {
      selected: tile.id === state.selectedTileId,
      playable: isMyTurn ? playable : false
    });
    tileEl.addEventListener("click", () => {
      if (!isMyTurn) return showMessage("Aguarde", "Ainda não é a sua vez.");
      if (!playable) return showMessage("Essa peça não encaixa", "Procure uma peça equivalente a uma das pontas da mesa.");
      state.selectedTileId = state.selectedTileId === tile.id ? null : tile.id;
      render();
    });
    els.hand.appendChild(tileEl);
  });

  const selected = hand.find((tile) => tile.id === state.selectedTileId);
  const sides = selected ? validSides(selected, table) : [];
  els.left.disabled = !selected || !sides.includes("left") || state.busy;
  els.right.disabled = !selected || !sides.includes("right") || state.busy;
  els.right.textContent = !table.length && selected ? "Jogar peça" : "Jogar à direita →";
  els.left.classList.toggle("hidden", !table.length);

  const canPass = isMyTurn && !hasAnyMove(hand, table);
  els.pass.classList.toggle("hidden", !canPass);
  els.pass.disabled = state.busy;

  els.teacherNote.classList.toggle("hidden", !state.demoMode);
  if (state.demoMode) {
    els.teacherNote.textContent = "Modo demonstração local: o segundo jogador é automático. Para dois aparelhos reais, configure o Firebase.";
  }

  if (room.status === "finished" && state.role === "p1") {
    els.teacherNote.classList.remove("hidden");
    els.teacherNote.innerHTML = `${state.demoMode ? "Modo demonstração local. " : ""}<button id="restart-inline" class="btn btn-primary btn-small" type="button">🔄 Nova rodada</button>`;
    $("restart-inline").addEventListener("click", handleRestart);
  }
}

async function handleCreate() {
  if (!isOnlineBackendReady()) {
    return showMessage("Firebase ainda não configurado", "Use o modo demonstração por enquanto. Depois de conectar o projeto Firebase, a criação de salas online ficará disponível.");
  }
  try {
    setBusy(true);
    const session = await createRoom();
    state = { ...state, ...session, demoMode: false, selectedTileId: null };
    showGame();
    subscribeCurrentRoom();
  } catch (error) {
    showMessage("Não foi possível criar a sala", error.message);
  } finally {
    setBusy(false);
  }
}

async function handleJoin() {
  const code = normalizeCode(els.input.value);
  els.input.value = code;
  if (code.length !== 6) return showMessage("Código incompleto", "Digite os 6 caracteres do código da sala.");
  if (!isOnlineBackendReady()) return showMessage("Firebase ainda não configurado", "As salas online serão liberadas assim que o Firebase for conectado ao projeto.");
  try {
    setBusy(true);
    const session = await joinRoom(code);
    state = { ...state, ...session, demoMode: false, selectedTileId: null };
    showGame();
    subscribeCurrentRoom();
  } catch (error) {
    showMessage("Não foi possível entrar", error.message);
  } finally {
    setBusy(false);
  }
}

function subscribeCurrentRoom() {
  state.unsubscribe?.();
  state.unsubscribe = subscribeRoom(state.code, (room) => {
    if (!room) {
      showMessage("Sala encerrada", "A sala não existe mais.");
      return leaveLocal();
    }
    state.room = room;
    if (state.selectedTileId && !currentHand(room).some((tile) => tile.id === state.selectedTileId)) {
      state.selectedTileId = null;
    }
    render();
  }, (error) => showMessage("Erro de sincronização", error.message));
}

async function handlePlay(side) {
  if (!state.selectedTileId || state.busy) return;
  try {
    state.busy = true;
    render();
    if (state.demoMode) {
      demoPlay(state.room, state.role, state.selectedTileId, side);
      state.selectedTileId = null;
      render();
      setTimeout(() => {
        demoOpponentTurn(state.room);
        render();
      }, 650);
    } else {
      await playTile(state.code, state.role, state.selectedTileId, side);
      state.selectedTileId = null;
    }
  } catch (error) {
    showMessage("Jogada não realizada", error.message);
  } finally {
    state.busy = false;
    render();
  }
}

async function handlePass() {
  try {
    state.busy = true;
    render();
    if (state.demoMode) {
      demoPass(state.room, state.role);
      render();
      setTimeout(() => {
        demoOpponentTurn(state.room);
        render();
      }, 650);
    } else {
      await passTurn(state.code, state.role);
    }
  } catch (error) {
    showMessage("Não foi possível passar", error.message);
  } finally {
    state.busy = false;
    render();
  }
}

function handleHint() {
  const room = state.room;
  if (!room || room.status !== "playing") return showMessage("Dica", "A partida ainda não começou.");
  if (room.game.turn !== state.role) return showMessage("Dica", "Aguarde sua vez para procurar uma jogada.");
  const playable = currentHand(room).filter((tile) => canPlayTile(tile, room.game.table || []));
  if (!playable.length) return showMessage("Dica", "Você não possui uma jogada válida. Use “Passar a vez”.");
  const first = playable[0];
  showMessage("Dica", `Observe a peça ${first.leftLabel} | ${first.rightLabel}. Pelo menos uma de suas metades é equivalente a uma ponta da mesa.`);
}

async function handleRestart() {
  try {
    if (state.demoMode) {
      const demo = createDemoGame();
      state.room = demo.room;
      state.selectedTileId = null;
      render();
    } else {
      await restartGame(state.code, state.role);
    }
  } catch (error) {
    showMessage("Não foi possível reiniciar", error.message);
  }
}

function startDemo() {
  const demo = createDemoGame();
  state = { ...state, code: demo.code, role: demo.role, room: demo.room, demoMode: true, selectedTileId: null };
  showGame();
  render();
}

function leaveLocal() {
  state.unsubscribe?.();
  state = {
    code: null,
    role: null,
    uid: null,
    room: null,
    unsubscribe: null,
    selectedTileId: null,
    demoMode: false,
    busy: false
  };
  showSetup();
}

els.create.addEventListener("click", handleCreate);
els.join.addEventListener("click", handleJoin);
els.input.addEventListener("input", () => { els.input.value = normalizeCode(els.input.value); });
els.input.addEventListener("keydown", (event) => { if (event.key === "Enter") handleJoin(); });
els.demo.addEventListener("click", startDemo);
els.copyCode.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(state.code);
    showMessage("Código copiado", `Envie ${state.code} ao segundo jogador.`);
  } catch (_) {
    showMessage("Código da sala", state.code);
  }
});
els.leave.addEventListener("click", leaveLocal);
els.left.addEventListener("click", () => handlePlay("left"));
els.right.addEventListener("click", () => handlePlay("right"));
els.pass.addEventListener("click", handlePass);
els.hint.addEventListener("click", handleHint);
els.rules.addEventListener("click", () => els.rulesDialog.showModal());
window.addEventListener("focus", () => {
  if (!state.demoMode) markConnected(state.code, state.role).catch(() => {});
});

if (!isOnlineBackendReady()) {
  els.warning.classList.remove("hidden");
  els.demo.classList.remove("hidden");
}
