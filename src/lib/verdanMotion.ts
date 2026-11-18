export interface GaugeGeometry {
  radius: number;
  circumference: number;
  arcLength: number;
  filledLength: number;
  dashOffset: number;
  clampedPct: number;
}

export interface SparklineGeometry {
  linePath: string;
  areaPath: string;
  lastPoint: { x: number; y: number };
  points: { x: number; y: number; value: number }[];
}

export interface SegmentedBlock {
  index: number;
  filled: boolean;
  partialRatio: number;
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Computes SVG stroke-dasharray / stroke-dashoffset math for a 220-degree semi-circular
 * radial arc gauge matching the Verdan "Crop health" widget.
 */
export function computeArcGaugeGeometry(pct: number, radius = 64, sweepDegrees = 220): GaugeGeometry {
  const clampedPct = clampPercentage(pct);
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (sweepDegrees / 360);
  const filledLength = arcLength * (clampedPct / 100);
  const dashOffset = arcLength - filledLength;

  return {
    radius,
    circumference,
    arcLength,
    filledLength,
    dashOffset,
    clampedPct,
  };
}

/**
 * Generates smooth cubic-bezier SVG line + closed area paths for sparkline cards
 * such as Avg. NDVI or 7-day execution cadence.
 */
export function computeSparklinePaths(
  values: number[],
  width = 200,
  height = 56,
  padY = 6,
): SparklineGeometry {
  const safeValues = values.length >= 2
    ? values.map((v) => (Number.isFinite(v) ? v : 0))
    : values.length === 1
      ? [values[0] ?? 0, values[0] ?? 0]
      : [0, 0];

  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const span = max - min || 1;
  const usableHeight = Math.max(8, height - padY * 2);

  const points = safeValues.map((value, idx) => {
    const x = safeValues.length === 1 ? width / 2 : (idx / (safeValues.length - 1)) * width;
    const normalized = (value - min) / span;
    const y = height - padY - normalized * usableHeight;
    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      value,
    };
  });

  if (points.length === 0) {
    return {
      linePath: '',
      areaPath: '',
      lastPoint: { x: 0, y: height - padY },
      points: [],
    };
  }

  let linePath = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const midX = Number(((prev.x + curr.x) / 2).toFixed(2));
    linePath += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const areaPath = `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`;

  return {
    linePath,
    areaPath,
    lastPoint: { x: last.x, y: last.y },
    points,
  };
}

/**
 * Splits a completion percentage into discrete glowing zone blocks
 * matching the "Zones irrigated" progress widget.
 */
export function computeSegmentedBlocks(pct: number, totalBlocks = 4): SegmentedBlock[] {
  const count = Math.max(1, Math.floor(totalBlocks));
  const clamped = clampPercentage(pct);
  const exactFilled = (clamped / 100) * count;

  return Array.from({ length: count }, (_, index) => {
    const delta = exactFilled - index;
    const partialRatio = Math.max(0, Math.min(1, delta));
    return {
      index,
      filled: partialRatio >= 0.99,
      partialRatio: Number(partialRatio.toFixed(3)),
    };
  });
}

/**
 * Normalizes bar heights for vertical pill-bar charts and identifies the peak index
 * so it receives the glowing chartreuse accent highlight.
 */
export function computePillBarMetrics(values: number[]): { heightsPct: number[]; peakIndex: number } {
  if (!values.length) return { heightsPct: [], peakIndex: -1 };
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const max = Math.max(...safe);
  if (max <= 0) {
    return {
      heightsPct: safe.map(() => 10),
      peakIndex: 0,
    };
  }

  let peakIndex = 0;
  for (let i = 1; i < safe.length; i++) {
    if (safe[i]! >= safe[peakIndex]!) {
      peakIndex = i;
    }
  }

  const heightsPct = safe.map((v) => Math.max(12, Math.round((v / max) * 100)));
  return { heightsPct, peakIndex };
}
