export interface RgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3.0;
export const WCAG_AAA_NORMAL = 7.0;

function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, value));
}

function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function parseCssColor(input: string): RgbColor {
  const raw = input.trim().toLowerCase();
  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    throw new Error(`Invalid hex color: ${input}`);
  }

  const fnMatch = raw.match(/^rgba?\((.+)\)$/);
  if (fnMatch) {
    const body = fnMatch[1].replace(/\//g, ',').trim();
    const parts = body.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) {
      throw new Error(`Invalid rgb/rgba color: ${input}`);
    }
    const r = clampChannel(parseFloat(parts[0]));
    const g = clampChannel(parseFloat(parts[1]));
    const b = clampChannel(parseFloat(parts[2]));
    const a = parts.length === 4 ? clampAlpha(parseFloat(parts[3])) : 1;
    return { r, g, b, a };
  }

  throw new Error(`Unsupported color format: ${input}`);
}

export function compositeOver(foreground: RgbColor, background: RgbColor): RgbColor {
  const alpha = clampAlpha(foreground.a);
  const bgAlpha = clampAlpha(background.a);
  const outAlpha = alpha + bgAlpha * (1 - alpha);
  if (outAlpha === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const r = (foreground.r * alpha + background.r * bgAlpha * (1 - alpha)) / outAlpha;
  const g = (foreground.g * alpha + background.g * bgAlpha * (1 - alpha)) / outAlpha;
  const b = (foreground.b * alpha + background.b * bgAlpha * (1 - alpha)) / outAlpha;
  return { r, g, b, a: outAlpha };
}

function linearizeChannel(channel255: number): number {
  const srgb = clampChannel(channel255) / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(color: RgbColor): number {
  const r = linearizeChannel(color.r);
  const g = linearizeChannel(color.g);
  const b = linearizeChannel(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foregroundCss: string, backgroundCss: string, backdropCss?: string): number {
  const bgParsed = parseCssColor(backgroundCss);
  const effectiveBg = bgParsed.a < 1 && backdropCss
    ? compositeOver(bgParsed, parseCssColor(backdropCss))
    : bgParsed;

  const fgParsed = parseCssColor(foregroundCss);
  const effectiveFg = fgParsed.a < 1
    ? compositeOver(fgParsed, effectiveBg)
    : fgParsed;

  const l1 = relativeLuminance(effectiveFg);
  const l2 = relativeLuminance(effectiveBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function meetsWcagAA(ratio: number, isLargeText = false): boolean {
  return ratio >= (isLargeText ? WCAG_AA_LARGE : WCAG_AA_NORMAL);
}

export interface ThemeSurfaceAuditInput {
  theme: string;
  backdrop: string;
  bgCard: string;
  glassCardStop: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
}

export interface ThemeSurfaceAuditResult {
  theme: string;
  primaryOnCard: number;
  secondaryOnCard: number;
  secondaryOnGlass: number;
  tertiaryOnGlass: number;
  mutedOnCard: number;
  mutedOnGlass: number;
  allPassAA: boolean;
}

export function auditThemeSurfaceContrast(input: ThemeSurfaceAuditInput): ThemeSurfaceAuditResult {
  const primaryOnCard = contrastRatio(input.textPrimary, input.bgCard, input.backdrop);
  const secondaryOnCard = contrastRatio(input.textSecondary, input.bgCard, input.backdrop);
  const secondaryOnGlass = contrastRatio(input.textSecondary, input.glassCardStop, input.backdrop);
  const tertiaryOnGlass = contrastRatio(input.textTertiary, input.glassCardStop, input.backdrop);
  const mutedOnCard = contrastRatio(input.textMuted, input.bgCard, input.backdrop);
  const mutedOnGlass = contrastRatio(input.textMuted, input.glassCardStop, input.backdrop);

  const allPassAA = [
    primaryOnCard,
    secondaryOnCard,
    secondaryOnGlass,
    tertiaryOnGlass,
    mutedOnCard,
    mutedOnGlass,
  ].every((ratio) => meetsWcagAA(ratio));

  return {
    theme: input.theme,
    primaryOnCard,
    secondaryOnCard,
    secondaryOnGlass,
    tertiaryOnGlass,
    mutedOnCard,
    mutedOnGlass,
    allPassAA,
  };
}
