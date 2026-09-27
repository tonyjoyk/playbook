/** Project tuned params (CLAUDE.md / folk-art grader). */
export const VTRACER_CONFIG = {
  binary: false,
  mode: 'spline' as const,
  hierarchical: 'stacked' as const,
  filterSpeckle: 8,
  colorPrecision: 6,
  layerDifference: 16,
  cornerThreshold: 70,
  spliceThreshold: 45,
  lengthThreshold: 4,
  maxIterations: 10,
  pathPrecision: 8,
};

/** Scene trace uses cut-out mode for separable objects (J2). */
export const SCENE_VTRACER_CONFIG = {
  ...VTRACER_CONFIG,
  hierarchical: 'cutout' as const,
};

/** Only downscale when long edge exceeds this (avoids worker OOM on huge uploads). */
export const MAX_TRACE_EDGE = 4096;
