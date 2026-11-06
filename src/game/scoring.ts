/**
 * Pure scoring and time calculations for AFTERHOURS multiplayer games.
 */

export interface GuessScoreParams {
  timeLeft: number;
  totalTime: number;
  orderIndex: number; // 0 for first correct guess, 1 for second, etc.
}

/**
 * Calculates points for guessing a word in Skribbl.
 * Faster guesses get more points, plus an early-bird rank bonus.
 */
export function calculateGuessScore({ timeLeft, totalTime, orderIndex }: GuessScoreParams): number {
  if (timeLeft <= 0 || totalTime <= 0) return 0;
  
  const timeRatio = Math.min(1, Math.max(0, timeLeft / totalTime));
  // Base score from 150 to 400 depending on speed
  const baseScore = Math.round(150 + timeRatio * 250);
  
  // Placement bonus: 1st +100, 2nd +50, 3rd +25
  const placementBonus = orderIndex === 0 ? 100 : orderIndex === 1 ? 50 : orderIndex === 2 ? 25 : 0;
  
  return baseScore + placementBonus;
}

/**
 * Calculates score awarded to the drawer when players guess their word.
 * Awards bonus when majority of other players successfully guess.
 */
export function calculateDrawerScore(guessersCount: number, totalEligibleGuessers: number): number {
  if (totalEligibleGuessers <= 0 || guessersCount <= 0) return 0;
  
  const ratio = Math.min(1, guessersCount / totalEligibleGuessers);
  return Math.round(ratio * 300);
}

/**
 * Formats seconds into MM:SS display.
 */
export function formatTimeRemaining(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
