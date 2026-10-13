/** Release bounds from specs/config.json and D08. */
export const LIMITS = {
  maximumGroups: 20,
  coalitionMin: 2,
  coalitionMax: 4,
  maximumExperiences: 10,
  maximumSlotsPerExperience: 5,
  maximumAnchorUniverse: 30,
  maximumAlternatives: 3,
  culturalMinWeight: 0.7,
  culturalMeanWeight: 0.3,
} as const;
