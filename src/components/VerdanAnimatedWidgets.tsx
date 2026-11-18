import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  computeArcGaugeGeometry,
  computePillBarMetrics,
  computeSegmentedBlocks,
  computeSparklinePaths,
} from '../lib/verdanMotion';

interface CountUpProps {
  value: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
}

export function VerdanCountUp({ value, suffix = '', durationMs = 750, className = '' }: CountUpProps) {
  const target = Number.isFinite(value) ? Math.round(value) : 0;
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDisplay(target);
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || durationMs <= 0) {
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const startVal = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (target - startVal) * eased));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [target, durationMs]);

  return (
    <span className={`tabular-nums ${className}`}>
      {display.toLocaleString('pt-BR')}
      {suffix}
    </span>
  );
}

interface RadialGaugeProps {
  valuePct: number;
  label?: string;
  subtitle?: string;
  size?: number;
}

export function VerdanRadialGauge({
  valuePct,
  label = 'HOJE',
  subtitle,
  size = 186,
}: RadialGaugeProps) {
  const gradId = useId().replace(/:/g, '');
  const [animatedPct, setAnimatedPct] = useState(0);

  useEffect(() => {
    const raf = typeof window !== 'undefined'
      ? window.requestAnimationFrame(() => setAnimatedPct(valuePct))
      : 0;
    if (!raf) setAnimatedPct(valuePct);
    return () => {
      if (raf && typeof window !== 'undefined') window.cancelAnimationFrame(raf);
    };
  }, [valuePct]);

  const strokeWidth = 13;
  const radius = 64;
  const sweep = 220;
  const geom = useMemo(() => computeArcGaugeGeometry(animatedPct, radius, sweep), [animatedPct]);
  const center = 84;
  // Rotate so the 220-degree arc sits symmetrically across the top (-200deg = bottom-left to bottom-right)
  const rotation = 160;

  return (
    <div className="verdan-gauge" style={{ width: size }}>
      <svg
        viewBox="0 0 168 134"
        className="verdan-gauge__svg"
        role="img"
        aria-label={`Taxa de conclusão: ${Math.round(geom.clampedPct)}%`}
      >
        <defs>
          <linearGradient id={`verdan-arc-${gradId}`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#65d957" />
            <stop offset="55%" stopColor="#b7ed40" />
            <stop offset="100%" stopColor="#d9fb7a" />
          </linearGradient>
          <filter id={`verdan-glow-${gradId}`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle radial ticks */}
        <circle
          cx={center}
          cy={center}
          r={radius - 14}
          fill="none"
          stroke="rgba(210, 238, 185, 0.14)"
          strokeWidth={1.5}
          strokeDasharray="2 7"
          strokeDashoffset={0}
          transform={`rotate(${rotation} ${center} ${center})`}
          style={{
            strokeDasharray: `${(geom.arcLength * 0.78)} ${geom.circumference}`,
          }}
        />

        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(208, 236, 182, 0.11)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${geom.arcLength} ${geom.circumference}`}
          transform={`rotate(${rotation} ${center} ${center})`}
        />

        {/* Animated Chartreuse Value Arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#verdan-arc-${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${geom.arcLength} ${geom.circumference}`}
          strokeDashoffset={geom.dashOffset}
          transform={`rotate(${rotation} ${center} ${center})`}
          filter={`url(#verdan-glow-${gradId})`}
          className="verdan-gauge__arc"
        />

        {/* Center Readout */}
        <text
          x={center}
          y={center + 2}
          textAnchor="middle"
          className="verdan-gauge__value"
        >
          {Math.round(geom.clampedPct)}%
        </text>
        <text
          x={center}
          y={center + 22}
          textAnchor="middle"
          className="verdan-gauge__label"
        >
          {label}
        </text>
      </svg>
      {subtitle && <p className="verdan-gauge__subtitle">{subtitle}</p>}
    </div>
  );
}

interface SparklineCardProps {
  title: string;
  value: number;
  unit?: string;
  badge?: string;
  badgeTone?: 'lime' | 'amber' | 'sky' | 'coral';
  series: number[];
  icon?: React.ReactNode;
}

