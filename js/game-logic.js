/** Compara duas chaves numéricas já normalizadas. */
export function sameValue(a, b) { return a === b; }

/** Devolve as duas pontas abertas da corrente de dominós. */
export function getOpenEnds(table) {
  if (!table?.length) return { left: null, right: null };
  return { left: table[0].leftKey, right: table[table.length - 1].rightKey };
}

/** Verifica se a peça cabe em ao menos uma das extremidades. */
export function canPlayTile(tile, table) {
  if (!table?.length) return true;
  const { left, right } = getOpenEnds(table);
  return [tile.leftKey, tile.rightKey].some((value) => sameValue(value, left) || sameValue(value, right));
}

/** Retorna as pontas válidas para uma peça: left, right ou ambas. */
export function validSides(tile, table) {
  if (!table?.length) return ["right"];
  const { left, right } = getOpenEnds(table);
  const sides = [];
  if (sameValue(tile.leftKey, left) || sameValue(tile.rightKey, left)) sides.push("left");
  if (sameValue(tile.leftKey, right) || sameValue(tile.rightKey, right)) sides.push("right");
  return sides;
}

/** Inverte a orientação visual e matemática da peça. */
export function flipTile(tile) {
  return {
    ...tile,
    leftKey: tile.rightKey,
    rightKey: tile.leftKey,
    leftLabel: tile.rightLabel,
    rightLabel: tile.leftLabel
  };
}

/** Orienta a peça para que ela encaixe na extremidade escolhida. */
export function orientTile(tile, table, side) {
  if (!table?.length) return { ...tile };
  const ends = getOpenEnds(table);
  if (side === "left") {
    if (sameValue(tile.rightKey, ends.left)) return { ...tile };
    if (sameValue(tile.leftKey, ends.left)) return flipTile(tile);
  }
  if (side === "right") {
    if (sameValue(tile.leftKey, ends.right)) return { ...tile };
    if (sameValue(tile.rightKey, ends.right)) return flipTile(tile);
  }
  throw new Error("Essa peça não combina com a ponta escolhida.");
}

/** Retorna true quando existe alguma jogada legal na mão. */
export function hasAnyMove(hand, table) {
  return hand.some((tile) => canPlayTile(tile, table));
}

/** Soma os valores numéricos das peças para uso em desempate. */
export function handNumericSum(hand) {
  return hand.reduce((sum, tile) => sum + Number(tile.leftKey) + Number(tile.rightKey), 0);
}

/** Define o vencedor quando a mesa fica bloqueada. */
export function blockedWinner(hand1, hand2) {
  if (hand1.length !== hand2.length) return hand1.length < hand2.length ? "p1" : "p2";
  const sum1 = handNumericSum(hand1);
  const sum2 = handNumericSum(hand2);
  if (Math.abs(sum1 - sum2) < 1e-9) return "draw";
  return sum1 < sum2 ? "p1" : "p2";
}
