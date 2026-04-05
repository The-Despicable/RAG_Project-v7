export const SAFETY_CONFIG_V1 = {
  version: "V1",
  thresholds: {
    strong: 0.85,
    moderate: 0.7,
    weak: 0.5
  },
  weights: {
    groundedness: 0.5,
    retrieval: 0.3,
    citations: 0.2
  }
};

export const SAFETY_CONFIG_V2 = {
  version: "V2",
  thresholds: {
    strong: 0.82,
    moderate: 0.66,
    weak: 0.48
  },
  weights: {
    groundedness: 0.58,
    retrieval: 0.27,
    citations: 0.15
  }
};

export const ACTIVE_CONFIG = SAFETY_CONFIG_V1;