export function VerdanSparklineCard({
  title,
  value,
  unit = '',
  badge,
  badgeTone = 'lime',
  series,
  icon,
}: SparklineCardProps) {
  const gradId = useId().replace(/:/g, '');
  const geom = useMemo(() => computeSparklinePaths(series, 220, 52, 6), [series]);

  return (
    <div className="verdan-widget-card verdan-stagger-item">
      <div className="verdan-widget-card__head">
        <span className="verdan-widget-card__title">{title}</span>
        {icon && <span className="verdan-widget-card__icon">{icon}</span>}
      </div>
      <div className="verdan-widget-card__metric-row">
        <div className="verdan-widget-card__metric">
          <VerdanCountUp value={value} />
          {unit && <span className="verdan-widget-card__unit">{unit}</span>}
        </div>
        {badge && (
          <span className={`verdan-chip verdan-chip--${badgeTone}`}>{badge}</span>
        )}
      </div>
      <svg
        viewBox="0 0 220 52"
        className="verdan-sparkline"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`verdan-spark-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b7ed40" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#b7ed40" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={geom.areaPath} fill={`url(#verdan-spark-${gradId})`} className="verdan-sparkline__area" />
        <path
          d={geom.linePath}
          fill="none"
          stroke="#b7ed40"
          strokeWidth="2.4"
          strokeLinecap="round"
          className="verdan-sparkline__line"
        />
        <circle
          cx={geom.lastPoint.x}
          cy={geom.lastPoint.y}
          r="4"
          fill="#d9fb7a"
          className="verdan-sparkline__dot"
        />
      </svg>
    </div>
  );
}

interface SegmentedProgressProps {
  pct: number;
  blocks?: number;
  label?: string;
}

export function VerdanSegmentedProgress({ pct, blocks = 6, label }: SegmentedProgressProps) {
  const segments = useMemo(() => computeSegmentedBlocks(pct, blocks), [pct, blocks]);

  return (
    <div className="verdan-segments" aria-label={label ?? `Progresso ${Math.round(pct)}%`}>
      <div className="verdan-segments__track">
        {segments.map((seg) => (
          <div
            key={seg.index}
            className={`verdan-segments__block ${seg.partialRatio > 0 ? 'is-lit' : ''}`}
            style={{ '--seg-delay': `${seg.index * 70}ms` } as React.CSSProperties}
          >
            <div
              className="verdan-segments__fill"
              style={{ width: `${Math.round(seg.partialRatio * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface LollipopStripProps {
  title: string;
  value: number;
  badge?: string;
  items: { label: string; active: boolean; count: number }[];
  icon?: React.ReactNode;
}

export function VerdanLollipopStrip({ title, value, badge, items, icon }: LollipopStripProps) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="verdan-widget-card verdan-stagger-item">
      <div className="verdan-widget-card__head">
        <span className="verdan-widget-card__title">{title}</span>
        {icon && <span className="verdan-widget-card__icon">{icon}</span>}
      </div>
      <div className="verdan-widget-card__metric-row">
        <div className="verdan-widget-card__metric">
          <VerdanCountUp value={value} />
        </div>
        {badge && <span className="verdan-chip verdan-chip--lime">{badge}</span>}
      </div>
      <div className="verdan-lollipops" aria-hidden="true">
        {items.slice(0, 8).map((item, idx) => {
          const stemPct = Math.max(24, Math.round((item.count / max) * 100));
          return (
            <div
              key={item.label}
              className={`verdan-lollipop ${item.active ? 'is-active' : ''}`}
              style={{ '--lol-delay': `${idx * 55}ms` } as React.CSSProperties}
              title={`${item.label}: ${item.count}`}
            >
              <div className="verdan-lollipop__stem-wrap">
                <span className="verdan-lollipop__dot" />
                <span className="verdan-lollipop__stem" style={{ height: `${stemPct}%` }} />
              </div>
              <span className="verdan-lollipop__label">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PillBarChartProps {
  data: { label: string; value: number }[];
  unit?: string;
}

export function VerdanPillBarChart({ data, unit = 'ord.' }: PillBarChartProps) {
  const { heightsPct, peakIndex } = useMemo(
    () => computePillBarMetrics(data.map((d) => d.value)),
    [data],
  );

  return (
    <div className="verdan-pill-bars" role="img" aria-label="Distribuição mensal de ordens">
      {data.map((item, idx) => {
        const isPeak = idx === peakIndex && item.value > 0;
        const heightPct = heightsPct[idx] ?? 12;
        return (
          <div
            key={item.label}
            className={`verdan-pill-bar ${isPeak ? 'is-peak' : ''}`}
            style={{ '--bar-delay': `${idx * 65}ms` } as React.CSSProperties}
          >
            {isPeak && (
              <div className="verdan-pill-bar__callout">
                {item.label} · {item.value} {unit}
              </div>
            )}
            <div className="verdan-pill-bar__rail">
              <div
                className="verdan-pill-bar__fill"
                style={{ height: `${heightPct}%` }}
                title={`${item.label}: ${item.value} ${unit}`}
              />
            </div>
            <span className="verdan-pill-bar__axis">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
