import type { Theme } from '../contexts/ThemeContext';

export const WATERMARK_LOGO_SRC = '/logo.png';

export type WatermarkVariant = 'workspace' | 'fullscreen' | 'tv' | 'sidebar';

export interface WatermarkProfile {
  isEmeraldTheme: boolean;
  isLightTheme: boolean;
  emblemOpacity: number;
  ringOpacity: number;
  haloOpacity: number;
  spinDurationSec: number;
  outerOrbitDurationSec: number;
  innerOrbitDurationSec: number;
  breathDurationSec: number;
  accentColor: string;
  secondaryColor: string;
  glowFilter: string;
}

const LIGHT_THEMES = new Set<Theme>(['light', 'rose', 'arctic', 'lavender', 'glass']);
const EMERALD_THEMES = new Set<Theme>(['verdan', 'forest']);

const THEME_HALO_OPACITIES: Record<Theme, number> = {
  verdan: 0.42,
  'black-cyan': 0.34,
  forest: 0.44,
  ocean: 0.36,
  sunset: 0.34,
  midnight: 0.33,
  copper: 0.31,
  dark: 0.32,
  'glassy-v18': 0.28,
  'liquid-glass-v18': 0.26,
  'dashboard-v32': 0.18,
  vitrea: 0.22,
  calda: 0.18,
  glass: 0.25,
  rose: 0.24,
  arctic: 0.23,
  'ios-liquid-glass': 0.34,
  light: 0.22,
  lavender: 0.21,
};

const THEME_PALETTES: Partial<
  Record<Theme, { accentColor: string; secondaryColor: string; glowColor: string }>
> = {
  verdan: { accentColor: '#b7ed40', secondaryColor: '#4ade80', glowColor: 'rgba(183, 237, 64, 0.24)' },
  'black-cyan': { accentColor: '#06b6d4', secondaryColor: '#0284c7', glowColor: 'rgba(6, 182, 212, 0.22)' },
  forest: { accentColor: '#4ade80', secondaryColor: '#22c55e', glowColor: 'rgba(74, 222, 128, 0.24)' },
  ocean: { accentColor: '#22d3ee', secondaryColor: '#38bdf8', glowColor: 'rgba(34, 211, 238, 0.24)' },
  sunset: { accentColor: '#f97316', secondaryColor: '#fbbf24', glowColor: 'rgba(249, 115, 22, 0.22)' },
  midnight: { accentColor: '#818cf8', secondaryColor: '#c084fc', glowColor: 'rgba(129, 140, 248, 0.22)' },
  copper: { accentColor: '#d97706', secondaryColor: '#f59e0b', glowColor: 'rgba(217, 119, 6, 0.20)' },
  'glassy-v18': { accentColor: '#8ca6ef', secondaryColor: '#b4c4ff', glowColor: 'rgba(140, 166, 239, 0.20)' },
  'liquid-glass-v18': { accentColor: '#60a5fa', secondaryColor: '#34d399', glowColor: 'rgba(59, 130, 246, 0.26)' },
  'dashboard-v32': { accentColor: '#f97316', secondaryColor: '#10b981', glowColor: 'rgba(249, 115, 22, 0.22)' },
  vitrea: { accentColor: '#7aaef0', secondaryColor: '#68c0b8', glowColor: 'rgba(122, 174, 240, 0.24)' },
  calda: { accentColor: '#1e9bf0', secondaryColor: '#cbd5e1', glowColor: 'rgba(30, 155, 240, 0.20)' },
  dark: { accentColor: '#4fd1c5', secondaryColor: '#60a5fa', glowColor: 'rgba(79, 209, 197, 0.22)' },
  rose: { accentColor: '#ec4899', secondaryColor: '#f472b6', glowColor: 'rgba(244, 114, 182, 0.18)' },
  arctic: { accentColor: '#0891b2', secondaryColor: '#22d3ee', glowColor: 'rgba(6, 182, 212, 0.18)' },
  lavender: { accentColor: '#7c3aed', secondaryColor: '#a78bfa', glowColor: 'rgba(167, 139, 250, 0.18)' },
  'ios-liquid-glass': { accentColor: '#0A84FF', secondaryColor: '#38BDF8', glowColor: 'rgba(10, 132, 255, 0.24)' },
  glass: { accentColor: '#4f46e5', secondaryColor: '#818cf8', glowColor: 'rgba(99, 102, 241, 0.18)' },
};

