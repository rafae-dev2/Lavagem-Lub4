import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPercentage,
  computeArcGaugeGeometry,
  computePillBarMetrics,
  computeSegmentedBlocks,
  computeSparklinePaths,
} from '../src/lib/verdanMotion.ts';

describe('verdanMotion geometry & normalization helpers', () => {
  it('clamps percentage safely including NaN and out-of-range values', () => {
    assert.equal(clampPercentage(-15), 0);
    assert.equal(clampPercentage(142), 100);
    assert.equal(clampPercentage(Number.NaN), 0);
    assert.equal(clampPercentage(76.5), 76.5);
  });

  it('computes arc gauge dashoffset accurately for 0%, 50%, and 100%', () => {
    const empty = computeArcGaugeGeometry(0, 64, 220);
    assert.equal(empty.clampedPct, 0);
    assert.equal(empty.filledLength, 0);
    assert.equal(empty.dashOffset, empty.arcLength);

    const half = computeArcGaugeGeometry(50, 64, 220);
    assert.ok(Math.abs(half.dashOffset - half.arcLength / 2) < 0.001);

    const full = computeArcGaugeGeometry(100, 64, 220);
    assert.ok(Math.abs(full.dashOffset) < 0.001);
  });

  it('generates valid SVG line and closed area paths for sparklines', () => {
    const geom = computeSparklinePaths([10, 22, 16, 30], 200, 52, 6);
    assert.equal(geom.points.length, 4);
    assert.ok(geom.linePath.startsWith('M 0 '));
    assert.ok(geom.linePath.includes(' C '));
    assert.ok(geom.areaPath.endsWith('Z'));
    assert.equal(geom.lastPoint.x, 200);
    assert.equal(geom.lastPoint.y, 6);

    const single = computeSparklinePaths([5], 120, 40, 4);
    assert.equal(single.points.length, 2);
    assert.ok(single.linePath.startsWith('M '));
  });

  it('splits completion percentage into discrete zone blocks cleanly', () => {
    const blocks = computeSegmentedBlocks(75, 4);
    assert.equal(blocks.length, 4);
    assert.equal(blocks[0]?.filled, true);
    assert.equal(blocks[1]?.filled, true);
    assert.equal(blocks[2]?.filled, true);
    assert.equal(blocks[3]?.filled, false);
    assert.equal(blocks[3]?.partialRatio, 0);

    const partial = computeSegmentedBlocks(50, 4);
    assert.equal(partial[1]?.filled, true);
    assert.equal(partial[2]?.partialRatio, 0);
  });

  it('normalizes pill bar heights and identifies the peak bar index', () => {
    const res = computePillBarMetrics([12, 42, 28, 19]);
    assert.equal(res.peakIndex, 1);
    assert.equal(res.heightsPct[1], 100);
    assert.ok((res.heightsPct[0] ?? 0) >= 12 && (res.heightsPct[0] ?? 0) < 100);

    const empty = computePillBarMetrics([]);
    assert.equal(empty.peakIndex, -1);
    assert.deepEqual(empty.heightsPct, []);
  });
});
