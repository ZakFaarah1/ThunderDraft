/**
 * Stores every adjustable recommendation scoring weight.
 *
 * Change these values later to make ThunderDraft more
 * aggressive, conservative, position-focused, or ADP-focused.
 */
export const recommendationWeights = {
  /*
   * Base player-value scoring.
   */
  baseScore: 120,
  overallRankPenalty: 2,
  maximumTierBonus: 18,
  tierBonusReduction: 5,
  maximumPositionRankBonus: 10,

  /*
   * Starter and roster-depth bonuses.
   */
  rbWrStarterNeedBonus: 28,
  qbTeStarterNeedBonus: 22,
  kickerDefenseStarterNeedBonus: 6,
  flexDepthBonus: 10,

  /*
   * Duplicate-position penalties.
   */
  duplicateQuarterbackPenalty: 12,
  extraTightEndPenalty: 10,

  /*
   * Early-draft kicker and defense rules.
   */
  earlyKickerDefensePenalty: 30,
  earlyKickerDefensePickThreshold: 10,

  /*
   * Next-turn urgency scoring.
   */
  fallingPlayerBonus: 18,
  nextTurnBaseBonus: 10,
  nextTurnDistanceMultiplier: 0.75,
  maximumNextTurnBonus: 22,
  nearNextTurnBonus: 4,
  nearNextTurnRange: 3,
  lowRankUrgencyCap: 6,
  lowRankUrgencyBuffer: 8,

  /*
   * Positional-run scoring.
   */
  acceleratingRunMinimum: 4,
  acceleratingRunBonus: 10,
  developingRunMinimum: 3,
  developingRunBonus: 7,
  risingDemandMinimum: 2,
  risingDemandBonus: 4,
  risingDemandPickThreshold: 8,
  recentDraftWindowSize: 6,

  /*
   * Positional tier-drop scoring.
   */
  lastPositionBonus: 14,
  tierDropBaseBonus: 10,
  tierDropRankMultiplier: 0.5,
  maximumTierDropBonus: 16,
  majorRankDropMinimum: 8,
  majorRankDropMultiplier: 0.75,
  maximumMajorRankDropBonus: 12,

  /*
   * Market ADP value scoring.
   */
  marketAdvantageMinimum: 4,
  marketAdvantageMultiplier: 0.5,
  maximumMarketAdvantageBonus: 10,
    /*
   * Adaptive roster-health scoring.
   */
  weakestPositionBonus: 14,
  secondaryWeakPositionBonus: 8,
  rosterIssuePriorityMultiplier: 0.25,
  maximumRosterHealthBonus: 24,
  flexHealthBonus: 6,
} as const;