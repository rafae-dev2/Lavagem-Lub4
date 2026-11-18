import { getProgramacaoViewStorageKey, readProgramacaoViewMode, saveProgramacaoViewMode, type ProgramacaoViewMode } from '../lib/programacaoViewPreference';
import { useOperationalMinuteClock } from '../hooks/useOperationalMinuteClock';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Programacao, StatusType } from '../types';
import FilterPanel, { FilterState } from '../components/FilterPanel';
import {
  Plus, Trash2, Edit2, Search, X, Save, ChevronDown, ChevronUp,
  CheckCircle2, AlertTriangle, RefreshCw, Maximize2, Minimize2,
  EyeOff, Eye, Loader2, Clock, Zap, Play, Check,
  CalendarClock, RotateCcw, LayoutGrid, Table2, Copy
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { nanoid } from 'nanoid';
import { useAdvancedFilters } from '../hooks/useAdvancedFilters';
import { useTheme } from '../contexts/ThemeContext';
import AmbientBrandWatermark from '../components/AmbientBrandWatermark';
import TurnoKanban from '../components/TurnoKanban';
import HistoricoFrotaModal from '../components/HistoricoFrotaModal';
import PCMHistoryPanel from '../components/PCMHistoryPanel';
import { sortSchedules } from '../lib/scheduleOrder';
import LubricationScheduleTable from '../components/LubricationScheduleTable';
import { filterLavagemEquipmentSchedules } from '../lib/lavagemEquipmentScope';
import { cleanScheduleObservation, effectiveScheduleCompletionDate } from '../lib/schedulePresentation';
import '../styles/lubrificacao.css';
import '../styles/mobile-operations-v1011.css';
import {
  VerdanCountUp,
  VerdanLollipopStrip,
  VerdanRadialGauge,
  VerdanSegmentedProgress,
  VerdanSparklineCard,
} from '../components/VerdanAnimatedWidgets';
import {
  countHideableClosedSchedules,
  getEffectiveHideEncerradas,
  getLocalDateStr,
  getOperationalWindowKey,
  setManualHideEncerradas,
  shouldHideClosedSchedule,
  type HideEncerradasState,
} from '../lib/scheduleVisibility';

interface Props {
  schedules: Programacao[];
  onUpdate: (id: string, updates: Partial<Programacao>) => Promise<{ sheetError?: string }>;
  onDelete: (id: string) => Promise<{ sheetError?: string }>;
  onAdd: (items: Programacao[]) => Promise<{ sheetErrors: string[] }>;
  onAddSingle?: (item: Programacao) => Promise<{ success: boolean; sheetError?: string }>;
}

const STATUS_OPTIONS: StatusType[] = ['PROGRAMADO', 'PENDENTE', 'ATRASADO', 'ANDAMENTO', 'ENCERRADO'];
const TIPO_OPTIONS = ['Lavagem / Lubrificação', 'Lubrificação', 'Troca de Óleo', 'Manutenção'];
const QUICK_TIPO_OPTIONS = ['Lavagem / Lubrificação', 'Lubrificação', 'Troca de Óleo'];
const PCM_READ_ONLY_MESSAGE = 'Registros PCM são somente leitura nesta tela.';

const emptyForm = (): Partial<Programacao> => ({
  frota: '',
  descricaoPonto: 'LAVADOR',
  tipoPreventiva: 'Lavagem / Lubrificação',
  dataProgramada: '',
  dataRealizada: '',
  situacao: 'PROGRAMADO',
  horarioAgendado: '',
  observacao: '',
});

// ─── Persistência compartilhada da ocultação por janela operacional ──────────
type HideState = HideEncerradasState;

function getWeekRange(dateStr: string): { start: string; end: string } | null {
  if (!dateStr) return null;
  const base = parseISO(dateStr);
  if (!isValid(base)) return null;
  const start = new Date(base);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: getLocalDateStr(start), end: getLocalDateStr(end) };
}

function isPcmSchedule(schedule: Programacao): boolean {
  return schedule.origemRegistro === 'PCM';
}