export function resolveWatermarkProfile(
  theme: Theme,
  variant: WatermarkVariant = 'workspace',
): WatermarkProfile {
  const isLightTheme = LIGHT_THEMES.has(theme);
  const isEmeraldTheme = EMERALD_THEMES.has(theme);
  const baseHalo = THEME_HALO_OPACITIES[theme] ?? 0.34;
  const variantScale =
    variant === 'fullscreen'
      ? 1.08
      : variant === 'tv'
        ? 1.05
        : variant === 'sidebar'
          ? 0.8
          : 1;
  const haloOpacity = Number((baseHalo * variantScale).toFixed(3));

  const variantBoost =
    variant === 'fullscreen'
      ? 0.015
      : variant === 'tv'
        ? 0.005
        : variant === 'sidebar'
          ? -0.02
          : 0;

  const palette = THEME_PALETTES[theme];

  if (isLightTheme) {
    return {
      isEmeraldTheme: false,
      isLightTheme: true,
      emblemOpacity: Number(Math.max(0.055, 0.08 + variantBoost).toFixed(3)),
      ringOpacity: variant === 'sidebar' ? 0.14 : 0.18,
      haloOpacity,
      spinDurationSec: variant === 'sidebar' ? 42 : 52,
      outerOrbitDurationSec: 72,
      innerOrbitDurationSec: 44,
      breathDurationSec: 12,
      accentColor: palette?.accentColor ?? '#1f6b45',
      secondaryColor: palette?.secondaryColor ?? '#2e8b57',
      glowFilter: `saturate(0.85) drop-shadow(0 0 28px ${palette?.glowColor ?? 'rgba(31, 107, 69, 0.18)'})`,
    };
  }

  if (isEmeraldTheme) {
    return {
      isEmeraldTheme: true,
      isLightTheme: false,
      emblemOpacity: Number(Math.max(0.11, 0.145 + variantBoost).toFixed(3)),
      ringOpacity: variant === 'sidebar' ? 0.24 : 0.28,
      haloOpacity,
      spinDurationSec: variant === 'sidebar' ? 40 : 48,
      outerOrbitDurationSec: 68,
      innerOrbitDurationSec: 40,
      breathDurationSec: 10,
      accentColor: palette?.accentColor ?? '#b7ed40',
      secondaryColor: palette?.secondaryColor ?? '#4ade80',
      glowFilter:
        `saturate(0.9) brightness(0.98) drop-shadow(0 0 42px ${palette?.glowColor ?? 'rgba(183, 237, 64, 0.24)'})`,
    };
  }

  return {
    isEmeraldTheme: false,
    isLightTheme: false,
    emblemOpacity: Number((0.12 + variantBoost).toFixed(3)),
    ringOpacity: variant === 'sidebar' ? 0.19 : 0.22,
    haloOpacity,
    spinDurationSec: variant === 'sidebar' ? 42 : 50,
    outerOrbitDurationSec: 70,
    innerOrbitDurationSec: 42,
    breathDurationSec: 11,
    accentColor: palette?.accentColor ?? '#4ade80',
    secondaryColor: palette?.secondaryColor ?? '#94a3b8',
    glowFilter:
      `saturate(0.86) brightness(0.95) drop-shadow(0 0 36px ${palette?.glowColor ?? 'rgba(74, 222, 128, 0.2)'})`,
  };
}
