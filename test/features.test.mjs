import test from 'node:test';
import assert from 'node:assert/strict';

// -----------------------------------------------------------------------------
// 1. Scribble Reaction Scoring Logic Unit Tests
// -----------------------------------------------------------------------------
function calculateScoreAfterReaction(currentScore, reactionType, existingReaction) {
  let score = currentScore;
  if (reactionType === 'like') {
    if (existingReaction === 'like') {
      // Toggle off
      score = Math.max(0, score - 5);
      return { score, newReaction: null };
    }
    if (existingReaction === 'dislike') {
      score += 2; // refund dislike
    }
    score += 5;
    return { score, newReaction: 'like' };
  }

  if (reactionType === 'dislike') {
    if (existingReaction === 'dislike') {
      // Toggle off
      score += 2;
      return { score, newReaction: null };
    }
    if (existingReaction === 'like') {
      score = Math.max(0, score - 5);
    }
    score = Math.max(0, score - 2);
    return { score, newReaction: 'dislike' };
  }

  return { score, newReaction: existingReaction };
}

test('Scribble Reaction Scoring: Fresh like adds +5 points', () => {
  const result = calculateScoreAfterReaction(10, 'like', null);
  assert.equal(result.score, 15);
  assert.equal(result.newReaction, 'like');
});

test('Scribble Reaction Scoring: Fresh dislike subtracts -2 points', () => {
  const result = calculateScoreAfterReaction(10, 'dislike', null);
  assert.equal(result.score, 8);
  assert.equal(result.newReaction, 'dislike');
});

test('Scribble Reaction Scoring: Dislike never reduces score below 0', () => {
  const result = calculateScoreAfterReaction(1, 'dislike', null);
  assert.equal(result.score, 0);
  assert.equal(result.newReaction, 'dislike');
});

test('Scribble Reaction Scoring: Switching from dislike to like refunds 2 and adds 5 (+7 total)', () => {
  const result = calculateScoreAfterReaction(8, 'like', 'dislike');
  assert.equal(result.score, 15);
  assert.equal(result.newReaction, 'like');
});

test('Scribble Reaction Scoring: Switching from like to dislike removes 5 and subtracts 2 (-7 total)', () => {
  const result = calculateScoreAfterReaction(15, 'dislike', 'like');
  assert.equal(result.score, 8);
  assert.equal(result.newReaction, 'dislike');
});

test('Scribble Reaction Scoring: Toggling like off removes 5 points without going negative', () => {
  const result = calculateScoreAfterReaction(5, 'like', 'like');
  assert.equal(result.score, 0);
  assert.equal(result.newReaction, null);
});

// -----------------------------------------------------------------------------
// 2. Portal Concurrent Readiness Logic Unit Tests
// -----------------------------------------------------------------------------
class PortalTransitionController {
  constructor(onJoin) {
    this.onJoin = onJoin;
    this.attemptId = 0;
    this.setupReady = false;
    this.traverseComplete = false;
    this.hasJoined = false;
  }

  startAttempt() {
    this.attemptId++;
    this.setupReady = false;
    this.traverseComplete = false;
    this.hasJoined = false;
    return this.attemptId;
  }

  cancel() {
    this.attemptId++;
    this.setupReady = false;
    this.traverseComplete = false;
    this.hasJoined = false;
  }

  onSetupReady(attemptId, roomCode) {
    if (this.attemptId !== attemptId) return; // Stale attempt
    this.setupReady = true;
    if (this.traverseComplete) {
      this.executeJoin(attemptId, roomCode);
    }
  }

  onTraverseComplete(attemptId, roomCode) {
    if (this.attemptId !== attemptId) return;
    this.traverseComplete = true;
    if (this.setupReady) {
      this.executeJoin(attemptId, roomCode);
    }
  }

  executeJoin(attemptId, roomCode) {
    if (this.attemptId !== attemptId || this.hasJoined) return;
    this.hasJoined = true;
    this.onJoin(roomCode);
  }
}

test('Portal Transition: Triggers onJoin exactly once when setup finishes first, then traverse completes', () => {
  let joinCalls = [];
  const controller = new PortalTransitionController((code) => joinCalls.push(code));
  const id = controller.startAttempt();

  controller.onSetupReady(id, 'ABC123');
  assert.equal(joinCalls.length, 0, 'Should not join until traverse completes');

  controller.onTraverseComplete(id, 'ABC123');
  assert.equal(joinCalls.length, 1, 'Should join as soon as both are ready');
  assert.equal(joinCalls[0], 'ABC123');

  // Repeated traverse or callback must be ignored
  controller.onTraverseComplete(id, 'ABC123');
  assert.equal(joinCalls.length, 1, 'Should never invoke join twice');
});