export default function Programacoes({ schedules: inputSchedules, onUpdate, onDelete, onAdd, onAddSingle }: Props) {
  const { isDark, theme } = useTheme();
  const isVerdan = theme === 'verdan';
  const schedules = useMemo(() => filterLavagemEquipmentSchedules(inputSchedules), [inputSchedules]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusType | 'TODOS'>('TODOS');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [filterOrigin, setFilterOrigin] = useState<'TODOS' | 'PCM' | 'MANUAL'>('PCM');
  const [filterApoio, setFilterApoio] = useState('TODOS');
  const [weekDate, setWeekDate] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  // Modo compacto: minimiza o topo (resumo do turno e avisos) para sobrar mais
  // espaço para a tabela de programações. Preferência salva no navegador.
  const [compactHeader, setCompactHeader] = useState<boolean>(
    () => { try { return localStorage.getItem('bp_prog_compact') === '1'; } catch { return false; } }
  );
  const toggleCompactHeader = useCallback(() => {
    setCompactHeader(prev => {
      const next = !prev;
      try { localStorage.setItem('bp_prog_compact', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Programacao>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; msg: string } | null>(null);
  const [sortField, setSortField] = useState<keyof Programacao>('dataProgramada');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [quickUpdating, setQuickUpdating] = useState<string | null>(null);
  const [viewPreferenceKey] = useState(getProgramacaoViewStorageKey);
  const [viewMode, setViewMode] = useState<ProgramacaoViewMode>(() => readProgramacaoViewMode(viewPreferenceKey));
  const [historicoFrota, setHistoricoFrota] = useState<string | null>(null);
  const [showPcmHistory, setShowPcmHistory] = useState(false);
  const [pcmHistoryFocus, setPcmHistoryFocus] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterState>({
    mode: 'periodo',
    dataInicio: '',
    dataFim: '',
    mesInicio: '01',
    mesFim: '12',
    statuses: ['ATRASADO', 'PENDENTE', 'PROGRAMADO', 'ANDAMENTO', 'ENCERRADO'],
  });

  useEffect(() => {
    saveProgramacaoViewMode(viewPreferenceKey, viewMode);
  }, [viewMode, viewPreferenceKey]);

  useEffect(() => {
    if (!fullscreen && !showModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showModal) {
        if (!saving) setShowModal(false);
        return;
      }
      if (fullscreen && !historicoFrota) {
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, showModal, historicoFrota, saving]);

  // ─── Ocultação automática de encerradas (corte diário às 07:10) ────────────
  const clock = useOperationalMinuteClock();
  const now = useMemo(() => new Date(clock), [clock]);
  const operationalWindowKey = useMemo(() => getOperationalWindowKey(now), [now]);

  // Por padrão OCULTA as encerradas anteriores ao corte das 07:10. O usuário
  // pode alternar manualmente; a escolha vale até a próxima virada de 07:10.
  const [hideEncerradas, setHideEncerradas] = useState<boolean>(() => getEffectiveHideEncerradas());


  // Ao virar a janela operacional (07:10), reavaliar: novas janelas voltam a
  // ocultar automaticamente as encerradas do turno anterior.
  useEffect(() => {
    setHideEncerradas(getEffectiveHideEncerradas(now));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationalWindowKey]);

  const encerradasCount = schedules.filter(s => s.situacao === 'ENCERRADO').length;
  const hideableEncerradasCount = useMemo(
    () => countHideableClosedSchedules(schedules, now),
    [schedules, now],
  );

  // ─── Resumo operacional do turno (hoje) ───────────────────────────────────
  const turnoStats = useMemo(() => {
    const today = getLocalDateStr(now);
    const todaySchedules = schedules.filter(s => s.dataProgramada === today);
    const total = todaySchedules.length;
    const encerradas = todaySchedules.filter(s => s.situacao === 'ENCERRADO').length;
    const atrasadas = todaySchedules.filter(s => s.situacao === 'ATRASADO').length;
    const andamento = todaySchedules.filter(s => s.situacao === 'ANDAMENTO').length;
    const programadas = todaySchedules.filter(s => s.situacao === 'PROGRAMADO').length;
    const pendentes = todaySchedules.filter(s => s.situacao === 'PENDENTE').length;
    const pct = total > 0 ? Math.round((encerradas / total) * 100) : 0;
    return { total, encerradas, atrasadas, andamento, programadas, pendentes, pct };
  }, [schedules, now]);

  // ─── Alternância MANUAL (mostrar/ocultar) para a janela atual ──────────────
  // A ocultação já é AUTOMÁTICA após as 07:10; este botão apenas permite
  // mostrar/ocultar manualmente. A escolha vale até a próxima virada de 07:10.
  // Emite `bp:hide-encerradas-changed` para o Dashboard/Exportação reagirem.
  const broadcastHideChange = (val: boolean) => {
    try {
      window.dispatchEvent(new CustomEvent('bp:hide-encerradas-changed', { detail: { hidden: val } }));
    } catch { /* ignorar em ambientes sem CustomEvent */ }
  };

  const toggleHideEncerradas = useCallback(() => {
    const newVal = !hideEncerradas;
    setHideEncerradas(newVal);
    setManualHideEncerradas(newVal, now);
    broadcastHideChange(newVal);
    showNotif('success', newVal
      ? (hideableEncerradasCount > 0
          ? `${hideableEncerradasCount} encerrada(s) anterior(es) ao corte das 07:10 ocultada(s)`
          : 'Nenhuma encerrada anterior ao corte das 07:10 para ocultar')
      : 'Mostrando todas as encerradas');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideEncerradas, hideableEncerradasCount, now]);

  const showNotif = (type: 'success' | 'error' | 'warning', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 5000);
  };

  const advancedFiltered = useAdvancedFilters(schedules, advancedFilters);
  const weekRange = useMemo(() => getWeekRange(weekDate), [weekDate]);

  const apoioOptions = useMemo(() => {
    const options = new Map<string, string>();
    schedules.forEach((schedule) => {
      const key = schedule.apoioId || schedule.apoioNome;
      if (key) options.set(key, schedule.apoioNome || schedule.apoioId || key);
    });
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [schedules, now]);

  const filteredBeforeTipo = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return advancedFiltered.filter(s => {
      if (hideEncerradas && shouldHideClosedSchedule(s, now)) return false;
      const matchSearch = !normalizedSearch || [
        s.frota,
        s.descricaoPonto,
        s.tipoPreventiva,
        s.observacao,
        s.numeroOS,
        s.apoioNome,
        s.narrativaPCM,
      ].some(v => String(v || '').toLowerCase().includes(normalizedSearch));
      const matchStatus = filterStatus === 'TODOS' || s.situacao === filterStatus;
      const matchOrigin = filterOrigin === 'TODOS' || (s.origemRegistro || 'MANUAL') === filterOrigin;
      const apoioKey = s.apoioId || s.apoioNome;
      const matchApoio = filterApoio === 'TODOS' || apoioKey === filterApoio;
      const matchWeek = !weekRange || (
        Boolean(s.dataProgramada) &&
        s.dataProgramada >= weekRange.start &&
        s.dataProgramada <= weekRange.end
      );
      return matchSearch && matchStatus && matchOrigin && matchApoio && matchWeek;
    });
  }, [advancedFiltered, search, filterStatus, filterOrigin, filterApoio, weekRange, hideEncerradas, now]);

  const quickTipoCounts = useMemo(() => {
    return QUICK_TIPO_OPTIONS.reduce<Record<string, number>>((counts, tipo) => {
      counts[tipo] = filteredBeforeTipo.filter(s => s.tipoPreventiva === tipo).length;
      return counts;
    }, {});
  }, [filteredBeforeTipo]);

  const filtered = useMemo(() => {
    const result = filteredBeforeTipo.filter(s => filterTipo === 'TODOS' || s.tipoPreventiva === filterTipo);
    if (sortField === 'dataProgramada' && sortDir === 'asc') return sortSchedules(result);
    return result
      .map((schedule, index) => ({ schedule, index }))
      .sort((left, right) => {
        let comparison = 0;
        if (sortField === 'rowIndex') {
          comparison = (left.schedule.rowIndex ?? Number.POSITIVE_INFINITY) - (right.schedule.rowIndex ?? Number.POSITIVE_INFINITY);
        } else {
          comparison = String(left.schedule[sortField] || '').localeCompare(String(right.schedule[sortField] || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
        }
        return (sortDir === 'asc' ? comparison : -comparison) || left.index - right.index;
      })
      .map(({ schedule }) => schedule);
  }, [filteredBeforeTipo, filterTipo, sortField, sortDir]);

  // ─── Métricas derivadas para os painéis animados Verdan OS ────────────────
  const verdanMetrics = useMemo(() => {
    const byDate = new Map<string, number>();
    const byLocal = new Map<string, { count: number; active: boolean }>();

    filtered.forEach((s) => {
      const dateKey = s.dataProgramada || 'sem-data';
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + 1);

      const localName = (s.descricaoPonto || 'Outros').trim();
      const prev = byLocal.get(localName) ?? { count: 0, active: false };
      prev.count += 1;
      if (s.situacao === 'ANDAMENTO' || s.situacao === 'PROGRAMADO') prev.active = true;
      byLocal.set(localName, prev);
    });

    const sortedDates = [...byDate.entries()]
      .filter(([k]) => k !== 'sem-data')
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([, count]) => count);

    const sparkSeries = sortedDates.length >= 2
      ? sortedDates
      : [
          filtered.filter((s) => s.situacao === 'ATRASADO').length,
          filtered.filter((s) => s.situacao === 'PENDENTE').length,
          filtered.filter((s) => s.situacao === 'PROGRAMADO').length,
          filtered.filter((s) => s.situacao === 'ANDAMENTO').length,
          filtered.filter((s) => s.situacao === 'ENCERRADO').length,
        ];

    const localItemsSource = byLocal.size >= 3
      ? byLocal
      : filtered.reduce((acc, s) => {
          const key = (s.apoioNome || s.tipoPreventiva || s.descricaoPonto || 'Frotas').trim();
          const prev = acc.get(key) ?? { count: 0, active: false };
          prev.count += 1;
          if (s.situacao === 'ANDAMENTO' || s.situacao === 'PROGRAMADO') prev.active = true;
          acc.set(key, prev);
          return acc;
        }, new Map<string, { count: number; active: boolean }>());

    const localItems = [...localItemsSource.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 7)
      .map(([rawLabel, meta]) => {
        const label = rawLabel
          .replace(/^Caminh[õo]es\s+/i, '')
          .replace(/^Caminh[ãa]o\s+/i, '')
          .replace(/^Carretas?\s+/i, '')
          .replace(/^Ve[íi]culos?\s+/i, 'Veíc. ')
          .replace(/^Tratores?\s+/i, 'Tr. ');
        return { label, count: meta.count, active: meta.active };
      });
    const localChipLabel = byLocal.size >= 3
      ? `${localItems.length} ${localItems.length === 1 ? 'local' : 'locais'}`
      : `${localItems.length} ${localItems.length === 1 ? 'frente' : 'frentes'}`;

    const closedTotal = schedules.filter((s) => s.situacao === 'ENCERRADO').length;
    const overallPct = turnoStats.total > 0
      ? turnoStats.pct
      : schedules.length > 0
        ? Math.round((closedTotal / schedules.length) * 100)
        : 0;
    const delayedInSelection = filtered.filter((s) => s.situacao === 'ATRASADO').length;

    return {
      sparkSeries,
      localItems,
      localChipLabel,
      overallPct,
      delayedInSelection,
      activeCount: filtered.filter((s) => s.situacao === 'ANDAMENTO' || s.situacao === 'PROGRAMADO').length,
    };
  }, [filtered, schedules, turnoStats]);

  const handleSort = (field: keyof Programacao) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const openAdd = () => { setEditId(null); setForm(emptyForm()); setSaveError(''); setShowModal(true); };
  const editingSchedule = editId ? schedules.find(schedule => schedule.id === editId) : undefined;
  const editingPcm = editingSchedule?.origemRegistro === 'PCM';
  const openEdit = (schedule: Programacao) => {
    setEditId(schedule.id);
    setForm({ ...schedule, dataRealizada: effectiveScheduleCompletionDate(schedule), observacao: cleanScheduleObservation(schedule) });
    setSaveError('');
    setShowModal(true);
  };
  const closeModal = () => { if (saving) return; setShowModal(false); setEditId(null); setForm(emptyForm()); setSaveError(''); };

  // ─── Atalho rápido: mudar status sem abrir modal ─────────────────────────
  const quickStatusChange = async (s: Programacao, newStatus: StatusType) => {
    if (isPcmSchedule(s)) {
      showNotif('warning', PCM_READ_ONLY_MESSAGE);
      return;
    }
    if (quickUpdating) return;
    setQuickUpdating(s.id);
    try {
      const updates: Partial<Programacao> = { situacao: newStatus };
      if (newStatus === 'ENCERRADO') {
        updates.dataRealizada = getLocalDateStr(new Date());
      }
      const { sheetError } = await onUpdate(s.id, updates);
      if (sheetError) showNotif('error', `Não foi possível atualizar: ${sheetError}`);
      else showNotif('success', `Frota ${s.frota} → ${newStatus}`);
    } finally {
      setQuickUpdating(null);
    }
  };

  // ─── Adiar: empurra a data programada em +1 dia e volta para PROGRAMADO ────
  const postponeSchedule = async (s: Programacao) => {
    if (isPcmSchedule(s)) {
      showNotif('warning', PCM_READ_ONLY_MESSAGE);
      return;
    }
    if (quickUpdating) return;
    setQuickUpdating(s.id);
    try {
      const base = s.dataProgramada ? parseISO(s.dataProgramada) : new Date();
      const next = new Date(isValid(base) ? base : new Date());
      next.setDate(next.getDate() + 1);
      const iso = getLocalDateStr(next);
      const { sheetError } = await onUpdate(s.id, { dataProgramada: iso, situacao: 'PROGRAMADO' });
      if (sheetError) showNotif('error', `Não foi possível adiar: ${sheetError}`);
      else showNotif('success', `Frota ${s.frota} adiada para ${format(next, 'dd/MM', { locale: ptBR })}`);
    } finally {
      setQuickUpdating(null);
    }
  };

  // ─── Copiar resumo do turno (pronto para colar no WhatsApp) ───────────────
  const copyResumoTurno = async () => {
    const dateLabel = format(now, "dd/MM/yyyy", { locale: ptBR });
    const t = turnoStats;
    const emoji = t.pct === 100 ? '✅' : t.atrasadas > 0 ? '⚠️' : '🔧';
    const lines = [
      `${emoji} *RESUMO DO TURNO — Lavagem e Lubrificação*`,
      `📅 ${dateLabel}`,
      ``,
      `• Total do dia: ${t.total}`,
      `• ✅ Concluídas: ${t.encerradas} (${t.pct}%)`,
      `• 🔵 Programadas: ${t.programadas}`,
      `• 🟣 Em andamento: ${t.andamento}`,
      `• 🟡 Pendentes: ${t.pendentes}`,
      `• 🔴 Atrasadas: ${t.atrasadas}`,
    ];
    if (t.atrasadas > 0) {
      const atrasadasHoje = schedules
        .filter(s => s.dataProgramada === getLocalDateStr(now) && s.situacao === 'ATRASADO')
        .map(s => s.frota);
      if (atrasadasHoje.length) {
        lines.push(``, `Atenção (atrasadas): ${atrasadasHoje.join(', ')}`);
      }
    }
    lines.push(``, `_BRANCO PERES — Controle de Manutenção_`);
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showNotif('success', 'Resumo do turno copiado! Cole no WhatsApp 📋');
    } catch {
      showNotif('warning', 'Não foi possível copiar automaticamente. Copie manualmente.');
      // fallback simples
      try { window.prompt('Copie o resumo do turno:', text); } catch { /* ignore */ }
    }
  };

  const handleSave = async () => {
    if (!form.frota?.trim()) { showNotif('error', 'Frota é obrigatória'); return; }
    setSaveError('');
    setSaving(true);
    try {
      if (editId) {
        const { sheetError } = await onUpdate(editId, form);
        if (sheetError) { setSaveError(sheetError); showNotif('error', `Não foi possível salvar: ${sheetError}`); return; }
        showNotif('success', 'Alterações salvas no controle compartilhado.');
      } else {
        const newItem: Programacao = {
          id: nanoid(),
          frota: form.frota!,
          descricaoPonto: form.descricaoPonto || 'LAVADOR',
          tipoPreventiva: form.tipoPreventiva || 'Lavagem / Lubrificação',
          dataProgramada: form.dataProgramada || '',
          dataRealizada: form.dataRealizada || '',
          situacao: form.situacao || 'PROGRAMADO',
          horarioAgendado: form.horarioAgendado || '',
          observacao: form.observacao || '',
          origemRegistro: 'MANUAL',
        };
        if (onAddSingle) {
          const { success, sheetError } = await onAddSingle(newItem);
          if (sheetError || !success) { const error = sheetError || 'Não foi possível salvar.'; setSaveError(error); showNotif('error', error); return; }
          else if (success) showNotif('success', 'Adicionado na planilha!');
        } else {
          const { sheetErrors } = await onAdd([newItem]);
          if (sheetErrors.length > 0) { setSaveError(sheetErrors[0]); showNotif('error', sheetErrors[0]); return; }
          else showNotif('success', 'Adicionado na planilha!');
        }
      }
      setShowModal(false); setEditId(null); setForm(emptyForm());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.';
      setSaveError(message); showNotif('error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const item = schedules.find(s => s.id === id);
    if (item && isPcmSchedule(item)) {
      showNotif('warning', PCM_READ_ONLY_MESSAGE);
      return;
    }
    if (!confirm(`Excluir frota ${item?.frota}?\n\nEsta ação removerá o registro da planilha e não pode ser desfeita.`)) return;
    setDeleting(id);
    try {
      const { sheetError } = await onDelete(id);
      if (sheetError) showNotif('error', `Não foi possível excluir: ${sheetError}`);
      else showNotif('success', 'Excluído da planilha!');
    } finally {
      setDeleting(null);
    }
  };

  // ─── Barra de Progresso do Turno ──────────────────────────────────────────
  const turnoBar = turnoStats.total > 0 && (
    <div className={`rounded-xl p-4 shadow-sm transition-all duration-300 ${
      isDark ? 'glass-card' : 'bg-white border border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className={isDark ? 'text-[var(--brand-green)]' : 'text-green-600'} />
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Turno de Hoje
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
            turnoStats.pct === 100
              ? 'bg-green-100 text-green-700'
              : turnoStats.pct >= 50
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
          }`}>
            {turnoStats.pct}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {turnoStats.atrasadas > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-semibold">
              <AlertTriangle size={12} /> {turnoStats.atrasadas} atrasadas
            </span>
          )}
          {turnoStats.andamento > 0 && (
            <span className="flex items-center gap-1 text-purple-500 font-semibold">
              <Play size={12} /> {turnoStats.andamento} em andamento
            </span>
          )}
          <span className={`font-medium ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
            {turnoStats.encerradas}/{turnoStats.total} concluídas
          </span>
          <button
            onClick={copyResumoTurno}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all duration-200 ${
              isDark
                ? 'bg-[var(--brand-green)]/15 border border-[var(--brand-green)]/30 text-[var(--brand-green)] hover:bg-[var(--brand-green)]/25'
                : 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100'
            }`}
            title="Copiar resumo do turno (pronto para WhatsApp)"
          >
            <Copy size={12} /> <span className="hidden sm:inline">Copiar resumo</span>
          </button>
        </div>
      </div>
      {/* Barra de progresso */}
      {isVerdan ? (
        <VerdanSegmentedProgress
          pct={turnoStats.pct}
          blocks={6}
          label={`Progresso do turno: ${turnoStats.pct}%`}
        />
      ) : (
        <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
          <div className="h-full flex">
            {turnoStats.encerradas > 0 && (
              <div
                className="bg-gradient-to-r from-green-500 to-green-400 transition-all duration-700 ease-out"
                style={{ width: `${(turnoStats.encerradas / turnoStats.total) * 100}%` }}
              />
            )}
            {turnoStats.andamento > 0 && (
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-400 transition-all duration-700 ease-out"
                style={{ width: `${(turnoStats.andamento / turnoStats.total) * 100}%` }}
              />
            )}
            {turnoStats.atrasadas > 0 && (
              <div
                className="bg-gradient-to-r from-red-500 to-red-400 animate-pulse transition-all duration-700 ease-out"
                style={{ width: `${(turnoStats.atrasadas / turnoStats.total) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}
      {/* Mini cards de status */}
      <div className="flex gap-2 mt-3">
        {[
          { label: 'Programadas', count: turnoStats.programadas, color: isDark ? 'text-blue-400' : 'text-blue-600', bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50' },
          { label: 'Pendentes', count: turnoStats.pendentes, color: isDark ? 'text-amber-400' : 'text-amber-600', bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50' },
          { label: 'Andamento', count: turnoStats.andamento, color: isDark ? 'text-purple-400' : 'text-purple-600', bg: isDark ? 'bg-purple-500/10' : 'bg-purple-50' },
          { label: 'Encerradas', count: turnoStats.encerradas, color: isDark ? 'text-green-400' : 'text-green-600', bg: isDark ? 'bg-green-500/10' : 'bg-green-50' },
          { label: 'Atrasadas', count: turnoStats.atrasadas, color: isDark ? 'text-red-400' : 'text-red-600', bg: isDark ? 'bg-red-500/10' : 'bg-red-50' },
        ].filter(c => c.count > 0).map(c => (
          <div key={c.label} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${c.bg} ${c.color}`}>
            <span className="text-base font-black">{c.count}</span>
            <span className="opacity-80">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Tabela isolada para manter a organização e ações sempre visíveis.
  const tableContent = (
    <LubricationScheduleTable schedules={filtered} sortField={sortField} sortDir={sortDir} onSort={handleSort}
      onEdit={openEdit} onDelete={id => void handleDelete(id)} onQuick={(schedule, status) => void quickStatusChange(schedule, status)}
      onPostpone={schedule => void postponeSchedule(schedule)} onOpenFrota={setHistoricoFrota} quickUpdating={quickUpdating} deleting={deleting} />
  );

  const cardContent = (
    <LubricationScheduleTable schedules={filtered} sortField={sortField} sortDir={sortDir} onSort={handleSort}
      onEdit={openEdit} onDelete={id => void handleDelete(id)} onQuick={(schedule, status) => void quickStatusChange(schedule, status)}
      onPostpone={schedule => void postponeSchedule(schedule)} onOpenFrota={setHistoricoFrota} quickUpdating={quickUpdating} deleting={deleting} compactCards />
  );

  const mainContent = (
    <div
      className={`lub-module lub-operations-v1011 flex flex-col space-y-4 ${
        fullscreen
          ? `lub-fullscreen fixed inset-0 z-[55] overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-5 ${
              isVerdan ? 'bg-[#050d08]' : isDark ? 'bg-[var(--bg-primary)]' : 'bg-[#f4f0e3]'
            }`
          : ''
      }`}
    >
      {fullscreen && <AmbientBrandWatermark variant="fullscreen" />}
      {!compactHeader && <section className="lub-hero" aria-labelledby="lub-title">
        <div className="lub-brand"><img src="/logo.png" alt="Branco Peres Agro S/A" /><div><p className="lub-eyebrow">Manutenção &amp; Frota · Controle operacional</p><h2 id="lub-title">Lavagem e Lubrificação</h2><p>Programação, execução e histórico organizados em um só lugar.</p></div></div>
        <div className="lub-hero-total"><strong>{filtered.length}</strong><span>Ordens na seleção</span></div>
      </section>}
      {/* Ações do controle */}
      <div className="lub-toolbar flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="lub-toolbar-title">Programações de serviço</h2>
          <p className={`text-sm ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
            {filtered.length} de {schedules.length} registros
            {hideEncerradas && <span className={isDark ? ' text-amber-400' : ' text-amber-600'}> ({hideableEncerradasCount} encerradas ocultas pelo corte das 07:10)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Alternador de visualização: Tabela / Cartões / Quadro (Kanban) */}
          <div className={`flex items-center rounded-lg p-0.5 ${isDark ? 'bg-[var(--bg-tertiary)] border border-white/10' : 'bg-gray-100 border border-gray-200'}`}>
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'tabela'
                  ? (isDark ? 'bg-[var(--brand-green)] text-black' : 'bg-white text-green-700 shadow-sm')
                  : (isDark ? 'text-[var(--text-muted)] hover:text-white' : 'text-gray-500 hover:text-gray-800')
              }`}
              title="Ver como tabela"
            >
              <Table2 size={14} /> <span className="hidden sm:inline">Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('cartoes')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'cartoes'
                  ? (isDark ? 'bg-[var(--brand-green)] text-black' : 'bg-white text-green-700 shadow-sm')
                  : (isDark ? 'text-[var(--text-muted)] hover:text-white' : 'text-gray-500 hover:text-gray-800')
              }`}
              title="Ver como cartões compactos"
            >
              <LayoutGrid size={14} /> <span className="hidden sm:inline">Cartões</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? (isDark ? 'bg-[var(--brand-green)] text-black' : 'bg-white text-green-700 shadow-sm')
                  : (isDark ? 'text-[var(--text-muted)] hover:text-white' : 'text-gray-500 hover:text-gray-800')
              }`}
              title="Ver como quadro (arrastar e soltar)"
            >
              <LayoutGrid size={14} /> <span className="hidden sm:inline">Quadro</span>
            </button>
          </div>

          {encerradasCount > 0 && (
            <button
              onClick={toggleHideEncerradas}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                hideEncerradas
                  ? isDark
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                    : 'bg-amber-100 border border-amber-400 text-amber-700 hover:bg-amber-200'
                  : isDark
                    ? 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25'
                    : 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100'
              }`}
              title={hideEncerradas ? 'Mostrar todas as encerradas' : `Ocultar ${hideableEncerradasCount} encerradas anteriores ao corte das 07:10`}
            >
              {hideEncerradas ? <Eye size={15} /> : <EyeOff size={15} />}
              <span className="hidden sm:inline">
                {hideEncerradas ? 'Mostrar Encerradas' : `Ocultar Encerradas (${hideableEncerradasCount})`}
              </span>
            </button>
          )}
          <button
            onClick={() => { setPcmHistoryFocus(null); setShowPcmHistory(value => !value); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              showPcmHistory
                ? (isDark ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300' : 'bg-cyan-50 border border-cyan-300 text-cyan-700')
                : (isDark ? 'bg-[var(--bg-tertiary)] border border-white/10 text-[var(--text-secondary)] hover:text-white' : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200')
            }`}
            title="Carregar o histórico de encerradas PCM"
          >
            <Clock size={15} /> <span>Histórico de Encerradas</span>
          </button>
          <button
            onClick={() => setShowAdvancedFilters(f => !f)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isDark
                ? showAdvancedFilters ? 'bg-[var(--brand-green)] text-black' : 'bg-[var(--bg-tertiary)] border border-white/10 text-gray-400'
                : showAdvancedFilters ? 'bg-green-600 text-white' : 'bg-gray-100 border border-gray-300 text-gray-700'
            }`}
          >
            Filtros
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(f => !f)}
            className={`flex items-center gap-1.5 p-2 border rounded-lg transition-colors ${isDark ? 'border-white/10 hover:bg-[var(--bg-tertiary)]' : 'border-gray-200 hover:bg-gray-50'}`}
            aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-pressed={fullscreen}
            title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {fullscreen && <span className="text-xs font-semibold">Sair da tela cheia</span>}
          </button>
          <button
            onClick={toggleCompactHeader}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              compactHeader
                ? (isDark ? 'bg-[var(--brand-green)] text-black' : 'bg-green-600 text-white')
                : (isDark ? 'bg-[var(--bg-tertiary)] border border-white/10 text-[var(--text-secondary)] hover:text-white' : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200')
            }`}
            title={compactHeader ? 'Expandir painel (mostrar resumo do turno)' : 'Minimizar painel — deixar só as programações'}
          >
            {compactHeader ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            <span className="hidden sm:inline">{compactHeader ? 'Expandir' : 'Minimizar'}</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Plus size={16} /> Nova Programação
          </button>
        </div>
      </div>

      {!compactHeader && isVerdan && (
        <section className="verdan-overview-grid" aria-label="Visão geral animada da operação">
          <div className="verdan-col-span-5">
            <VerdanSparklineCard
              title="Ordens na seleção"
              value={filtered.length}
              unit="ordens"
              badge={verdanMetrics.delayedInSelection > 0 ? `${verdanMetrics.delayedInSelection} atrasadas` : 'Em dia'}
              badgeTone={verdanMetrics.delayedInSelection > 0 ? 'coral' : 'lime'}
              series={verdanMetrics.sparkSeries}
              icon={<Zap size={14} />}
            />
          </div>
          <div className="verdan-col-span-4">
            <VerdanLollipopStrip
              title="Frentes & Locais ativos"
              value={verdanMetrics.activeCount}
              badge={verdanMetrics.localChipLabel}
              items={verdanMetrics.localItems}
              icon={<Play size={13} />}
            />
          </div>
          <div className="verdan-col-span-3">
            <div className="verdan-widget-card verdan-stagger-item items-center justify-center">
              <div className="verdan-widget-card__head w-full">
                <span className="verdan-widget-card__title">Conclusão Operacional</span>
                <span className="verdan-widget-card__icon"><CheckCircle2 size={14} /></span>
              </div>
              <VerdanRadialGauge
                valuePct={verdanMetrics.overallPct}
                label={turnoStats.total > 0 ? 'TURNO HOJE' : 'CONCLUÍDO'}
                size={156}
              />
            </div>
          </div>
        </section>
      )}
      {!compactHeader && <section className="lub-kpis" aria-label="Situação das programações na seleção">
        {([
          { status: 'ATRASADO', label: 'Atrasadas', color: '#f87171', icon: AlertTriangle },
          { status: 'PROGRAMADO', label: 'Programadas', color: '#38bdf8', icon: CalendarClock },
          { status: 'PENDENTE', label: 'Pendentes', color: '#fbbf24', icon: Clock },
          { status: 'ANDAMENTO', label: 'Em andamento', color: '#a78bfa', icon: Play },
          { status: 'ENCERRADO', label: 'Encerradas', color: '#b7ed40', icon: CheckCircle2 },
        ] as const).map(item => <button type="button" key={item.status} className={`lub-kpi${filterStatus === item.status ? ' is-selected' : ''}`} style={{ '--lub-kpi-color': item.color } as React.CSSProperties} aria-pressed={filterStatus === item.status} onClick={() => setFilterStatus(filterStatus === item.status ? 'TODOS' : item.status)}><span className="lub-kpi-label">{item.label}<item.icon size={15} /></span><strong>{isVerdan ? <VerdanCountUp value={filtered.filter(schedule => schedule.situacao === item.status).length} /> : filtered.filter(schedule => schedule.situacao === item.status).length}</strong><small>Ordens na seleção atual</small></button>)}
      </section>}
      {/* Barra de Progresso do Turno */}
      {!compactHeader && turnoBar}

      {/* Info de encerradas ocultas */}
      {!compactHeader && hideEncerradas && hideableEncerradasCount > 0 && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
          isDark ? 'bg-amber-950/30 text-amber-400 border border-amber-800/40' : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <EyeOff size={16} />
          <span>
            {hideableEncerradasCount} encerradas ocultas automaticamente por estarem antes do corte das 07:10
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggleHideEncerradas} className={`text-xs font-bold underline ${isDark ? 'text-amber-300 hover:text-amber-200' : 'text-amber-800 hover:text-amber-900'}`}>
              Mostrar novamente
            </button>
          </div>
        </div>
      )}

      {showAdvancedFilters && (
        <FilterPanel filters={advancedFilters} onFiltersChange={setAdvancedFilters} onClose={() => setShowAdvancedFilters(false)} />
      )}

      {notification && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium animate-fade-in ${
          isDark
            ? notification.type === 'success' ? 'bg-green-950/30 text-green-400 border border-green-800/40' :
              notification.type === 'error' ? 'bg-red-950/30 text-red-400 border border-red-800/40' :
              'bg-amber-950/30 text-amber-400 border border-amber-800/40'
            : notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              notification.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {notification.msg}
        </div>
      )}

      {showPcmHistory && (
        <PCMHistoryPanel
          hideMainEquipment
          isDark={isDark}
          focusId={pcmHistoryFocus}
          onClose={() => { setShowPcmHistory(false); setPcmHistoryFocus(null); }}
        />
      )}

      {/* Filters */}
      <div className={`lub-filter-panel flex flex-wrap gap-2 items-center rounded-xl p-3 shadow-sm ${isDark ? 'glass-card' : 'bg-white border border-gray-200'}`}>
        <div className="lub-filter-title"><strong>Localizar e organizar ordens</strong><span>Frota · Serviço · Situação · Grupo Apoio</span></div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-400'}`} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar programações" placeholder="Buscar frota, OS, apoio, narrativa..."
            className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input placeholder-[var(--text-muted)]' : 'bg-white border-gray-300 text-gray-900'}`}
          />
        </div>
        <select
          aria-label="Filtrar status" value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}
        >
          <option value="TODOS">Todos os status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          aria-label="Filtrar serviço" value={filterTipo}
          onChange={e => setFilterTipo(e.target.value)}
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}
        >
          <option value="TODOS">Todos os tipos</option>
          {TIPO_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          aria-label="Filtrar origem" value={filterOrigin}
          onChange={e => setFilterOrigin(e.target.value as 'TODOS' | 'PCM' | 'MANUAL')}
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}
        >
          <option value="TODOS">Origem: Todos</option>
          <option value="PCM">Origem: PCM</option>
          <option value="MANUAL">Origem: Manual</option>
        </select>
        <select
          aria-label="Filtrar grupo Apoio" value={filterApoio}
          onChange={e => setFilterApoio(e.target.value)}
          disabled={apoioOptions.length === 0}
          className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}
        >
          <option value="TODOS">Grupo Apoio: Todos</option>
          {apoioOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <label className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-sm ${isDark ? 'glass-input text-[var(--text-secondary)]' : 'bg-white border-gray-300 text-gray-700'}`} title="Filtra de segunda a domingo da semana escolhida">
          <span className="text-xs whitespace-nowrap">Semana</span>
          <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} className="bg-transparent focus:outline-none text-sm" />
        </label>
        {weekRange && (
          <button
            onClick={() => setWeekDate('')}
            className={`text-xs flex items-center gap-1 ${isDark ? 'text-amber-300 hover:text-amber-200' : 'text-amber-700 hover:text-amber-900'}`}
          >
            <X size={12} /> Limpar semana
          </button>
        )}
        <div className="flex flex-wrap items-center gap-1.5 w-full pt-1">
          <span className={`text-[11px] font-semibold mr-0.5 ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>Atalhos:</span>
          {QUICK_TIPO_OPTIONS.map(tipo => (
            <button
              key={tipo}
              onClick={() => setFilterTipo(filterTipo === tipo ? 'TODOS' : tipo)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                filterTipo === tipo
                  ? (isDark ? 'bg-[var(--brand-green)] text-black border-[var(--brand-green)]' : 'bg-green-600 text-white border-green-600')
                  : (isDark ? 'bg-white/5 text-[var(--text-secondary)] border-white/10 hover:bg-white/10' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100')
              }`}
            >
              {tipo === 'Lavagem / Lubrificação' ? 'Lavagem/Lubrificação' : tipo} ({quickTipoCounts[tipo] || 0})
            </button>
          ))}
        </div>
        {(search || filterStatus !== 'TODOS' || filterTipo !== 'TODOS' || filterOrigin !== 'PCM' || filterApoio !== 'TODOS' || weekDate) && (
          <button
            onClick={() => { setSearch(''); setFilterStatus('TODOS'); setFilterTipo('TODOS'); setFilterOrigin('PCM'); setFilterApoio('TODOS'); setWeekDate(''); }}
            className={`text-xs flex items-center gap-1 ${isDark ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Table / Kanban */}
      {viewMode === 'tabela' ? (
        <div className={`lub-table-panel rounded-xl shadow-sm ${fullscreen ? '' : 'overflow-hidden'} ${isDark ? 'glass-card' : 'bg-white border border-gray-200'}`}>
          <div className="lub-table-caption"><strong>Ordens de serviço · {filtered.length}</strong><span>Edição disponível na coluna Ações</span></div>
          {tableContent}
        </div>
      ) : viewMode === 'cartoes' ? (
        <div className={`lub-table-panel lub-cards-panel rounded-xl shadow-sm ${fullscreen ? '' : 'overflow-hidden'} ${isDark ? 'glass-card' : 'bg-white border border-gray-200'}`}>
          <div className="lub-table-caption"><strong>Cartões de serviço · {filtered.length}</strong><span>Toque em Ver detalhes para consultar a narrativa completa</span></div>
          {cardContent}
        </div>
      ) : (
        <div>
          <TurnoKanban
            schedules={filtered}
            isDark={isDark}
            quickUpdating={quickUpdating}
            onQuick={quickStatusChange}
            onPostpone={postponeSchedule}
            onOpenFrota={setHistoricoFrota}
            onEdit={openEdit}
          />
        </div>
      )}

      {/* Stats bar */}
      <div className={`flex flex-wrap gap-3 text-xs ${isDark ? 'text-[var(--text-muted)]' : 'text-gray-500'}`}>
        {(['ATRASADO', 'PENDENTE', 'PROGRAMADO', 'ANDAMENTO', 'ENCERRADO'] as StatusType[]).map(s => (
          <span key={s} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${
              s === 'ATRASADO'  ? 'bg-red-500 animate-pulse' :
              s === 'PENDENTE'  ? 'bg-amber-400' :
              s === 'PROGRAMADO'? 'bg-blue-500' :
              s === 'ANDAMENTO' ? 'bg-purple-500 animate-pulse' :
              'bg-green-500'
            }`} />
            <span className={`font-medium ${
              s === 'ATRASADO'  ? (isDark ? 'text-red-400' : 'text-red-700') :
              s === 'PENDENTE'  ? (isDark ? 'text-amber-400' : 'text-amber-700') :
              s === 'PROGRAMADO'? (isDark ? 'text-blue-400' : 'text-blue-700') :
              s === 'ANDAMENTO' ? (isDark ? 'text-purple-400' : 'text-purple-700') :
              (isDark ? 'text-green-400' : 'text-green-700')
            }`}>{s}: {schedules.filter(x => x.situacao === s).length}</span>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {!fullscreen && <div className="fade-in">{mainContent}</div>}
      {fullscreen && mainContent}

      {/* Modal Adicionar/Editar */}
      {showModal && (typeof document !== 'undefined' ? createPortal(
        <div
          className="lub-module lub-premium-modal fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lub-edit-title"
          onClick={() => { if (!saving) closeModal(); }}
        >
          <div className={`lub-modal rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isDark ? 'glass-card' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-white/[0.08]' : 'border-gray-100'}`}>
              <h3 id="lub-edit-title" className={`text-base font-bold ${isDark ? 'text-[var(--text-primary)]' : 'text-gray-900'}`}>
                {editId ? 'Editar Programação' : 'Nova Programação'}
              </h3>
              <button onClick={closeModal} disabled={saving} aria-label="Fechar edição" className={`${isDark ? 'text-[var(--text-muted)] hover:text-[var(--text-primary)]' : 'text-gray-400 hover:text-gray-600'}`}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {editingPcm && <div className="lub-modal-note"><strong>OS {editingSchedule?.numeroOS} · Ajuste da programação</strong><p>Você pode editar os dados operacionais. A identidade da frota e da OS é mantida. Mudanças de situação no PCM e o reaparecimento da ordem atualizam o status automaticamente.</p><p>A data realizada automática usa o dia em que o sistema detectou a saída da ordem da Gestão de Ordens. Uma data informada por você tem prioridade.</p></div>}
              {saveError && <div className="lub-modal-error" role="alert">{saveError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Frota *</label>
                  <input aria-label="Frota" disabled={editingPcm || saving} value={form.frota || ''} onChange={e => setForm(f => ({ ...f, frota: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input placeholder-[var(--text-muted)]' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Ex: 8823" />
                </div>
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Local</label>
                  <input aria-label="Local" value={form.descricaoPonto || ''} onChange={e => setForm(f => ({ ...f, descricaoPonto: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input placeholder-[var(--text-muted)]' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="LAVADOR / CAMPO" list={editingPcm ? "lub-pcm-locais" : undefined} />
                  {editingPcm && <datalist id="lub-pcm-locais"><option value="LAVADOR" /><option value="CAMPO" /></datalist>}
                </div>
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Tipo de Preventiva</label>
                <select aria-label="Tipo de preventiva" value={form.tipoPreventiva || ''} onChange={e => setForm(f => ({ ...f, tipoPreventiva: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}>
                  {(editingPcm ? QUICK_TIPO_OPTIONS : TIPO_OPTIONS).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Data Programada</label>
                  <input type="date" aria-label="Data programada" value={form.dataProgramada || ''} onChange={e => setForm(f => ({ ...f, dataProgramada: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`} />
                </div>
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Data Realizada</label>
                  <input type="date" aria-label="Data realizada" value={form.dataRealizada || ''} onChange={e => setForm(f => ({ ...f, dataRealizada: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Horário Agendado</label>
                  <input type="time" aria-label="Horário agendado" value={form.horarioAgendado || ''} onChange={e => setForm(f => ({ ...f, horarioAgendado: e.target.value }))} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`} />
                </div>
                <div>
                  <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Status</label>
                  <select aria-label="Status" value={form.situacao || 'PROGRAMADO'} onChange={e => setForm(f => ({ ...f, situacao: e.target.value as StatusType }))} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${isDark ? 'glass-input' : 'bg-white border-gray-300 text-gray-900'}`}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-gray-600'}`}>Observação</label>
                <textarea aria-label="Observação" value={form.observacao || ''} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} rows={2} className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none ${isDark ? 'glass-input placeholder-[var(--text-muted)]' : 'bg-white border-gray-300 text-gray-900'}`} placeholder="Observações adicionais..." />
              </div>
            </div>
            <div className={`flex gap-3 p-5 border-t ${isDark ? 'border-white/[0.08]' : 'border-gray-100'}`}>
              <button onClick={closeModal} disabled={saving} className={`px-4 py-2 border rounded-lg text-sm ${isDark ? 'border-white/10 text-[var(--text-secondary)] hover:bg-white/5' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                {saving ? 'Salvando…' : editId ? 'Salvar alterações' : 'Adicionar programação'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null)}

      {/* Modal de Histórico por Frota */}
      {historicoFrota && (
        <HistoricoFrotaModal
          frota={historicoFrota}
          schedules={schedules}
          isDark={isDark}
          onClose={() => setHistoricoFrota(null)}
        />
      )}
    </>
  );
}
