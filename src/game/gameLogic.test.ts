import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGuessScore, calculateDrawerScore, formatTimeRemaining } from './scoring.ts';
import { getWordHint, isCorrectGuess, containsExactAnswer, getRandomWord, generateWordOptions } from './wordBank.ts';

test('calculateGuessScore awards higher score for faster guesses and 1st place', () => {
  const fastScore = calculateGuessScore({ timeLeft: 60, totalTime: 60, orderIndex: 0 });
  const slowScore = calculateGuessScore({ timeLeft: 10, totalTime: 60, orderIndex: 0 });
  const secondPlaceScore = calculateGuessScore({ timeLeft: 60, totalTime: 60, orderIndex: 1 });

  assert.ok(fastScore > slowScore, 'Fast guess score should exceed slow guess score');
  assert.ok(fastScore > secondPlaceScore, 'First place should exceed second place for same time');
  assert.equal(calculateGuessScore({ timeLeft: 0, totalTime: 60, orderIndex: 0 }), 0);
});

test('calculateDrawerScore scales with ratio of successful guessers', () => {
  const allGuessed = calculateDrawerScore(3, 3);
  const noneGuessed = calculateDrawerScore(0, 3);
  const halfGuessed = calculateDrawerScore(2, 4);

  assert.equal(allGuessed, 300);
  assert.equal(noneGuessed, 0);
  assert.equal(halfGuessed, 150);
});

test('formatTimeRemaining formats mm:ss accurately', () => {
  assert.equal(formatTimeRemaining(65), '1:05');
  assert.equal(formatTimeRemaining(9), '0:09');
  assert.equal(formatTimeRemaining(0), '0:00');
});

test('word bank returns valid random words', () => {
  const word = getRandomWord('medium');
  assert.ok(typeof word === 'string');
  assert.ok(word.length > 2);
});

test('word hint masks non-revealed characters with underscores', () => {
  const hint = getWordHint('ROCKET', 0.3);
  assert.ok(hint.includes('_'));
  assert.ok(hint.length > 6);
});

test('isCorrectGuess handles casing and whitespace', () => {
  assert.equal(isCorrectGuess(' rocket ', 'ROCKET'), true);
  assert.equal(isCorrectGuess('guitar', 'ROCKET'), false);
  assert.equal(isCorrectGuess('', 'ROCKET'), false);
});

test('containsExactAnswer identifies spoiler words in chat', () => {
  assert.equal(containsExactAnswer('i think it is rocket', 'rocket'), true);
  assert.equal(containsExactAnswer('hello friends', 'rocket'), false);
});

test('generateWordOptions produces 3 distinct words matching difficulty levels', () => {
  // Test Easy difficulty
  const easyResult = generateWordOptions('easy');
  assert.equal(easyResult.words.length, 3);
  assert.equal(new Set(easyResult.words).size, 3, 'Words must be distinct');
  for (const w of easyResult.words) {
    assert.equal(easyResult.difficulties[w], 'easy');
  }

  // Test Hard difficulty
  const hardResult = generateWordOptions('hard');
  assert.equal(hardResult.words.length, 3);
  assert.equal(new Set(hardResult.words).size, 3);
  for (const w of hardResult.words) {
    assert.equal(hardResult.difficulties[w], 'hard');
  }

  // Test Mixed difficulty
  const mixedResult = generateWordOptions('mixed');
  assert.equal(mixedResult.words.length, 3);
  assert.equal(new Set(mixedResult.words).size, 3);
  const diffValues = Object.values(mixedResult.difficulties);
  assert.ok(diffValues.includes('easy'));
  assert.ok(diffValues.includes('medium'));
  assert.ok(diffValues.includes('hard'));
});

test('generateWordOptions avoids recently used words', () => {
  const exclude = new Set(['APPLE', 'CAT', 'SUN']);
  const result = generateWordOptions('easy', exclude);
  for (const w of result.words) {
    assert.ok(!exclude.has(w), `Word ${w} should not be in exclude set`);
  }
});

test('isCorrectGuess handles multiword phrases and punctuation', () => {
  assert.equal(isCorrectGuess('time machine', 'TIME MACHINE'), true);
  assert.equal(isCorrectGuess('  time   machine!  ', 'TIME MACHINE'), true);
  assert.equal(isCorrectGuess('invisible bridge', 'INVISIBLE BRIDGE'), true);
  assert.equal(isCorrectGuess('wrong answer', 'TIME MACHINE'), false);
});
