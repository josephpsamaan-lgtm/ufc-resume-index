/**
 * UFC Résumé Index — V2.5 scoring core
 *
 * This module performs deterministic arithmetic and input validation.
 * It deliberately does NOT infer historical rankings, opponent form, injuries,
 * title status, or any other evidence-sensitive inputs. Those must be supplied
 * with source evidence and reviewed by an administrator.
 */

export const V25_LIMITS = Object.freeze({
  opponentQuality: 34,
  opponentForm: 11,
  outcomeQuality: 18,
  finishTiming: 7,
  context: 5,
  career: Object.freeze({
    qualityOfWins: 10,
    championshipResume: 6,
    consistency: 6,
    qualityOfLosses: 3
  })
});

export const ELIGIBILITY = Object.freeze({
  minimumCompletedUfcBoutsBeforeFourth: 3,
  debutTop15Exception: true
});

const numberInRange = (value, min, max, label) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new RangeError(`${label} must be a number from ${min} to ${max}.`);
  }
  return n;
};

export function validateFightScore(input) {
  const parts = {
    opponentQuality: numberInRange(input.opponentQuality, 0, V25_LIMITS.opponentQuality, "Opponent quality"),
    opponentForm: numberInRange(input.opponentForm, 0, V25_LIMITS.opponentForm, "Opponent form"),
    outcomeQuality: numberInRange(input.outcomeQuality, 0, V25_LIMITS.outcomeQuality, "Outcome quality"),
    finishTiming: numberInRange(input.finishTiming, 0, V25_LIMITS.finishTiming, "Finish timing"),
    context: numberInRange(input.context, 0, V25_LIMITS.context, "Context")
  };
  return { ...parts, total: Object.values(parts).reduce((sum, n) => sum + n, 0) };
}

export function validateCareerScore(input) {
  const parts = {
    qualityOfWins: numberInRange(input.qualityOfWins, 0, 10, "Quality of wins"),
    championshipResume: numberInRange(input.championshipResume, 0, 6, "Championship résumé"),
    consistency: numberInRange(input.consistency, 0, 6, "Consistency"),
    qualityOfLosses: numberInRange(input.qualityOfLosses, 0, 3, "Quality of losses")
  };
  return { ...parts, total: Object.values(parts).reduce((sum, n) => sum + n, 0) };
}

/**
 * Eligibility gatekeeper for a fighter entering their fourth UFC bout.
 * The only exception is a UFC debut victory over an opponent who was Top 15
 * at the time of that bout. Callers must supply verified historical rank data.
 */
export function isEligibleForRanking({ completedUfcBouts = 0, debutResult, debutOpponentTop15AtFight }) {
  if (completedUfcBouts >= ELIGIBILITY.minimumCompletedUfcBoutsBeforeFourth) return true;
  return ELIGIBILITY.debutTop15Exception === true
    && completedUfcBouts === 1
    && debutResult === "win"
    && debutOpponentTop15AtFight === true;
}

/**
 * Each UFC bout is scored independently (maximum 75). Final score is the
 * arithmetic mean of the fighter's individual bout scores plus career score
 * (maximum 25). More fights do not mechanically increase the average.
 */
export function calculateFighterScore({ fights, career }) {
  if (!Array.isArray(fights) || fights.length === 0) {
    throw new Error("At least one scored UFC fight is required.");
  }
  const validatedFights = fights.map(validateFightScore);
  const validatedCareer = validateCareerScore(career);
  const averageFightScore = validatedFights.reduce((sum, fight) => sum + fight.total, 0) / validatedFights.length;
  const finalScore = averageFightScore + validatedCareer.total;

  if (finalScore < 0 || finalScore > 100) {
    throw new RangeError("Calculated final score falls outside the 0–100 model.");
  }

  return {
    fightCount: validatedFights.length,
    fights: validatedFights,
    averageFightScore,
    career: validatedCareer,
    finalScore
  };
}

/** Count distinct opponents for résumé-breadth reporting, not fight-level credit. */
export function countUniqueOpponents(fights) {
  return new Set(fights.map(f => String(f.opponentId ?? f.opponentName ?? "").trim().toLowerCase()).filter(Boolean)).size;
}
