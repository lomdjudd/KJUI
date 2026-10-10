const DICE_PATTERN = /^(\d*)d(\d+)([+-]\d+)?$/;

const FORMAT_ERROR = 'Format invalide. Exemples : d6, 2d20+5.';

const LIMITS = {
  count: { min: 1, max: 20, message: 'Le nombre de dés doit être entre 1 et 20.' },
  sides: { min: 2, max: 1000, message: 'Le nombre de faces doit être entre 2 et 1000.' },
  modifier: { min: -1000, max: 1000, message: 'Le modificateur doit être entre -1000 et 1000.' },
};

function checkRange(value, { min, max, message }) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(message);
  }
  return value;
}

export function parseDice(expr) {
  const match = typeof expr === 'string' ? DICE_PATTERN.exec(expr.trim().toLowerCase()) : null;
  if (!match) {
    throw new Error(FORMAT_ERROR);
  }

  const [, countText, sidesText, modifierText] = match;
  const count = countText === '' ? 1 : Number(countText);
  const sides = Number(sidesText);
  const modifier = modifierText === undefined ? 0 : Number(modifierText);

  return {
    count: checkRange(count, LIMITS.count),
    sides: checkRange(sides, LIMITS.sides),
    modifier: checkRange(modifier, LIMITS.modifier),
  };
}

export function rollDice({ count, sides, modifier = 0 }, random = Math.random) {
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(random() * sides));
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;
  return { rolls, total };
}
