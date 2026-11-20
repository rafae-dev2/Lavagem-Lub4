import EquipmentThumbnail from '../components/EquipmentThumbnail';
import { getCardTiltProps } from '../hooks/useCardTilt';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, RadialBarChart, RadialBar
} from 'recharts';
import { Programacao, DashboardStats } from '../types';
import StatusBadge from '../components/StatusBadge';
import DashboardFocusModal from '../components/DashboardFocusModal';
import {
  getAdjacentFocusOrder,
  type DashboardFocusContext,
} from '../lib/dashboardFocusMode';
import {
  AlertTriangle, Calendar, CheckCircle2, Clock,
  TrendingUp, Wrench, Activity, BarChart2, Zap,
  Download, FileImage, FileText, ChevronDown, Maximize2
} from 'lucide-react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '../contexts/ThemeContext';
import AlertasEquipamentos from '../components/AlertasEquipamentos';
import {
  VerdanCountUp,
  VerdanPillBarChart,
  VerdanRadialGauge,
  VerdanSegmentedProgress,
} from '../components/VerdanAnimatedWidgets';

interface Props {
  schedules: Programacao[];
  allSchedules?: Programacao[];
  stats: DashboardStats;
  loading: boolean;
  error: string | null;
}

type DashExportTheme = 'light' | 'dark' | 'navy' | 'slate';

const DASH_THEMES: { key: DashExportTheme; label: string; accent: string }[] = [
  { key: 'light', label: '☀️ Claro',  accent: '#16a34a' },
  { key: 'dark',  label: '🌙 Dark',   accent: '#00ff88' },
  { key: 'navy',  label: '🌊 Navy',   accent: '#22d3ee' },
  { key: 'slate', label: '🪨 Slate',  accent: '#a78bfa' },
];