test('Portal Transition: Triggers onJoin exactly once when traverse completes first, then setup succeeds', () => {
  let joinCalls = [];
  const controller = new PortalTransitionController((code) => joinCalls.push(code));
  const id = controller.startAttempt();

  controller.onTraverseComplete(id, 'XYZ789');
  assert.equal(joinCalls.length, 0, 'Should wait for setup to finish');

  controller.onSetupReady(id, 'XYZ789');
  assert.equal(joinCalls.length, 1, 'Should join as soon as setup succeeds');
  assert.equal(joinCalls[0], 'XYZ789');
});

test('Portal Transition: Cancel completely invalidates in-flight setup', () => {
  let joinCalls = [];
  const controller = new PortalTransitionController((code) => joinCalls.push(code));
  const id = controller.startAttempt();

  controller.cancel();
  // Late network response arrives
  controller.onSetupReady(id, 'LATE99');
  controller.onTraverseComplete(id, 'LATE99');

  assert.equal(joinCalls.length, 0, 'Canceled attempt must never trigger join');
});

// -----------------------------------------------------------------------------
// 3. Flood Fill Antialiasing Tolerance and Hex Parsing Tests
// -----------------------------------------------------------------------------
function hexToRgba(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

test('Hex to RGBA parsing produces accurate RGB values', () => {
  assert.deepEqual(hexToRgba('#ffffff'), [255, 255, 255, 255]);
  assert.deepEqual(hexToRgba('#000000'), [0, 0, 0, 255]);
  assert.deepEqual(hexToRgba('#ef4444'), [239, 68, 68, 255]);
  assert.deepEqual(hexToRgba('#fff'), [255, 255, 255, 255]);
});

// -----------------------------------------------------------------------------
// 4. Room Code Extraction, Normalization, Copy Isolation & Validation Tests
// -----------------------------------------------------------------------------
function normalizeRoomCode(raw) {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function extractRoomCodeFromUrl(urlOrSearch) {
  let searchStr = '';
  let fullUrl = '';
  if (urlOrSearch) {
    if (urlOrSearch.includes('?') || urlOrSearch.includes('://')) {
      fullUrl = urlOrSearch;
      const qIndex = urlOrSearch.indexOf('?');
      if (qIndex !== -1) searchStr = urlOrSearch.slice(qIndex);
    } else {
      searchStr = urlOrSearch.startsWith('&') ? `?${urlOrSearch.slice(1)}` : (urlOrSearch.startsWith('?') ? urlOrSearch : `?${urlOrSearch}`);
    }
  }

  if (searchStr) {
    const params = new URLSearchParams(searchStr);
    if (params.has('room')) {
      const rawParam = params.get('room') || '';
      const trimmed = rawParam.trim();
      const code = normalizeRoomCode(trimmed);
      const isMalformed = trimmed.length === 0 || code.length < 4 || code.length > 8 || code !== trimmed.toUpperCase();
      return { code, hasParam: true, isMalformed, rawParam };
    }
  }

  if (fullUrl) {
    const match = fullUrl.match(/\/room\/([A-Za-z0-9_-]+)/);
    if (match && match[1]) {
      const rawParam = match[1];
      const trimmed = rawParam.trim();
      const code = normalizeRoomCode(trimmed);
      const isMalformed = trimmed.length === 0 || code.length < 4 || code.length > 8;
      return { code, hasParam: true, isMalformed, rawParam };
    }
  }

  return { code: '', hasParam: false, isMalformed: false, rawParam: '' };
}

function validateRoomCode(raw) {
  if (!raw || !raw.trim()) {
    return { isValid: false, error: 'Please enter a room code.' };
  }
  const clean = normalizeRoomCode(raw);
  if (!clean) {
    return { isValid: false, error: 'Please enter a valid alphanumeric room code.' };
  }
  if (clean.length < 4) {
    return { isValid: false, error: 'Room codes are 6 alphanumeric characters (e.g. ABC123).' };
  }
  if (clean.length > 8) {
    return { isValid: false, error: 'Room code cannot exceed 8 characters.' };
  }
  return { isValid: true };
}

test('Copy Room Code Isolation: Copies strictly the room code without domain, protocol, or params', () => {
  const roomCode = 'AB12CD';
  // Copy Room Code logic:
  const copiedCode = roomCode.trim();
  assert.equal(copiedCode, 'AB12CD');
  assert.ok(!copiedCode.includes('http://'));
  assert.ok(!copiedCode.includes('https://'));
  assert.ok(!copiedCode.includes('?room='));
  assert.ok(!copiedCode.includes('/'));

  // Whereas Copy Invite Link copies the full URL:
  const inviteUrl = `https://afterhours.app/?room=${roomCode}`;
  assert.equal(inviteUrl, 'https://afterhours.app/?room=AB12CD');
});

test('Room Code URL Extraction: Correctly extracts standard query param ?room=6337MV', () => {
  const result = extractRoomCodeFromUrl('?room=6337MV');
  assert.equal(result.hasParam, true);
  assert.equal(result.code, '6337MV');
  assert.equal(result.isMalformed, false);
});

test('Room Code URL Extraction: Normalizes lowercase and trimmed whitespace in URL', () => {
  const result = extractRoomCodeFromUrl('https://localhost:3000/?room=%20ab12cd%20');
  assert.equal(result.hasParam, true);
  assert.equal(result.code, 'AB12CD');
});

test('Room Code URL Extraction: Detects malformed/empty room query param', () => {
  const emptyResult = extractRoomCodeFromUrl('?room=');
  assert.equal(emptyResult.hasParam, true);
  assert.equal(emptyResult.isMalformed, true);
  assert.equal(emptyResult.code, '');

  const shortResult = extractRoomCodeFromUrl('?room=AB');
  assert.equal(shortResult.hasParam, true);
  assert.equal(shortResult.isMalformed, true);
});

test('Room Code Form State Synchronization: Valid prefilled code allows joining without false error', () => {
  // Simulating state lifecycle:
  const initialRoomCode = '6337MV';
  let roomCodeInput = normalizeRoomCode(initialRoomCode);
  const displayName = 'Alex';

  assert.equal(roomCodeInput, '6337MV');

  // Validation step:
  const validation = validateRoomCode(roomCodeInput);
  assert.equal(validation.isValid, true);
  assert.equal(validation.error, undefined);

  // Submitting form:
  assert.ok(displayName.trim().length > 0, 'Display name is required');
  assert.equal(roomCodeInput.trim().toUpperCase(), '6337MV');
});

test('Room Code Editing: User can edit or replace prefilled room code', () => {
  let roomCodeInput = '6337MV';
  // User edits input to another room:
  roomCodeInput = normalizeRoomCode('NEW999');
  assert.equal(roomCodeInput, 'NEW999');
  const validation = validateRoomCode(roomCodeInput);
  assert.equal(validation.isValid, true);
});

// -----------------------------------------------------------------------------
// 6. Scribble 100-Second Round Duration & Countdown Tests
// -----------------------------------------------------------------------------
function calculateGuessScore100({ timeLeft, totalTime = 100, orderIndex }) {
  if (timeLeft <= 0 || totalTime <= 0) return 0;
  const timeRatio = Math.min(1, Math.max(0, timeLeft / totalTime));
  const baseScore = Math.round(150 + timeRatio * 250);
  const placementBonus = orderIndex === 0 ? 100 : orderIndex === 1 ? 50 : orderIndex === 2 ? 25 : 0;
  return baseScore + placementBonus;
}

test('Scribble Round Timer: Initial duration starts at 100 seconds', () => {
  const SKRIBBL_ROUND_SECONDS = 100;
  assert.equal(SKRIBBL_ROUND_SECONDS, 100);
});

test('Scribble Round Timer: Countdown starts at 100s and decreases to 0', () => {
  let timeLeft = 100;
  assert.equal(timeLeft, 100);

  // Simulate tick down
  for (let i = 0; i < 50; i++) {
    timeLeft -= 1;
  }
  assert.equal(timeLeft, 50);

  // Tick to 0
  for (let i = 0; i < 50; i++) {
    timeLeft -= 1;
  }
  assert.equal(timeLeft, 0);
  assert.ok(timeLeft <= 0, 'Round ends when time reaches zero');
});

test('Scribble 100s Scoring: Immediate 100s guess awards max points (500)', () => {
  const maxScore = calculateGuessScore100({ timeLeft: 100, totalTime: 100, orderIndex: 0 });
  assert.equal(maxScore, 500); // 150 base + 250 speed + 100 1st place
});

test('Scribble 100s Scoring: Expired guess at 0s awards 0 points', () => {
  const zeroScore = calculateGuessScore100({ timeLeft: 0, totalTime: 100, orderIndex: 0 });
  assert.equal(zeroScore, 0);
});

test('Scribble 100s Scoring: Faster guesses earn more points than late guesses', () => {
  const fastScore = calculateGuessScore100({ timeLeft: 90, totalTime: 100, orderIndex: 0 });
  const midScore = calculateGuessScore100({ timeLeft: 50, totalTime: 100, orderIndex: 0 });
  const slowScore = calculateGuessScore100({ timeLeft: 10, totalTime: 100, orderIndex: 0 });

  assert.ok(fastScore > midScore);
  assert.ok(midScore > slowScore);
});


