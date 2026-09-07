/**
 * Valores racionais usados no jogo.
 * Cada valor possui duas representações equivalentes: fração e decimal.
 */
export const RATIONAL_VALUES = {
  "0.20": { fraction: "1/5", decimal: "0,2" },
  "0.25": { fraction: "1/4", decimal: "0,25" },
  "0.28": { fraction: "7/25", decimal: "0,28" },
  "0.375": { fraction: "3/8", decimal: "0,375" },
  "0.40": { fraction: "2/5", decimal: "0,4" },
  "0.50": { fraction: "1/2", decimal: "0,5" },
  "0.60": { fraction: "3/5", decimal: "0,6" },
  "0.65": { fraction: "13/20", decimal: "0,65" },
  "0.68": { fraction: "17/25", decimal: "0,68" },
  "0.75": { fraction: "3/4", decimal: "0,75" },
  "0.90": { fraction: "9/10", decimal: "0,9" }
};

/** As 28 peças do baralho. */
const PAIRS = [
  ["0.20","0.25"],["0.25","0.28"],["0.28","0.375"],["0.375","0.40"],
  ["0.40","0.50"],["0.50","0.60"],["0.60","0.65"],["0.65","0.68"],
  ["0.68","0.75"],["0.75","0.90"],["0.90","0.20"],["0.25","0.25"],
  ["0.40","0.40"],["0.50","0.50"],["0.68","0.68"],["0.75","0.75"],
  ["0.20","0.40"],["0.20","0.60"],["0.25","0.50"],["0.25","0.75"],
  ["0.28","0.50"],["0.28","0.68"],["0.375","0.65"],["0.375","0.90"],
  ["0.40","0.68"],["0.50","0.75"],["0.60","0.90"],["0.65","0.90"]
];

function labelFor(key, useFraction) {
  const value = RATIONAL_VALUES[key];
  return useFraction ? value.fraction : value.decimal;
}

/**
 * Gera as 28 peças alternando fração e decimal, para forçar o reconhecimento
 * de equivalência em vez de simples comparação visual de textos.
 */
export function createDeck() {
  return PAIRS.map(([leftKey, rightKey], index) => ({
    id: `T${String(index + 1).padStart(2, "0")}`,
    leftKey,
    rightKey,
    leftLabel: labelFor(leftKey, index % 2 === 0),
    rightLabel: labelFor(rightKey, index % 2 !== 0)
  }));
}

/** Embaralhamento Fisher-Yates usando crypto.getRandomValues. */
export function shuffleDeck(deck) {
  const copy = deck.map((tile) => ({ ...tile }));
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const j = randomArray[0] % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
