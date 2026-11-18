import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveWatermarkProfile,
  WATERMARK_LOGO_SRC,
} from '../src/lib/brandWatermarkConfig';

test('WATERMARK_LOGO_SRC points to transparent company emblem asset', () => {
  assert.equal(WATERMARK_LOGO_SRC, '/logo.png');
});

test('verdan and forest themes use emerald profile with balanced readable opacity', () => {
  const verdan = resolveWatermarkProfile('verdan', 'workspace');
  assert.equal(verdan.isEmeraldTheme, true);
  assert.equal(verdan.isLightTheme, false);
  assert.equal(verdan.accentColor, '#b7ed40');
  assert.ok(verdan.emblemOpacity >= 0.1 && verdan.emblemOpacity <= 0.22);
  assert.ok(verdan.spinDurationSec > 0);
  assert.ok(verdan.outerOrbitDurationSec > 0);
  assert.ok(verdan.innerOrbitDurationSec > 0);

  const forest = resolveWatermarkProfile('forest', 'fullscreen');
  assert.equal(forest.isEmeraldTheme, true);
  assert.ok(forest.emblemOpacity > verdan.emblemOpacity);
});

test('light themes soften watermark opacity so foreground contrast stays crisp', () => {
  const light = resolveWatermarkProfile('light', 'workspace');
  const verdan = resolveWatermarkProfile('verdan', 'workspace');
  assert.equal(light.isLightTheme, true);
  assert.ok(light.emblemOpacity < verdan.emblemOpacity);
  assert.ok(light.emblemOpacity >= 0.05);
});

test('tv and sidebar variants adapt cleanly while keeping continuous rotation durations', () => {
  const tv = resolveWatermarkProfile('verdan', 'tv');
  assert.equal(tv.isEmeraldTheme, true);
  assert.ok(tv.emblemOpacity >= 0.14);
  assert.ok(tv.spinDurationSec >= 30);

  const sidebar = resolveWatermarkProfile('verdan', 'sidebar');
  assert.equal(sidebar.isEmeraldTheme, true);
  assert.ok(sidebar.emblemOpacity >= 0.1 && sidebar.emblemOpacity <= 0.14);
  assert.ok(sidebar.spinDurationSec >= 30);
});

test('ocean, forest, sunset and light themes carry tailored halo intensities and palettes', () => {
  const ocean = resolveWatermarkProfile('ocean', 'workspace');
  const forest = resolveWatermarkProfile('forest', 'workspace');
  const sunset = resolveWatermarkProfile('sunset', 'workspace');
  const rose = resolveWatermarkProfile('rose', 'workspace');

  assert.equal(ocean.accentColor, '#22d3ee');
  assert.equal(ocean.haloOpacity, 0.36);
  assert.equal(forest.accentColor, '#4ade80');
  assert.equal(forest.haloOpacity, 0.44);
  assert.equal(sunset.accentColor, '#f97316');
  assert.equal(sunset.haloOpacity, 0.34);
  assert.equal(rose.haloOpacity, 0.24);
  assert.ok(forest.haloOpacity > ocean.haloOpacity);
  assert.ok(ocean.haloOpacity > rose.haloOpacity);

  const blackCyan = resolveWatermarkProfile('black-cyan', 'workspace');
  assert.equal(blackCyan.isLightTheme, false);
  assert.equal(blackCyan.isEmeraldTheme, false);
  assert.equal(blackCyan.accentColor, '#06b6d4');
  assert.equal(blackCyan.secondaryColor, '#0284c7');
  assert.equal(blackCyan.haloOpacity, 0.34);
});

