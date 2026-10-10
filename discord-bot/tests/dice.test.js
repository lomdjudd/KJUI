import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDice, rollDice } from '../src/utils/dice.js';

test('parseDice applique les valeurs par défaut', () => {
  assert.deepEqual(parseDice('d6'), { count: 1, sides: 6, modifier: 0 });
});

test('parseDice lit un modificateur positif', () => {
  assert.deepEqual(parseDice('2d20+5'), { count: 2, sides: 20, modifier: 5 });
});

test('parseDice lit un modificateur négatif', () => {
  assert.deepEqual(parseDice('3d6-2'), { count: 3, sides: 6, modifier: -2 });
});

test('parseDice est insensible à la casse', () => {
  assert.deepEqual(parseDice('2D6'), { count: 2, sides: 6, modifier: 0 });
});

test('parseDice ignore les espaces autour de l\'expression', () => {
  assert.deepEqual(parseDice('  2d6+1 \t'), { count: 2, sides: 6, modifier: 1 });
});

test('parseDice rejette les expressions invalides ou hors limites', () => {
  for (const expr of ['', 'abc', '0d6', '21d6', 'd1', 'd1001', 'd6+5000']) {
    assert.throws(() => parseDice(expr), Error, `« ${expr} » devrait être rejeté`);
  }
});

test('rollDice donne 1 à chaque dé quand random renvoie 0', () => {
  const result = rollDice({ count: 3, sides: 6, modifier: 2 }, () => 0);
  assert.deepEqual(result.rolls, [1, 1, 1]);
  assert.equal(result.total, 5);
});

test('rollDice donne le maximum à chaque dé quand random est proche de 1', () => {
  const result = rollDice({ count: 3, sides: 6, modifier: 0 }, () => 0.999999);
  assert.deepEqual(result.rolls, [6, 6, 6]);
  assert.equal(result.total, 18);
});

test('rollDice inclut le modificateur dans le total', () => {
  const result = rollDice({ count: 2, sides: 20, modifier: -3 }, () => 0.999999);
  assert.deepEqual(result.rolls, [20, 20]);
  assert.equal(result.total, 37);
});
