export interface CardTiltRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CardTiltOptions {
  maxTiltDeg?: number;
  scale?: number;
  glareMaxOpacity?: number;
  translateY?: number;
}

export interface CardTiltResult {
  rotateX: number;
  rotateY: number;
  scale: number;
  translateY: number;
  glareX: number;
  glareY: number;
  glareOpacity: number;
}

export const DEFAULT_CARD_TILT_OPTIONS: Required<CardTiltOptions> = {
  maxTiltDeg: 5,
  scale: 1.012,
  glareMaxOpacity: 0.16,
  translateY: -3,
};

export const NEUTRAL_CARD_TILT: CardTiltResult = {
  rotateX: 0,
  rotateY: 0,
  scale: 1,
  translateY: 0,
  glareX: 50,
  glareY: 50,
  glareOpacity: 0,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

export function calculateCardTilt(
  clientX: number,
  clientY: number,
  rect: CardTiltRect,
  options: CardTiltOptions = {},
): CardTiltResult {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || rect.width <= 0 || rect.height <= 0) {
    return NEUTRAL_CARD_TILT;
  }

  const maxTiltDeg = options.maxTiltDeg ?? DEFAULT_CARD_TILT_OPTIONS.maxTiltDeg;
  const scale = options.scale ?? DEFAULT_CARD_TILT_OPTIONS.scale;
  const glareMaxOpacity = options.glareMaxOpacity ?? DEFAULT_CARD_TILT_OPTIONS.glareMaxOpacity;
  const translateY = options.translateY ?? DEFAULT_CARD_TILT_OPTIONS.translateY;

  const relX = clamp((clientX - rect.left) / rect.width, 0, 1);
  const relY = clamp((clientY - rect.top) / rect.height, 0, 1);

  const nx = relX * 2 - 1;
  const ny = relY * 2 - 1;

  // Pressing top edge tilts top back (positive rotateX); pressing right edge tilts right back (positive rotateY)
  const rotateX = round(-ny * maxTiltDeg, 3);
  const rotateY = round(nx * maxTiltDeg, 3);
  const glareX = round(relX * 100, 2);
  const glareY = round(relY * 100, 2);
  const edgeDistance = Math.min(1, Math.hypot(nx, ny) / Math.SQRT2);
  const glareOpacity = round(glareMaxOpacity * (0.4 + 0.6 * edgeDistance), 3);

  return {
    rotateX,
    rotateY,
    scale,
    translateY,
    glareX,
    glareY,
    glareOpacity,
  };
}

const SUPPRESSED_TILT_TAGS = new Set(['SELECT', 'OPTION', 'INPUT', 'TEXTAREA']);

export function shouldSuppressTiltTarget(tagName: string | null | undefined): boolean {
  if (!tagName) return false;
  return SUPPRESSED_TILT_TAGS.has(tagName.toUpperCase());
}
