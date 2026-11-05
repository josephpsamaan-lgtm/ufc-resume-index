import { describe, expect, it } from "vitest";
import {
  calculateFighterScore,
  countUniqueOpponents,
  isEligibleForRanking,
  validateCareerScore,
  validateFightScore
} from "./scoring.js";

const bout = {
  opponentQuality: 24,
  opponentForm: 8,
  outcomeQuality: 18,
  finishTiming: 7,
  context: 5
};
const career = {
  qualityOfWins: 8,
  championshipResume: 5,
  consistency: 5,
  qualityOfLosses: 2
};

describe("V2.5 scoring arithmetic", () => {
  it("validates fight components against the published caps", () => {
    expect(validateFightScore(bout).total).toBe(62);
    expect(() => validateFightScore({ ...bout, context: 6 })).toThrow();
  });

  it("validates career components against the 25-point cap", () => {
    expect(validateCareerScore(career).total).toBe(20);
    expect(() => validateCareerScore({ ...career, qualityOfLosses: 4 })).toThrow();
  });

  it("averages fight scores before adding career-level score", () => {
    const result = calculateFighterScore({ fights: [bout, { ...bout, outcomeQuality: 14 }], career });
    expect(result.averageFightScore).toBe(60);
    expect(result.finalScore).toBe(80);
  });

  it("does not award additional score merely for fight volume", () => {
    const one = calculateFighterScore({ fights: [bout], career });
    const repeated = calculateFighterScore({ fights: [bout, bout, bout], career });
    expect(repeated.finalScore).toBe(one.finalScore);
  });
});

describe("eligibility gatekeeper", () => {
  it("allows a fighter after three completed UFC bouts", () => {
    expect(isEligibleForRanking({ completedUfcBouts: 3 })).toBe(true);
  });

  it("allows the narrow debut-win over a Top 15 exception", () => {
    expect(isEligibleForRanking({
      completedUfcBouts: 1, debutResult: "win", debutOpponentTop15AtFight: true
    })).toBe(true);
  });

  it("rejects other fighters before the fourth UFC bout, except the debut case", () => {
    expect(isEligibleForRanking({ completedUfcBouts: 2 })).toBe(false);
    expect(isEligibleForRanking({ completedUfcBouts: 2, debutResult: "win", debutOpponentTop15AtFight: true })).toBe(false);
    expect(isEligibleForRanking({
      completedUfcBouts: 1, debutResult: "loss", debutOpponentTop15AtFight: true
    })).toBe(false);
  });
});

it("counts unique opponents separately from individual fights", () => {
  expect(countUniqueOpponents([
    { opponentId: "a" }, { opponentId: "a" }, { opponentId: "b" }
  ])).toBe(2);
});