// ─── Custom label do gráfico de pizza ────────────────────────────────────────
const RADIAN = Math.PI / 180;
function renderCustomPieLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent, name, value, fill
}: any) {
  if (percent < 0.05) return null; // não renderiza fatias muito pequenas
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      fill={fill}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${name} (${value})`}
    </text>
  );
}

export default function Dashboard({ schedules, allSchedules, stats, loading, error }: Props) {
  const { isDark, theme } = useTheme();
  const isVerdan = theme === 'verdan';
  const isLiquidGlassV18 = theme === 'liquid-glass-v18';
  const isDashboardV32 = theme === 'dashboard-v32';
  const isVitrea = theme === 'vitrea';
  const isCalda = theme === 'calda';
  const equipCardTiltProps = getCardTiltProps<HTMLButtonElement>({ maxTiltDeg: 5.5, scale: 1.015 });
  const dashRef = useRef<HTMLDivElement>(null);
  const lastFocusedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [focusedOrder, setFocusedOrder] = useState<{
    id: string;
    context: DashboardFocusContext;
  } | null>(null);
  // exportTheme reserved for future use
  const [_exportTheme] = useState<DashExportTheme>('light');

  const handleExportDashPNG = async () => {
    setExporting(true); setShowExportMenu(false);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const el = dashRef.current;
      if (!el) return;
      await Promise.all(Array.from(el.querySelectorAll<HTMLImageElement>('.equipment-thumbnail img')).map(image => image.decode().catch(() => undefined)));
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: isDark ? '#1a2332' : '#f8fafc',
        logging: false, allowTaint: true,
      });
      const link = document.createElement('a');
      link.download = `dashboard-${new Date().toISOString().slice(0,10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch(e) { console.error(e); }
    finally { setExporting(false); }
  };

  const handleExportDashPDF = async () => {
    setExporting(true); setShowExportMenu(false);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;
      const el = dashRef.current;
      if (!el) return;
      await Promise.all(Array.from(el.querySelectorAll<HTMLImageElement>('.equipment-thumbnail img')).map(image => image.decode().catch(() => undefined)));
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, backgroundColor: isDark ? '#1a2332' : '#f8fafc',
        logging: false, allowTaint: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.height / canvas.width;
      const imgH = pdfW * ratio;
      if (imgH <= pdfH) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH);
      } else {
        // multi-page
        let yOffset = 0;
        // pageImgH = pdfH (used implicitly)
        const srcH = (pdfH / imgH) * canvas.height;
        let srcY = 0;
        while (srcY < canvas.height) {
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = Math.min(srcH, canvas.height - srcY);
          const ctx = pageCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, srcY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
          if (yOffset > 0) pdf.addPage();
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, (pageCanvas.height / canvas.width) * pdfW);
          srcY += srcH;
          yOffset++;
        }
      }
      pdf.save(`dashboard-${new Date().toISOString().slice(0,10)}.pdf`);
    } catch(e) { console.error(e); }
    finally { setExporting(false); }
  };
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // ─── Paleta de cores dinâmica ────────────────────────────────────────────────
  const C = {
    atrasado:   isCalda ? '#f47c67' : isVitrea ? '#f6a59c' : isDashboardV32 ? '#fb7185' : isLiquidGlassV18 ? '#fb7185' : isVerdan ? '#f87171' : isDark ? '#fc8181' : '#ef4444',
    pendente:   isCalda ? '#f4be5e' : isVitrea ? '#f3cd7e' : isDashboardV32 ? '#fbbf24' : isLiquidGlassV18 ? '#fbbf24' : isVerdan ? '#fbbf24' : isDark ? '#fbbf24' : '#f59e0b',
    programado: isCalda ? '#1e9bf0' : isVitrea ? '#7aaef0' : isDashboardV32 ? '#f97316' : isLiquidGlassV18 ? '#60a5fa' : isVerdan ? '#38bdf8' : isDark ? '#4fd1c5' : '#3b82f6',
    encerrado:  isCalda ? '#34d399' : isVitrea ? '#68c0b8' : isDashboardV32 ? '#10b981' : isLiquidGlassV18 ? '#34d399' : isVerdan ? '#b7ed40' : isDark ? '#38b2ac' : '#22c55e',
    grid:       isCalda ? 'rgba(255, 255, 255, 0.09)' : isVitrea ? 'rgba(255, 255, 255, 0.08)' : isDashboardV32 ? 'rgba(255, 255, 255, 0.06)' : isLiquidGlassV18 ? 'rgba(255, 255, 255, 0.08)' : isDark ? 'rgba(208, 236, 182, 0.08)' : '#f0f0f0',
    axis:       isCalda ? '#c2c7d0' : isVitrea ? '#b6c0d1' : isDashboardV32 ? '#9ca3af' : isLiquidGlassV18 ? 'rgba(241, 245, 249, 0.70)' : isVerdan ? '#8ea594' : isDark ? '#9a9a9a' : '#9ca3af',
    tooltip:    {
      background: isCalda ? 'rgba(42, 44, 49, 0.96)' : isVitrea ? 'rgba(28, 28, 32, 0.94)' : isDashboardV32 ? 'rgba(20, 21, 25, 0.96)' : isLiquidGlassV18 ? 'rgba(20, 19, 23, 0.92)' : isVerdan ? 'rgba(10, 21, 14, 0.94)' : isDark ? '#253347' : '#ffffff',
      border: `1px solid ${isCalda ? 'rgba(255, 255, 255, 0.22)' : isVitrea ? 'rgba(255, 255, 255, 0.18)' : isDashboardV32 ? 'rgba(255, 255, 255, 0.12)' : isLiquidGlassV18 ? 'rgba(255, 255, 255, 0.18)' : isVerdan ? 'rgba(183, 237, 64, 0.35)' : isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
      borderRadius: isCalda || isVitrea ? 16 : 14,
      color: isCalda ? '#ffffff' : isVitrea ? '#f3f3f6' : isDark ? '#eef6ec' : '#111827',
      fontSize: 12,
    },
    card:       isDark ? 'glass-card' : 'bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200',
    cardTitle:  isDark ? 'text-[var(--text-primary)]' : 'text-gray-700',
  };

  // ─── Dados para pizza de status ──────────────────────────────────────────────
  const pieData = useMemo(() => [
    { name: 'Atrasado',   value: stats.atrasado,       color: C.atrasado },
    { name: 'Pendente',   value: stats.pendente ?? 0,   color: C.pendente },
    { name: 'Programado', value: stats.programado,      color: C.programado },
    { name: 'Andamento',  value: stats.andamento ?? 0,  color: isCalda ? '#56b8ff' : isVitrea ? '#a9cdfc' : isDashboardV32 ? '#818cf8' : isLiquidGlassV18 ? '#818cf8' : isDark ? '#c084fc' : '#9333ea' },
    { name: 'Encerrado',  value: stats.encerrado,       color: C.encerrado },
  ].filter(d => d.value > 0), [stats, isDark, isLiquidGlassV18, isDashboardV32, isVitrea, isCalda]);

  // ─── Dados mensais (últimos 6 meses) ────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const months: Record<string, { mes: string; programado: number; encerrado: number; atrasado: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today);
      d.setMonth(d.getMonth() - i);
      const key = format(d, 'yyyy-MM');
      months[key] = { mes: format(d, 'MMM/yy', { locale: ptBR }), programado: 0, encerrado: 0, atrasado: 0 };
    }
    schedules.forEach(s => {
      if (!s.dataProgramada) return;
      const key = s.dataProgramada.slice(0, 7);
      if (!months[key]) return;
      if (s.situacao === 'ENCERRADO') months[key]!.encerrado++;
      else if (s.situacao === 'ATRASADO') months[key]!.atrasado++;
      else months[key]!.programado++;
    });
    return Object.values(months);
  }, [schedules, today]);

  // ─── Dados de tendência acumulada (área) ────────────────────────────────────
  const trendData = useMemo(() => {
    let acc = 0;
    return monthlyData.map(m => {
      acc += m.encerrado;
      return { mes: m.mes, encerrados: acc, programados: m.programado + m.atrasado };
    });
  }, [monthlyData]);

  // ─── Dados por local ────────────────────────────────────────────────────────
  const localData = useMemo(() => {
    const counts: Record<string, { total: number; encerrado: number }> = {};
    schedules.forEach(s => {
      const local = s.descricaoPonto || 'Outros';
      if (!counts[local]) counts[local] = { total: 0, encerrado: 0 };
      counts[local]!.total++;
      if (s.situacao === 'ENCERRADO') counts[local]!.encerrado++;
    });
    return Object.entries(counts)
      .map(([name, v]) => ({ name, total: v.total, encerrado: v.encerrado, taxa: Math.round((v.encerrado / v.total) * 100) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [schedules]);

  // ─── Radial — taxa de conclusão ─────────────────────────────────────────────
  const taxaConclusao = stats.total > 0 ? Math.round((stats.encerrado / stats.total) * 100) : 0;
  const radialData = [{ name: 'Concluído', value: taxaConclusao, fill: C.encerrado }];

  // ─── Próximos 7 dias e atrasados ────────────────────────────────────────────
  const proximos7 = useMemo(() => {
    const fim = new Date(today);
    fim.setDate(fim.getDate() + 7);
    return schedules
      .filter(s => {
        if (!s.dataProgramada) return false;
        try {
          const d = parseISO(s.dataProgramada);
          return isValid(d) && d >= today && d <= fim && s.situacao !== 'ENCERRADO';
        } catch { return false; }
      })
      .sort((a, b) => a.dataProgramada.localeCompare(b.dataProgramada))
      .slice(0, 8);
  }, [schedules, today]);

  const atrasados = useMemo(() =>
    schedules.filter(s => s.situacao === 'ATRASADO').slice(0, 8),
    [schedules]
  );

  const activeFocusQueue = useMemo(() => {
    if (!focusedOrder) return [];
    return focusedOrder.context === 'atrasados' ? atrasados : proximos7;
  }, [focusedOrder, atrasados, proximos7]);

  const focusedSchedule = useMemo(() => {
    if (!focusedOrder) return null;
    return activeFocusQueue.find((item) => item.id === focusedOrder.id)
      ?? schedules.find((item) => item.id === focusedOrder.id)
      ?? null;
  }, [focusedOrder, activeFocusQueue, schedules]);

  const focusedQueueIndex = useMemo(() => {
    if (!focusedSchedule) return 0;
    const idx = activeFocusQueue.findIndex((item) => item.id === focusedSchedule.id);
    return idx >= 0 ? idx : 0;
  }, [focusedSchedule, activeFocusQueue]);

  const openFocusOrder = useCallback(
    (schedule: Programacao, context: DashboardFocusContext, triggerEl: HTMLButtonElement | null) => {
      lastFocusedTriggerRef.current = triggerEl;
      setFocusedOrder({ id: schedule.id, context });
    },
    [],
  );

  const closeFocusOrder = useCallback(() => {
    setFocusedOrder(null);
    window.requestAnimationFrame(() => {
      lastFocusedTriggerRef.current?.focus();
    });
  }, []);

  const navigateFocusQueue = useCallback(
    (direction: 'prev' | 'next') => {
      setFocusedOrder((current) => {
        if (!current) return null;
        const queue = current.context === 'atrasados' ? atrasados : proximos7;
        const adjacent = getAdjacentFocusOrder(queue, current.id, direction);
        return adjacent ? { id: adjacent.id, context: current.context } : current;
      });
    },
    [atrasados, proximos7],
  );

  // ─── Cards de stat ───────────────────────────────────────────────────────────
  const statCards = [
    {
      key: 'atrasado', label: 'Atrasado', value: stats.atrasado, icon: AlertTriangle,
      light: 'bg-red-50 border-red-200 text-red-700',
      dark:  'bg-red-500/10 border-red-500/20 text-red-400',
      iconDark: 'text-red-400', glow: 'glow-red',
    },
    {
      key: 'programado', label: 'Programado', value: stats.programado, icon: Calendar,
      light: 'bg-blue-50 border-blue-200 text-blue-700',
      dark:  'bg-[var(--brand-green)]/10 border-[var(--brand-green)]/20 text-[var(--brand-green)]',
      iconDark: 'text-[var(--brand-green)]', glow: 'glow-green',
    },
    {
      key: 'andamento', label: 'Andamento', value: stats.andamento ?? 0, icon: Activity,
      light: 'bg-purple-50 border-purple-200 text-purple-700',
      dark:  'bg-purple-500/10 border-purple-500/20 text-purple-400',
      iconDark: 'text-purple-400', glow: '',
    },
    {
      key: 'encerrado', label: 'Encerrado', value: stats.encerrado, icon: CheckCircle2,
      light: 'bg-green-50 border-green-200 text-green-700',
      dark:  'bg-[var(--brand-green-light)]/10 border-[var(--brand-green-light)]/20 text-[var(--brand-green-light)]',
      iconDark: 'text-[var(--brand-green-light)]', glow: '',
    },
    {
      key: 'total', label: 'Total', value: stats.total, icon: TrendingUp,
      light: 'bg-slate-50 border-slate-200 text-slate-700',
      dark:  'bg-slate-500/10 border-slate-500/20 text-slate-400',
      iconDark: 'text-slate-400', glow: '',
    },
    {
      key: 'taxa', label: 'Taxa Conclusão', value: `${taxaConclusao}%`, icon: Zap,
      light: 'bg-amber-50 border-amber-200 text-amber-700',
      dark:  'bg-amber-500/10 border-amber-500/20 text-amber-400',
      iconDark: 'text-amber-400', glow: 'glow-yellow',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className={`w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3 ${isDark ? 'border-[var(--brand-green)]' : 'border-green-600'}`} />
          <p className={`text-sm ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>Carregando dados da planilha...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={dashRef} className="lavagem-dashboard space-y-6 fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>Dashboard</h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            isDark ? 'bg-[var(--bg-tertiary)] border border-white/10 text-[var(--text-secondary)]' : 'bg-gray-100 text-gray-600'
          }`}>
            <Activity size={12} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
            {stats.total} registros
          </div>
          {/* Botão Exportar Dashboard */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              disabled={exporting}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isDark
                  ? 'bg-[var(--bg-tertiary)] border border-[var(--brand-green)]/30 text-[var(--brand-green)] hover:bg-[var(--brand-green)]/10'
                  : 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100'
              } disabled:opacity-50`}
            >
              {exporting ? (
                <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download size={13} />
              )}
              Exportar
              <ChevronDown size={11} />
            </button>
            {showExportMenu && (
              <div className={`absolute right-0 top-full mt-1 z-50 rounded-xl shadow-2xl border w-52 overflow-hidden ${
                isDark ? 'bg-[var(--bg-tertiary)] border-white/10' : 'bg-white border-gray-200'
              }`}>
                <div className={`px-3 py-2 text-xs font-semibold border-b ${
                  isDark ? 'text-[var(--text-muted)] border-white/[0.06]' : 'text-gray-500 border-gray-100'
                }`}>Exportar Dashboard</div>
                <button
                  onClick={handleExportDashPNG}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                    isDark ? 'text-[var(--text-secondary)] hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileImage size={15} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
                  Salvar como PNG
                </button>
                <button
                  onClick={handleExportDashPDF}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                    isDark ? 'text-[var(--text-secondary)] hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileText size={15} className="text-red-500" />
                  Salvar como PDF
                </button>
              </div>
            )}
            {showExportMenu && (
              <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
          isDark ? 'bg-amber-950/30 border border-amber-700/40 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          <AlertTriangle size={16} />
          {error} — Exibindo dados em cache.
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(sc => {
          const Icon = sc.icon;
          return (
            <div key={sc.key} className={`dashboard-kpi glass-card border rounded-xl p-4 card-hover ${isDark ? sc.dark : sc.light} ${isDark ? sc.glow : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs font-medium ${isDark ? 'text-[var(--text-muted)]' : 'opacity-70'}`}>{sc.label}</p>
                  <p className={`text-2xl font-black mt-1 tabular-nums ${isDark ? 'text-[var(--text-primary)]' : ''}`}>
                    {(isVerdan || isLiquidGlassV18 || isDashboardV32 || isVitrea || isCalda) && typeof sc.value === 'number' ? <VerdanCountUp value={sc.value} /> : sc.value}
                  </p>
                </div>
                <div className={`dashboard-kpi__icon p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white/60'}`}>
                  <Icon size={18} className={isDark ? sc.iconDark : ''} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Alertas de equipamentos sem lavagem há X dias ── */}
      {/* Usa o histórico COMPLETO (não a lista filtrada) para calcular a última lavagem */}
      <AlertasEquipamentos schedules={allSchedules ?? schedules} isDark={isDark} />

      {/* ── Linha 1: Pizza + Barras mensais ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Pizza de status */}
        <div className={`dashboard-panel ${C.card} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
            <h3 className={`text-sm font-semibold ${C.cardTitle}`}>Distribuição por Status</h3>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={40}
                  dataKey="value"
                  labelLine={{ stroke: isDark ? 'rgba(255,255,255,0.2)' : '#ccc', strokeWidth: 1 }}
                  label={renderCustomPieLabel}
                  paddingAngle={3}
                  animationBegin={0}
                  animationDuration={isLiquidGlassV18 ? 360 : 1500}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      stroke={isLiquidGlassV18 ? 'rgba(24, 22, 26, 0.78)' : isDark ? '#161616' : '#fff'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={C.tooltip}
                  formatter={(v: number) => [v, 'Registros']}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className={`h-[260px] flex items-center justify-center text-sm ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>
              Nenhum dado disponível
            </div>
          )}
        </div>

        {/* Barras mensais */}
        <div className={`dashboard-panel ${C.card} p-5`}>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 size={15} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
              <h3 className={`text-sm font-semibold ${C.cardTitle}`}>Programações por Mês</h3>
            </div>
            {isVerdan && (
              <span className="verdan-chip verdan-chip--lime">Últimos 6 meses</span>
            )}
          </div>
          {isVerdan ? (
            <VerdanPillBarChart
              data={monthlyData.map((m) => ({
                label: m.mes.split('/')[0] ?? m.mes,
                value: m.programado + m.atrasado + m.encerrado,
              }))}
              unit="ord."
            />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="v32OrangeBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="55%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#9a3412" />
                  </linearGradient>
                  <linearGradient id="v32EmeraldBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="65%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#065f46" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={C.tooltip} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                <Legend formatter={(v) => <span style={{ color: C.axis, fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="programado" name="Programado" fill={isDashboardV32 ? 'url(#v32OrangeBar)' : C.programado} radius={isLiquidGlassV18 ? [6,6,6,6] : isDashboardV32 ? [6,6,0,0] : [4,4,0,0]} maxBarSize={28} animationDuration={isLiquidGlassV18 ? 360 : 1500} />
                <Bar dataKey="atrasado"   name="Atrasado"   fill={C.atrasado}   radius={isLiquidGlassV18 ? [6,6,6,6] : isDashboardV32 ? [6,6,0,0] : [4,4,0,0]} maxBarSize={28} animationDuration={isLiquidGlassV18 ? 360 : 1500} />
                <Bar dataKey="encerrado"  name="Encerrado"  fill={isDashboardV32 ? 'url(#v32EmeraldBar)' : C.encerrado}  radius={isLiquidGlassV18 ? [6,6,6,6] : isDashboardV32 ? [6,6,0,0] : [4,4,0,0]} maxBarSize={28} animationDuration={isLiquidGlassV18 ? 360 : 1500} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Linha 2: Área de tendência + Radial taxa ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Área — evolução acumulada */}
        <div className={`dashboard-panel ${C.card} p-5 lg:col-span-2`}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
            <h3 className={`text-sm font-semibold ${C.cardTitle}`}>Evolução — Encerrados Acumulados</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="gradEnc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.encerrado} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.encerrado} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradProg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.atrasado} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.atrasado} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={C.tooltip} />
              <Legend formatter={(v) => <span style={{ color: C.axis, fontSize: 11 }}>{v}</span>} />
              <Area type="monotone" dataKey="encerrados"  name="Encerrados (acum.)" stroke={C.encerrado} fill="url(#gradEnc)"  strokeWidth={2.5} dot={{ fill: C.encerrado, r: 3 }} animationDuration={isLiquidGlassV18 ? 360 : 1500} />
              <Area type="monotone" dataKey="programados" name="Pendentes/Atrasados" stroke={C.atrasado}  fill="url(#gradProg)" strokeWidth={2}   dot={{ fill: C.atrasado, r: 3 }} strokeDasharray="4 2" animationDuration={isLiquidGlassV18 ? 360 : 1500} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radial — taxa de conclusão */}
        <div className={`dashboard-panel ${C.card} p-5 flex flex-col items-center justify-center`}>
          <div className="flex items-center gap-2 mb-3 w-full">
            <Zap size={15} className={isDark ? 'text-[var(--brand-yellow)]' : 'text-amber-500'} />
            <h3 className={`text-sm font-semibold ${C.cardTitle}`}>Taxa de Conclusão</h3>
          </div>
          {isDashboardV32 ? (
            <div className="w-full space-y-3 flex flex-col items-center">
              <VerdanRadialGauge
                valuePct={taxaConclusao}
                label="CONCLUÍDO"
                variant="v32-segmented"
                size={206}
              />
              <div className="v32-gauge-subgrid w-full">
                <div className="v32-gauge-subwell">
                  <span>Encerradas</span>
                  <strong className="tabular-nums text-emerald-400">{stats.encerrado}</strong>
                </div>
                <div className="v32-gauge-subwell">
                  <span>Em aberto</span>
                  <strong className="tabular-nums text-amber-400">{Math.max(0, stats.total - stats.encerrado)}</strong>
                </div>
              </div>
            </div>
          ) : isVerdan ? (
            <div className="w-full space-y-4">
              <VerdanRadialGauge
                valuePct={taxaConclusao}
                label="CONCLUÍDO"
                subtitle={`${stats.encerrado} de ${stats.total} concluídos`}
                size={196}
              />
              <VerdanSegmentedProgress pct={taxaConclusao} blocks={5} />
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart
                  cx="50%" cy="50%"
                  innerRadius="55%"
                  outerRadius="85%"
                  startAngle={225}
                  endAngle={-45}
                  data={[{ value: 100, fill: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }, ...radialData]}
                >
                  <RadialBar dataKey="value" cornerRadius={8} background={false} animationDuration={isLiquidGlassV18 ? 360 : 1500} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="text-center -mt-4">
                <p className={`text-4xl font-black ${isDark ? 'text-[var(--brand-green-light)]' : 'text-green-600'}`}>{taxaConclusao}%</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>{stats.encerrado} de {stats.total} concluídos</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Linha 3: Por local ── */}
      {localData.length > 0 && (
        <div className={`dashboard-panel ${C.card} p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Wrench size={15} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
            <h3 className={`text-sm font-semibold ${C.cardTitle}`}>Programações por Local</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={localData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: C.axis }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#c8c8c8' : '#374151' }} width={80} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={C.tooltip} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
              <Legend formatter={(v) => <span style={{ color: C.axis, fontSize: 11 }}>{v}</span>} />
              <Bar dataKey="total"     name="Total"     fill={isCalda ? '#1e9bf0' : isVitrea ? '#7aaef0' : isDashboardV32 ? '#f97316' : isLiquidGlassV18 ? '#60a5fa' : isDark ? '#4fd1c5' : '#1a7a2e'} radius={isCalda || isVitrea || isLiquidGlassV18 ? [6,6,6,6] : isDashboardV32 ? [0,6,6,0] : [0,4,4,0]} maxBarSize={18} />
              <Bar dataKey="encerrado" name="Encerrado" fill={isCalda ? '#34d399' : isVitrea ? '#68c0b8' : isDashboardV32 ? '#10b981' : isLiquidGlassV18 ? '#34d399' : isDark ? '#38b2ac' : '#22c55e'} radius={isCalda || isVitrea || isLiquidGlassV18 ? [6,6,6,6] : isDashboardV32 ? [0,6,6,0] : [0,4,4,0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Linha 4: Atrasados + Próximos 7 dias ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Atrasados */}
        <div className={`glass-card ${isDark
          ? 'bg-[var(--bg-tertiary)] border border-red-500/20 rounded-xl shadow-xl glow-red'
          : 'bg-white border border-red-200 rounded-xl shadow-sm'
        } p-5`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-red-400' : 'text-red-700'}`}>
              <AlertTriangle size={15} /> Tarefas Atrasadas ({stats.atrasado})
            </h3>
            {atrasados.length > 0 && (
              <span className={`text-[11px] font-medium ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
                Clique para Modo Foco
              </span>
            )}
          </div>
          {atrasados.length === 0 ? (
            <p className={`text-sm text-center py-6 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>Nenhuma tarefa atrasada 🎉</p>
          ) : (
            <div className="space-y-2">
              {atrasados.map(s => {
                const diasAtraso = s.dataProgramada ? differenceInDays(today, parseISO(s.dataProgramada)) : 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    {...equipCardTiltProps}
                    onClick={(event) => openFocusOrder(s, 'atrasados', event.currentTarget)}
                    aria-label={`Abrir modo foco da Frota ${s.frota} — ${s.tipoPreventiva}`}
                    className={`glass-card dashboard-equipment-card tilt-card dash-order-trigger flex items-center justify-between gap-3 text-sm rounded-xl px-3 py-2.5 ${
                      isDark ? 'bg-red-950/25 border border-red-800/25' : 'bg-red-50/90 border border-red-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EquipmentThumbnail equipment={s} size="table" />
                      <div className="min-w-0">
                        <span className={`font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-800'}`}>Frota {s.frota}</span>
                        <span className={`ml-2 text-xs ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>{s.tipoPreventiva}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <div className={`text-xs font-semibold tabular-nums ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                          {diasAtraso > 0 ? `${diasAtraso}d atraso` : s.dataProgramada}
                        </div>
                        <div className={`text-xs tabular-nums ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>{s.horarioAgendado}</div>
                      </div>
                      <Maximize2 size={14} className="dash-order-trigger__hint shrink-0" aria-hidden="true" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Próximos 7 dias */}
        <div className={`glass-card ${isDark
          ? 'bg-[var(--bg-tertiary)] border border-[var(--brand-green)]/20 rounded-xl shadow-xl glow-green'
          : 'bg-white border border-blue-200 rounded-xl shadow-sm'
        } p-5`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${isDark ? 'text-[var(--brand-green)]' : 'text-blue-700'}`}>
              <Clock size={15} /> Próximos 7 Dias ({proximos7.length})
            </h3>
            {proximos7.length > 0 && (
              <span className={`text-[11px] font-medium ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
                Clique para Modo Foco
              </span>
            )}
          </div>
          {proximos7.length === 0 ? (
            <p className={`text-sm text-center py-6 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`}>Nenhuma programação nos próximos 7 dias</p>
          ) : (
            <div className="space-y-2">
              {proximos7.map(s => (
                <button
                  key={s.id}
                  type="button"
                  {...equipCardTiltProps}
                  onClick={(event) => openFocusOrder(s, 'proximos7', event.currentTarget)}
                  aria-label={`Abrir modo foco da Frota ${s.frota} — ${s.tipoPreventiva}`}
                  className={`glass-card dashboard-equipment-card tilt-card dash-order-trigger flex items-center justify-between gap-3 text-sm rounded-xl px-3 py-2.5 ${
                    isDark ? 'bg-[var(--brand-green)]/5 border border-[var(--brand-green)]/10' : 'bg-blue-50/90 border border-blue-200/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <EquipmentThumbnail equipment={s} size="table" />
                    <div className="min-w-0">
                      <span className={`font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-800'}`}>Frota {s.frota}</span>
                      <span className={`ml-2 text-xs ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>{s.tipoPreventiva}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <div className={`text-xs font-semibold tabular-nums ${isDark ? 'text-[var(--brand-green)]' : 'text-blue-600'}`}>
                        {s.dataProgramada ? format(parseISO(s.dataProgramada), 'dd/MM', { locale: ptBR }) : '—'}
                      </div>
                      <div className={`text-xs tabular-nums ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>{s.horarioAgendado}</div>
                    </div>
                    <Maximize2 size={14} className="dash-order-trigger__hint shrink-0" aria-hidden="true" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <DashboardFocusModal
        schedule={focusedSchedule}
        context={focusedOrder?.context ?? 'atrasados'}
        allSchedules={allSchedules ?? schedules}
        queueLength={activeFocusQueue.length}
        queueIndex={focusedQueueIndex}
        onClose={closeFocusOrder}
        onNavigateQueue={navigateFocusQueue}
      />
    </div>
  );
}

