import React, { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  resolveWatermarkProfile,
  WATERMARK_LOGO_SRC,
  WatermarkVariant,
} from '../lib/brandWatermarkConfig';

interface AmbientBrandWatermarkProps {
  variant?: WatermarkVariant;
}

const TICK_ANGLES = Array.from({ length: 36 }, (_, i) => i * 10);

export default function AmbientBrandWatermark({
  variant = 'workspace',
}: AmbientBrandWatermarkProps) {
  const { theme } = useTheme();
  const [logoLoaded, setLogoLoaded] = useState(true);
  const profile = useMemo(() => resolveWatermarkProfile(theme, variant), [theme, variant]);

  const stageStyle = {
    '--wm-emblem-opacity': String(profile.emblemOpacity),
    '--wm-ring-opacity': String(profile.ringOpacity),
    '--wm-spin-duration': `${profile.spinDurationSec}s`,
    '--wm-outer-duration': `${profile.outerOrbitDurationSec}s`,
    '--wm-inner-duration': `${profile.innerOrbitDurationSec}s`,
    '--wm-breath-duration': `${profile.breathDurationSec}s`,
    '--wm-accent': profile.accentColor,
    '--wm-secondary': profile.secondaryColor,
    '--wm-glow-filter': profile.glowFilter,
  } as React.CSSProperties;

  return (
    <div
      className={`verdan-watermark-stage verdan-watermark-stage--${variant}`}
      data-testid="ambient-brand-watermark"
      data-watermark-variant={variant}
      data-watermark-theme={theme}
      aria-hidden="true"
      style={stageStyle}
    >
      <div className="verdan-watermark-halo" />

      <div className="verdan-watermark-crest">
        {/* Anel orbital externo com marcações de precisão */}
        <svg
          className="verdan-watermark-orbit verdan-watermark-orbit--outer"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle
            cx="200"
            cy="200"
            r="188"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="6 10"
            opacity="0.7"
          />
          <circle
            cx="200"
            cy="200"
            r="176"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity="0.38"
          />
          {TICK_ANGLES.map((angle) => {
            const isMajor = angle % 90 === 0;
            const isMedium = angle % 30 === 0;
            const len = isMajor ? 12 : isMedium ? 8 : 4;
            return (
              <line
                key={angle}
                x1="200"
                y1={12}
                x2="200"
                y2={12 + len}
                stroke="currentColor"
                strokeWidth={isMajor ? 2 : 1.1}
                strokeLinecap="round"
                opacity={isMajor ? 0.95 : isMedium ? 0.65 : 0.35}
                transform={`rotate(${angle} 200 200)`}
              />
            );
          })}
        </svg>

        {/* Anel orbital interno contra-rotativo */}
        <svg
          className="verdan-watermark-orbit verdan-watermark-orbit--inner"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle
            cx="200"
            cy="200"
            r="152"
            stroke="currentColor"
            strokeWidth="1.35"
            strokeDasharray="24 14 6 14"
            opacity="0.72"
          />
          <circle
            cx="200"
            cy="200"
            r="138"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeDasharray="2 8"
            opacity="0.55"
          />
          <circle cx="200" cy="48" r="3.6" fill="currentColor" opacity="0.9" />
          <circle cx="200" cy="352" r="3.6" fill="currentColor" opacity="0.9" />
          <circle cx="48" cy="200" r="2.6" fill="currentColor" opacity="0.65" />
          <circle cx="352" cy="200" r="2.6" fill="currentColor" opacity="0.65" />
        </svg>

        {/* Logotipo grande da empresa girando continuamente no fundo */}
        <div className="verdan-watermark-logo-wrap">
          {logoLoaded ? (
            <img
              src={WATERMARK_LOGO_SRC}
              alt=""
              draggable={false}
              referrerPolicy="no-referrer"
              className="verdan-watermark-logo"
              onError={() => setLogoLoaded(false)}
            />
          ) : (
            <div className="verdan-watermark-fallback">BP</div>
          )}
        </div>
      </div>
    </div>
  );
}
