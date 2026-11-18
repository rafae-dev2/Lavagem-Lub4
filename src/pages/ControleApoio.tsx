import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, FileText, Download, Plus, Save, Trash2, Search, AlertTriangle, Truck, Wrench, Building2, Clock, Settings2, MessageSquare, ClipboardList, CalendarDays, CheckCircle2, Filter, Eye } from 'lucide-react';
import { loadApoioData, saveApoioGroup, deleteApoioGroup, saveApoioFleet, deleteApoioFleet, syncApoio } from '../lib/apoioService';
import { isNavigatorOnline, isPageVisible } from '../lib/egressCachePolicy';
import { exportApoioPDF, exportApoioExcel } from '../lib/apoioReport';
import { exportApoioImages, APOIO_IMAGE_FORMATS, type ApoioImageFormat, type ApoioImageQuality } from '../lib/apoioImageReport';
import { exportOficinaTerceirosExcel, exportOficinaTerceirosImages } from '../lib/apoioOficinaTerceirosReport';
import {
  OFICINA_REPORT_FORMATS,
  OFICINA_REPORT_QUALITIES,
  OFICINA_TERCEIROS_IMAGE,
  filterOficinaTerceirosEntries,
  oficinaReportTitle,
  oficinaScopeLabel,
  oficinaTerceirosProviderOptions,
  oficinaTerceirosSummary,
  readStoredOficinaFormat,
  readStoredOficinaQuality,
  readStoredOficinaScope,
  resolveOficinaRenderDimensions,
  saveStoredOficinaFormat,
  saveStoredOficinaQuality,
  saveStoredOficinaScope,
  selectOficinaReportEquipment,
  selectOficinaReportOrders,
  type OficinaReportFormat,
  type OficinaReportQuality,
  type OficinaTerceirosScope,
} from '../lib/apoioOficinaTerceirosData';
import { ApoioData, ApoioFleet, ApoioGroup, ApoioReportOptions, ApoioReportRow, diasEmAberto, diasObservados, oficinaLabel } from '../types/apoio';
import { apoioBaseRows, apoioOrderStatusLabel, filterApoioRows, reconcileApoioFleetSelection } from '../lib/apoioFilters';
import { getMaintenanceOrderClosure } from '../lib/maintenanceTracking';
import { DEFAULT_APOIO_RECENCY, apoioRecencyTimestamp, selectApoioRecency, apoioRecencyBounds, apoioRecencySummary, type ApoioRecencyOptions } from '../lib/apoioRecency';
import ApoioOrderCard from '../components/ApoioOrderCard';
import ApoioOrdersTable from '../components/ApoioOrdersTable';
import ApoioMultiSelect from '../components/ApoioMultiSelect';
import ApoioGroupFleetFilter from '../components/ApoioGroupFleetFilter';
import ApoioWhatsAppPanel from '../components/ApoioWhatsAppPanel';
import EquipmentThumbnail from '../components/EquipmentThumbnail';
import { VerdanCountUp } from '../components/VerdanAnimatedWidgets';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/apoio.css';
import '../styles/apoio-premium.css';
import '../styles/apoio-reference.css';
import '../styles/apoio-devices.css';
import '../styles/apoio-compact-table.css';
import '../styles/apoio-refined-filters.css';
import '../styles/apoio-refined-table.css';
import '../styles/maintenance-tracking.css';
import '../styles/maintenance-premium.css';
import '../styles/operational-compact.css';
import '../styles/apoio-reformas-aligned.css';
import '../styles/mobile-operations-v1011.css';
import { formatApoioDate as fmt, isApoioSourceStale } from '../lib/apoioDate';
import '../styles/apoio-sticky-search.css';
import '../styles/apoio-image-reports.css';

const panel: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 12 };
const field: React.CSSProperties = { background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', borderRadius: 10, padding: '9px 12px', width: '100%' };
const muted: React.CSSProperties = { color: 'var(--text-secondary)' };
const buttonClass = 'apoio-button inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity hover:opacity-80';
const green: React.CSSProperties = { background: 'var(--brand-green)', color: 'var(--apoio-surface)' };
const neutral: React.CSSProperties = { background: 'var(--bg-hover)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' };
const msg = (err: unknown) => err instanceof Error ? err.message : String(err);
const PAGE_SIZE = 40;
type View = 'abertas' | 'classificar' | 'historico' | 'encerradas';
type DisplayMode = 'cards' | 'table';
const DISPLAY_MODE_STORAGE_KEY = 'branco-peres-apoio-display-mode';

function initialDisplayMode(): DisplayMode {
  if (typeof window === 'undefined') return 'cards';
  try {
    return window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

export default function ControleApoio() {
  const { theme } = useTheme();
  const isVerdan = theme === 'verdan';
  const [data, setData] = useState<ApoioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'ordens' | 'cadastros'>('ordens');
  const [view, setView] = useState<View>('abertas');
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialDisplayMode);
  const [query, setQuery] = useState('');
  const [groupsFilter, setGroupsFilter] = useState<string[]>([]);
  const [fleetsByGroup, setFleetsByGroup] = useState<Record<string, string[]>>({});
  const [origins, setOrigins] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [providersFilter, setProvidersFilter] = useState<string[]>([]);
  const [recency, setRecency] = useState<ApoioRecencyOptions>({...DEFAULT_APOIO_RECENCY});
  const [recencyClock, setRecencyClock] = useState(() => new Date());
  useEffect(() => {const timer=window.setInterval(()=>setRecencyClock(new Date()),30_000);return ()=>window.clearInterval(timer);}, []);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [imageFormat, setImageFormat] = useState<ApoioImageFormat>('celular');
  const [imageQuality, setImageQuality] = useState<ApoioImageQuality>('ultra');
  const [oficinaScope, setOficinaScope] = useState<OficinaTerceirosScope>(readStoredOficinaScope);
  const [oficinaFormat, setOficinaFormat] = useState<OficinaReportFormat>(readStoredOficinaFormat);
  const [oficinaQuality, setOficinaQuality] = useState<OficinaReportQuality>(readStoredOficinaQuality);
  const [oficinaQuery, setOficinaQuery] = useState('');
  const [oficinaPrestadores, setOficinaPrestadores] = useState<string[]>([]);
  const [oficinaDesmarcados, setOficinaDesmarcados] = useState<string[]>([]);
  const [exportProgress, setExportProgress] = useState('');
  const [groupDraft, setGroupDraft] = useState<ApoioGroup>({ id: '', nome: '', cor: '#20a876' });
  const [fleetDraft, setFleetDraft] = useState({ frotas: '', grupo_id: '', nome: '' });
  const mounted = useRef(true);
  const reading = useRef(false);
  const lastAttemptAt = useRef(0);

  useEffect(() => {
    try { window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode); } catch { /* preferência opcional */ }
  }, [displayMode]);

  useEffect(() => {
    saveStoredOficinaScope(oficinaScope);
  }, [oficinaScope]);

  useEffect(() => {
    saveStoredOficinaFormat(oficinaFormat);
  }, [oficinaFormat]);

  useEffect(() => {
    saveStoredOficinaQuality(oficinaQuality);
  }, [oficinaQuality]);

  const refresh = useCallback(async (consultSource = false, forceRead = false) => {
    if (reading.current) return;
    reading.current = true;
    lastAttemptAt.current = Date.now();
    setRefreshing(true);
    let syncError = '';
    try {
      if (consultSource) {
        try { await syncApoio({ force: forceRead }); } catch (err) { syncError = msg(err); }
      }
      const next = await loadApoioData({ force: forceRead });
      if (mounted.current) { setData(next); setError(syncError); }
    } catch (err) {
      if (mounted.current) setError(msg(err));
    } finally {
      reading.current = false;
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh(false, false);
    const maybeAutoRefresh = () => {
      if (!isPageVisible() || !isNavigatorOnline() || reading.current) return;
      if (Date.now() - lastAttemptAt.current < 60_000) return;
      void refresh(false, false);
    };
    const timer = window.setInterval(maybeAutoRefresh, 3 * 60_000);
    const handleGlobalRefresh = () => { void refresh(true, true); };
    const handleOnline = () => {
      if (!isPageVisible() || !isNavigatorOnline() || reading.current) return;
      void refresh(false, false);
    };
    window.addEventListener('bp:apoio-refresh', handleGlobalRefresh);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', maybeAutoRefresh);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener('bp:apoio-refresh', handleGlobalRefresh);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', maybeAutoRefresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!data) return;
    const next = reconcileApoioFleetSelection(data, groupsFilter, fleetsByGroup);
    if (next.groups !== groupsFilter) setGroupsFilter(next.groups);
    if (next.fleetsByGroup !== fleetsByGroup) setFleetsByGroup(next.fleetsByGroup);
  }, [data?.groups, data?.fleets, groupsFilter, fleetsByGroup]);

  const groupMap = useMemo(() => new Map((data?.groups || []).map(g => [g.id, g])), [data?.groups]);
  const fleetMap = useMemo(() => new Map((data?.fleets || []).map(f => [f.frota, f])), [data?.fleets]);
  const orders = data?.orders || [];
  const closedCount = useMemo(() => orders.filter(order => fleetMap.has(order.frota) && getMaintenanceOrderClosure(order).status === 'encerrado').length, [fleetMap, orders]);
  const baseRows = useMemo(() => apoioBaseRows(data, view), [data, view]);
  const filteredRows = useMemo(() => filterApoioRows(data, baseRows, {
    query, groups: groupsFilter, location: origins, status: statuses, provider: providersFilter, fleetsByGroup,
  }), [data, baseRows, query, groupsFilter, origins, statuses, providersFilter, fleetsByGroup]);
  const rows = useMemo(() => {
    const recencyRows = recency.scheduledAndRunning
      ? filteredRows.filter(row => ['programado', 'andamento'].includes(getMaintenanceOrderClosure(row).status))
      : filteredRows;
    return selectApoioRecency(recencyRows, recency.scheduledAndRunning ? { ...recency, scheduledAndRunning: false } : recency, recencyClock);
  }, [filteredRows, recency, recencyClock]);
  const recencyError = apoioRecencyBounds(recency, recencyClock).error;
  const recencyLabel = apoioRecencySummary(recency);
  useEffect(() => { setPage(1); }, [view, query, groupsFilter, fleetsByGroup, origins, statuses, providersFilter, recency]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {setPage(current => Math.min(Math.max(current, 1), pages));}, [pages]);
  const actualPage = Math.min(page, pages);
  const shown = rows.slice((actualPage - 1) * PAGE_SIZE, actualPage * PAGE_SIZE);
  const stale = isApoioSourceStale(data?.sync?.fonte_atualizada);
  const invalidDates = filteredRows.filter(o => {const t=apoioRecencyTimestamp(o[recency.basis]); return t===null || t>recencyClock.getTime();}).length;
  const providers = [...new Set(baseRows.filter(o => oficinaLabel(o.origem) === 'Oficina Externa').map(o => o.prestador || 'Não informado'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const statusList = ['Programada', 'Andamento', 'Encerrada', 'Outros'];
  const locations = [...new Set(baseRows.map(o => oficinaLabel(o.origem)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const clearFilters = () => { setQuery(''); setGroupsFilter([]); setFleetsByGroup({}); setOrigins([]); setStatuses([]); setProvidersFilter([]); setRecency({...DEFAULT_APOIO_RECENCY}); };
  const showClosed = () => { setView('encerradas'); setStatuses(['Encerrada']); setRecency(current => ({...current,window:'all',start:'',end:'',scheduledAndRunning:false})); setExpanded(null); };
  const showOpen = () => { setView('abertas'); setStatuses([]); setExpanded(null); };
  const showRecent = (scope: 'both' | 'Programada' | 'Andamento') => {setStatuses(scope === 'both' ? [] : [scope]); setRecency(c=>({...c,sort:'newest',scheduledAndRunning:scope==='both'})); setRecencyClock(new Date());};

  const reportFilters = useMemo(() => {
    const fleetSummary = groupsFilter.length
      ? groupsFilter.map(groupId => {
        const groupName = groupMap.get(groupId)?.nome || groupId;
        if (!Object.prototype.hasOwnProperty.call(fleetsByGroup, groupId)) return `Frotas — ${groupName}: todas`;
        const selected = fleetsByGroup[groupId];
        return selected.length ? `Frotas — ${groupName}: ${selected.join(', ')}` : `Frotas — ${groupName}: nenhuma`;
      }).join(' · ')
      : 'Frotas — Todos os grupos: todas';
    return [
    `Visão: ${view === 'abertas' ? 'Nossos equipamentos — ordens abertas' : view === 'historico' ? 'Histórico — encerradas e sem confirmação' : view === 'encerradas' ? 'Ordens encerradas — confirmações operacionais' : 'Ordens não cadastradas como próprias'}`,
    `Apoio: ${groupsFilter.length ? groupsFilter.map(id => groupMap.get(id)?.nome || id).join(', ') : 'Todos os grupos'}`,
    `Origem: ${origins.length ? origins.join(', ') : 'Todas'}`,
    `Status: ${statuses.length ? statuses.join(', ') : 'Todos'}`,
    `Oficina externa: ${providersFilter.length ? providersFilter.join(', ') : 'Todas'}`,
    `Recência: ${recencyLabel}`,
    ...(query.trim() ? [`Busca: ${query.trim()}`] : []),
    fleetSummary,
  ];
  }, [fleetsByGroup, groupMap, groupsFilter, origins, providersFilter, query, statuses, view, recencyLabel]);
  const filtersExcel = reportFilters;
  const oficinaExternaEntries = useMemo(() => selectOficinaReportEquipment(rows, 'externa'), [rows]);
  const oficinaEmergenciaEntries = useMemo(() => selectOficinaReportEquipment(rows, 'emergencia'), [rows]);
  const oficinaJuntosEntries = useMemo(() => selectOficinaReportEquipment(rows, 'juntos'), [rows]);
  const oficinaTerceirosEntries = useMemo(() => {
    if (oficinaScope === 'emergencia') return oficinaEmergenciaEntries;
    if (oficinaScope === 'juntos') return oficinaJuntosEntries;
    return oficinaExternaEntries;
  }, [oficinaEmergenciaEntries, oficinaExternaEntries, oficinaJuntosEntries, oficinaScope]);
  const oficinaTerceirosProviders = useMemo(() => oficinaTerceirosProviderOptions(oficinaTerceirosEntries), [oficinaTerceirosEntries]);
  const oficinaTerceirosFiltered = useMemo(
    () => filterOficinaTerceirosEntries(oficinaTerceirosEntries, { query: oficinaQuery, prestadores: oficinaPrestadores }),
    [oficinaTerceirosEntries, oficinaQuery, oficinaPrestadores],
  );
  const oficinaTerceirosMarcadas = useMemo(() => new Set(oficinaTerceirosFiltered.map(entry => entry.frota)), [oficinaTerceirosFiltered]);
  const oficinaTerceirosSelecionadas = useMemo(
    () => oficinaTerceirosFiltered.filter(entry => !oficinaDesmarcados.includes(entry.frota)),
    [oficinaTerceirosFiltered, oficinaDesmarcados],
  );
  const oficinaTerceirosOcultos = oficinaTerceirosFiltered.length - oficinaTerceirosSelecionadas.length;
  const oficinaScopedOrders = useMemo(
    () => selectOficinaReportOrders(rows, oficinaScope, {
      query: oficinaQuery,
      prestadores: oficinaPrestadores,
      excludedFleets: oficinaDesmarcados,
    }),
    [rows, oficinaScope, oficinaQuery, oficinaPrestadores, oficinaDesmarcados],
  );
  const oficinaTerceirosColors = useMemo(
    () => Object.fromEntries((data?.groups || []).map(group => [group.nome, group.cor])) as Record<string, string>,
    [data?.groups],
  );
  const exportOptions = useMemo<ApoioReportOptions>(() => ({
    rows,
    filters: reportFilters,
    preserveRowOrder: recency.sort !== 'organized',
    filtersExcel,
    sourceUpdated: data?.sync?.fonte_atualizada || null,
    lastSynced: data?.sync?.sincronizado_em || null,
    view: view === 'historico' ? 'Histórico de ordens encerradas e sem confirmação' : view === 'encerradas' ? 'Ordens encerradas dos nossos equipamentos' : view === 'classificar' ? 'Ordens ainda não cadastradas como próprias' : 'Ordens abertas dos nossos equipamentos',
    sourceError: error || data?.sync?.erro || (stale ? 'Dados desatualizados ou data inconsistente.' : null),
  }), [data?.sync?.erro, data?.sync?.fonte_atualizada, data?.sync?.sincronizado_em, error, filtersExcel, reportFilters, rows, stale, view, recency.sort]);

  const runMutation = async (action: () => Promise<void>, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); await refresh(false, true); }
    catch (err) { setError(msg(err)); }
    finally { setBusy(false); }
  };
  const saveGroup = (event: React.FormEvent) => {
    event.preventDefault();
    const nome = groupDraft.nome.trim();
    if (!nome) return;
    if ((data?.groups || []).some(g => g.id !== groupDraft.id && g.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) { setError('Já existe um grupo Apoio com esse nome.'); return; }
    const group = { ...groupDraft, id: groupDraft.id || crypto.randomUUID(), nome };
    void runMutation(async () => {
      await saveApoioGroup(group);
      setGroupDraft({ id: '', nome: '', cor: '#20a876' });
    }, 'Grupo Apoio salvo e compartilhado.');
  };
  const saveFleet = (event: React.FormEvent) => {
    event.preventDefault();
    const frotas = [...new Set(fleetDraft.frotas.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean))];
    if (!frotas.length || !fleetDraft.grupo_id) { setError('Informe a frota e selecione um grupo Apoio.'); return; }
    if (frotas.some(f => !/^[A-Za-z0-9._-]{1,40}$/.test(f))) { setError('Use números ou códigos de frota sem espaços. Separe várias frotas por vírgula.'); return; }
    void runMutation(async () => {
      let saved = 0;
      try {
        for (const frota of frotas) {
          await saveApoioFleet({ frota, grupo_id: fleetDraft.grupo_id, nome: fleetDraft.nome.trim() }); saved++;
        }
      } catch (err) {
        await refresh(false, true);
        throw new Error(`${saved} de ${frotas.length} frotas salvas. ${msg(err)}`);
      }
      setFleetDraft(draft => ({ ...draft, frotas: '', nome: '' }));
    }, `${frotas.length} frota(s) cadastrada(s) no controle próprio.`);
  };
  const assignGroup = async (order: ApoioReportRow, groupId: string) => {
    if (!groupId) return;
    await runMutation(() => saveApoioFleet({ frota: order.frota, grupo_id: groupId, nome: fleetMap.get(order.frota)?.nome || order.modelo }), `Frota ${order.frota} classificada no Apoio.`);
  };
  const exportReport = async (type: 'pdf' | 'xlsx' | 'image') => {
    if (!rows.length) return;
    setExporting(true); setError(''); setNotice(''); setExportProgress('Preparando relatório…');
    try {
      if (type === 'image') {
        const count = await exportApoioImages(exportOptions, imageFormat, imageQuality, progress => {
          setExportProgress(`${progress.phase}${progress.total ? ` · ${progress.current}/${progress.total}` : '…'}`);
        });
        setNotice(`${count} ${count === 1 ? 'imagem PNG gerada' : 'imagens PNG geradas em um ZIP'} com todas as ${rows.length} ordens filtradas. Extraia o ZIP para compartilhar as páginas em ordem.`);
      } else {
        if (type === 'pdf') await exportApoioPDF(exportOptions); else await exportApoioExcel(exportOptions);
        setNotice(`Relatório ${type === 'pdf' ? 'PDF' : 'Excel'} gerado com todas as ${rows.length} ordens filtradas.`);
      }
    } catch (err) { setError(msg(err)); }
    finally { setExporting(false); setExportProgress(''); }
  };

  /** Exportações (PNG, Excel e PDF) do relatório de Oficina de Terceiros / Emergenciais respeitando separado/junto. */
  const exportOficinaTerceiros = async (format: 'png' | 'xlsx' | 'pdf' = 'png') => {
    setExporting(true); setError(''); setNotice(''); setExportProgress('Preparando relatório…');
    try {
      const entries = oficinaTerceirosFiltered
        .filter(entry => !oficinaDesmarcados.includes(entry.frota))
        .map(entry => ({
          ...entry,
          grupo_id: entry.grupo_id || fleetMap.get(entry.frota)?.grupo_id,
        }));
      if (!entries.length) throw new Error('Marque pelo menos um equipamento para gerar o relatório.');
      if (format === 'xlsx') {
        const result = await exportOficinaTerceirosExcel(entries, oficinaScopedOrders, {
          groupColors: oficinaTerceirosColors,
          scope: oficinaScope,
          query: oficinaQuery,
          prestadores: oficinaPrestadores,
        });
        setNotice(`${oficinaReportTitle(oficinaScope)}: planilha Excel exportada com ${result.count} ${result.count === 1 ? 'equipamento' : 'equipamentos'} (${result.orderCount} ${result.orderCount === 1 ? 'ordem' : 'ordens'}).`);
      } else if (format === 'pdf') {
        if (!oficinaScopedOrders.length) throw new Error('Nenhuma ordem vinculada aos equipamentos marcados.');
        await exportApoioPDF({
          ...exportOptions,
          rows: oficinaScopedOrders,
          reportTitle: oficinaReportTitle(oficinaScope),
          view: oficinaReportTitle(oficinaScope),
          filters: [...reportFilters, `Modo do relatório: ${oficinaScopeLabel(oficinaScope)}`],
          filtersExcel: [...filtersExcel, `Modo do relatório: ${oficinaScopeLabel(oficinaScope)}`],
        });
        setNotice(`${oficinaReportTitle(oficinaScope)}: PDF exportado com ${entries.length} ${entries.length === 1 ? 'equipamento' : 'equipamentos'} (${oficinaScopedOrders.length} ${oficinaScopedOrders.length === 1 ? 'ordem' : 'ordens'}).`);
      } else {
        const result = await exportOficinaTerceirosImages(
          entries,
          {
            groupColors: oficinaTerceirosColors,
            scope: oficinaScope,
            format: oficinaFormat,
            quality: oficinaQuality,
          },
          progress => {
            setExportProgress(`${progress.phase}${progress.total ? ` · ${progress.current}/${progress.total}` : '…'}`);
          },
        );
        const fmtLabel = OFICINA_REPORT_FORMATS[result.format].shortLabel;
        const qualLabel = OFICINA_REPORT_QUALITIES[result.quality].shortLabel;
        setNotice(`${oficinaReportTitle(oficinaScope)}: imagem PNG ${result.width} × ${result.height} (${fmtLabel} · ${qualLabel}) baixada com ${result.count} ${result.count === 1 ? 'equipamento' : 'equipamentos'}.`);
      }
    } catch (err) { setError(msg(err)); }
    finally { setExporting(false); setExportProgress(''); }
  };
  const changeOficinaScope = (next: OficinaTerceirosScope) => {
    setOficinaScope(next);
    saveStoredOficinaScope(next);
    setOficinaPrestadores([]);
  };
  const toggleOficinaEquipamento = (frota: string) => {
    setOficinaDesmarcados(current => current.includes(frota) ? current.filter(item => item !== frota) : [...current, frota]);
  };
  const marcarOficinaVisiveis = () => {
    setOficinaDesmarcados(current => current.filter(frota => !oficinaTerceirosMarcadas.has(frota)));
  };
  const desmarcarOficinaVisiveis = () => {
    setOficinaDesmarcados(current => [...new Set([...current, ...oficinaTerceirosFiltered.map(entry => entry.frota)])]);
  };

  return (
    <div className="maintenance-tracking apoio-module apoio-like-reformas apoio-operations-v1011" style={{ color: 'var(--text-primary)' }}>
      <div className="mt-ribbon-layer" aria-hidden="true" />
      <section className="mt-hero" aria-labelledby="apoio-title">
        <div className="mt-hero-brand">
          <img src="/logo.png" alt="Branco Peres Agro" />
          <div>
            <p className="mt-eyebrow">Manutenção de frota / acompanhamento integrado</p>
            <h2 id="apoio-title">Controle de Equipamentos — Apoio</h2>
            <p className="mt-hero-description">Acompanhamento das ordens dos equipamentos cadastrados no Apoio.</p>
          </div>
        </div>
        <div className="mt-hero-actions">
          <span className="mt-source-tag"><Wrench size={17} aria-hidden="true" />Ordens da Gestão de Manutenção</span>
          <button type="button" className="mt-btn mt-btn-primary" disabled={refreshing} onClick={() => void refresh(true, true)}><RefreshCw size={17} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Atualizando…' : 'Atualizar ordens'}</button>
        </div>
      </section>
      <div className="mt-source-line">
        <span><span className={`mt-connection-dot ${stale || error ? 'mt-connection-dot--warning' : ''}`} aria-hidden="true" />{loading ? 'Consultando integração' : !data ? 'Sem fotografia disponível' : stale || error ? 'Atenção à atualização' : 'Integração compartilhada'}</span>
        <span>Fonte: <strong>{fmt(data?.sync?.fonte_atualizada)}</strong></span>
        <span>Sincronização: <strong>{fmt(data?.sync?.sincronizado_em)}</strong></span>
      </div>
      {data && <div className="apoio-section-switcher flex flex-wrap gap-2" role="group" aria-label="Seções do Controle Apoio">
        <button type="button" className={buttonClass} aria-pressed={tab === 'ordens'} style={tab === 'ordens' ? green : neutral} onClick={() => setTab('ordens')}><Wrench size={16} />Ordens e relatórios</button>
        <button type="button" className={buttonClass} aria-pressed={tab === 'cadastros'} style={tab === 'cadastros' ? green : neutral} onClick={() => setTab('cadastros')}><Settings2 size={16} />Grupos Apoio e nossas frotas</button>
      </div>}
      {data && tab === 'ordens' && <>
        <div className="mt-visibility-bar" aria-label="Acesso às ordens encerradas">
          <Eye size={18} aria-hidden="true" /><span>{view === 'encerradas' ? `${rows.length} encerradas nesta seleção` : `${closedCount} ${closedCount === 1 ? 'encerrada' : 'encerradas'} no cadastro próprio, fora da vista aberta`}</span>
          <button type="button" className="mt-visibility-action" onClick={view === 'encerradas' ? showOpen : showClosed}>{view === 'encerradas' ? 'Voltar às abertas' : 'Mostrar encerradas'}</button>
        </div>
        <section className="mt-kpis" aria-label="Indicadores do Controle Apoio">
          {[
            { label: 'Ordens no recorte', value: rows.length, Icon: ClipboardList, hint: `${new Set(rows.map(row => row.frota)).size} frotas distintas` },
            { label: 'Programadas', value: rows.filter(row => getMaintenanceOrderClosure(row).status === 'programado').length, Icon: CalendarDays, hint: 'Programação na origem' },
            { label: 'Em andamento', value: rows.filter(row => getMaintenanceOrderClosure(row).status === 'andamento').length, Icon: Wrench, hint: 'Execução na origem' },
            { label: 'Encerradas', value: closedCount, Icon: CheckCircle2, hint: 'No cadastro próprio' },
          ].map(kpi => <div className="glass-card mt-kpi" key={kpi.label}><span className="mt-kpi-label">{kpi.label}</span><kpi.Icon size={20} aria-hidden="true" /><strong>{isVerdan ? <VerdanCountUp value={kpi.value} /> : kpi.value}</strong><small>{kpi.hint}</small></div>)}
        </section>
      </>}
      {(error || data?.sync?.erro) && <div role="alert" className="p-4 rounded-xl text-sm flex gap-3" style={{ border: '1px solid #d97706', background: 'rgba(217,119,6,.12)' }}><AlertTriangle size={20} className="shrink-0" /><div><strong>Não foi possível concluir a atualização.</strong><p className="mt-1 break-words">{error || data?.sync?.erro}</p><p className="mt-1">Os dados do último conjunto válido são preservados. Se esta é a primeira instalação, configure o SQL, a função sync-ordens e o agendamento seguindo INSTALAR_CONTROLE_APOIO.md no ZIP.</p></div></div>}
      {notice && <p role="status" className="apoio-notice p-3 rounded-xl text-sm">{notice}</p>}
      {data && stale && <p className="apoio-stale text-sm p-3 rounded-xl">A fonte está desatualizada ou sem uma data válida. Não é possível garantir que as ordens abaixo ainda estejam abertas.</p>}
      {loading && <p className="p-6 text-center" style={muted}>Carregando o controle compartilhado…</p>}
      {!loading && !data && <section className="p-6" style={panel}><h3 className="font-bold">A integração compartilhada ainda não está disponível</h3><p className="text-sm mt-2" style={muted}>A nova seção depende das tabelas e da função no Supabase. Nenhuma ordem de exemplo foi inserida e os cadastros não são salvos apenas neste aparelho.</p></section>}

      {data && tab === 'cadastros' && <div className="space-y-5"><button type="button" className="mt-btn" onClick={() => setTab('ordens')}>Voltar às ordens</button>
        <p className="text-xs" style={muted}>Acesso público, conforme solicitado: visitantes podem consultar e editar os grupos e as frotas. As ordens importadas são somente leitura.</p>
        <div className="grid lg:grid-cols-2 gap-5">
          <section className="p-5" style={panel}>
            <h3 className="font-bold text-lg">Criar ou editar grupo Apoio</h3>
            <p className="text-sm mt-1" style={muted}>Exemplos: Veículos Leves, Caminhão Munck e Caminhão Pipa. Os nomes são definidos por você.</p>
            <form className="space-y-3 mt-4" onSubmit={saveGroup}>
              <label className="block text-sm">Nome do grupo<input required maxLength={100} value={groupDraft.nome} onChange={e => setGroupDraft(d => ({ ...d, nome: e.target.value }))} style={field} className="mt-1" placeholder="Ex.: Veículos Leves" /></label>
              <label className="flex items-center gap-3 text-sm">Cor de identificação<input aria-label="Cor do grupo" type="color" value={groupDraft.cor} onChange={e => setGroupDraft(d => ({ ...d, cor: e.target.value }))} /></label>
              <div className="flex gap-2"><button type="submit" className={buttonClass} style={green} disabled={busy}><Save size={16} />{groupDraft.id ? 'Salvar alterações' : 'Criar grupo'}</button>{groupDraft.id && <button type="button" className={buttonClass} style={neutral} onClick={() => setGroupDraft({ id: '', nome: '', cor: '#20a876' })}>Cancelar</button>}</div>
            </form>
            <div className="space-y-2 mt-5">
              {data.groups.map(group => <div key={group.id} className={`glass-card apoio-group-card flex items-center gap-3 p-3 rounded-xl${groupDraft.id === group.id ? ' is-selected' : ''}`} style={{ background: 'var(--bg-hover)' }}><span className="w-3 h-3 rounded-full shrink-0" style={{ background: group.cor }} /><div className="flex-1 min-w-0"><strong className="apoio-group-card__name text-sm block truncate">{group.nome}</strong><p className="text-xs" style={muted}>{data.fleets.filter(f => f.grupo_id === group.id).length} frotas cadastradas</p></div><button className="apoio-group-card__edit text-xs px-2.5 py-1.5 rounded-lg" disabled={busy} onClick={() => setGroupDraft(group)}>Editar</button><button aria-label={`Excluir ${group.nome}`} disabled={busy || data.fleets.some(f => f.grupo_id === group.id)} title="Só é possível excluir grupos sem frotas" onClick={() => { if (window.confirm(`Excluir o grupo ${group.nome}?`)) void runMutation(() => deleteApoioGroup(group.id), 'Grupo excluído.'); }} className="disabled:opacity-30 p-1.5"><Trash2 size={16} /></button></div>)}
              {!data.groups.length && <p className="text-sm" style={muted}>Nenhum grupo cadastrado. Crie o primeiro grupo acima.</p>}
            </div>
          </section>
          <section className="p-5" style={panel}>
            <h3 className="font-bold text-lg">Cadastrar nossas frotas</h3>
            <p className="text-sm mt-1" style={muted}>Somente as frotas cadastradas aparecem no controle próprio. Você pode mudar o grupo de uma frota já cadastrada.</p>
            <form className="space-y-3 mt-4" onSubmit={saveFleet}>
              <label className="block text-sm">Número da frota (ou vários, separados por vírgula)<textarea required rows={2} value={fleetDraft.frotas} onChange={e => setFleetDraft(d => ({ ...d, frotas: e.target.value }))} style={field} className="mt-1" placeholder="Ex.: 4568, 4569" /></label>
              <label className="block text-sm">Grupo Apoio<select required value={fleetDraft.grupo_id} onChange={e => setFleetDraft(d => ({ ...d, grupo_id: e.target.value }))} style={field} className="mt-1"><option value="">Selecione o grupo</option>{data.groups.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></label>
              <label className="block text-sm">Nome do equipamento (opcional)<input maxLength={200} value={fleetDraft.nome} onChange={e => setFleetDraft(d => ({ ...d, nome: e.target.value }))} style={field} className="mt-1" placeholder="Se vazio, usa o modelo informado pela fonte" /></label>
              <button type="submit" className={buttonClass} style={green} disabled={busy || !data.groups.length}><Plus size={16} />Salvar frotas no Apoio</button>
            </form>
          </section>
        </div>
        <section className="p-5" style={panel}>
          <h3 className="font-bold text-lg">Frotas sob nosso controle · {data.fleets.length}</h3>
          <div className="overflow-x-auto mt-4"><table className="w-full text-sm"><thead style={muted}><tr className="text-left"><th className="py-3">Frota</th><th>Equipamento</th><th>Apoio</th><th>Ordens abertas</th><th>Ações</th></tr></thead><tbody>{[...data.fleets].sort((a, b) => a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true })).map(fleet => <tr key={fleet.frota} style={{ borderTop: '1px solid var(--border-primary)' }}><td className="py-3 font-bold pr-3">{fleet.frota}</td><td className="pr-3">{fleet.nome || orders.find(o => o.frota === fleet.frota)?.modelo || 'Usar modelo da fonte'}</td><td className="pr-3">{groupMap.get(fleet.grupo_id)?.nome || 'Grupo não encontrado'}</td><td className="pr-3">{orders.filter(o => o.ativo && o.frota === fleet.frota).length}</td><td><div className="flex gap-3"><button disabled={busy} className="text-xs" onClick={() => setFleetDraft({ frotas: fleet.frota, grupo_id: fleet.grupo_id, nome: fleet.nome })}>Editar</button><button disabled={busy} className="text-xs" style={{ color: 'var(--apoio-danger)' }} onClick={() => { if (window.confirm(`Remover a frota ${fleet.frota} do controle próprio? As ordens da fonte não serão excluídas.`)) void runMutation(() => deleteApoioFleet(fleet.frota), 'Frota removida do controle próprio. As ordens foram preservadas.'); }}>Remover</button></div></td></tr>)}</tbody></table></div>
          {!data.fleets.length && <p className="text-sm mt-4" style={muted}>Cadastre as frotas acima ou selecione um grupo Apoio diretamente nas ordens não cadastradas.</p>}
        </section>
      </div>}

      {data && tab === 'ordens' && <>
        <details className="mt-filters apoio-filter-center">
          <summary><span className="apoio-filter-title"><Filter size={18} aria-hidden="true" />Filtros de acompanhamento</span><span>{groupsFilter.length || query || origins.length || statuses.length || providersFilter.length || recency.sort!=='organized' || recency.window!=='all' || recency.scheduledAndRunning ? 'Filtros ativos' : 'Todos os nossos equipamentos'}</span></summary>
          <div className="mt-filter-body apoio-command-content space-y-4">
        <div className="flex flex-wrap gap-2">
          {([{ id: 'abertas', label: 'Nossos equipamentos · abertas' }, { id: 'classificar', label: 'Não cadastradas · classificar' }, { id: 'historico', label: 'Histórico · ausentes na fonte' }] as { id: View; label: string }[]).map(item => <button key={item.id} className={buttonClass} aria-pressed={view === item.id} style={view === item.id ? green : neutral} onClick={() => { setView(item.id); clearFilters(); }}>{item.label}</button>)}
        </div>
        {view === 'historico' && <p className="text-sm p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>O histórico inclui encerradas operacionais e ordens que saíram da listagem sem prova completa. Essas últimas permanecem como <strong>Outros · Sem confirmação</strong>, sem inventar encerramento.</p>}
        {view === 'encerradas' && <p className="text-sm p-3 rounded-xl" style={{ background: 'var(--bg-hover)' }}>A lista reúne apenas ordens com encerramento confirmado pelo status da fonte ou por ausência validada. A data exibida é de detecção; execução humana não é inferida.</p>}
        {view === 'classificar' && <p className="text-sm" style={muted}>Estas ordens ainda não pertencem ao controle próprio. Atribua um grupo Apoio apenas às frotas que são de vocês; as demais podem permanecer sem cadastro.</p>}
        <section className="p-4 space-y-4 apoio-order-filters" style={panel}>
          <div className="apoio-panel-heading"><h3>Filtros das ordens</h3><span className="text-xs" style={muted}>Refine o controle e os relatórios</span></div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 apoio-multiselect-grid">
            <ApoioMultiSelect label="Origem" options={locations.map(value => ({ value, label: value, count: baseRows.filter(row => oficinaLabel(row.origem) === value).length }))} value={origins} onChange={setOrigins} description="múltipla" />
            <ApoioMultiSelect label="Status operacional" options={statusList.map(value => ({ value, label: value, count: baseRows.filter(row => apoioOrderStatusLabel(row) === (value === 'Andamento' ? 'Em andamento' : value) || (value === 'Outros' && apoioOrderStatusLabel(row).startsWith('Outros'))).length }))} value={statuses} onChange={value => { setStatuses(value); setRecency(c => ({ ...c, scheduledAndRunning: false })); }} description="múltiplo" />
            <ApoioMultiSelect label="Prestador externo" options={providers.map(value => ({ value, label: value, count: baseRows.filter(row => oficinaLabel(row.origem) === 'Oficina Externa' && (row.prestador || 'Não informado') === value).length }))} value={providersFilter} onChange={value => { setProvidersFilter(value); if (value.length) setOrigins(current => current.includes('Oficina Externa') ? current : [...current, 'Oficina Externa']); }} description="múltiplo" />
          </div>
          <section className="apoio-recency-panel" aria-label="Recência das ordens">
            <div className="apoio-panel-heading"><h3>Ordens mais recentes</h3><span className="text-xs" style={muted}>Horário de Brasília · combinado com os demais filtros</span></div>
            <div className="apoio-recency-shortcuts">
              <button className={buttonClass} style={recency.sort==='newest' && recency.scheduledAndRunning ? green : neutral} aria-pressed={recency.sort==='newest' && recency.scheduledAndRunning} onClick={()=>showRecent('both')}>Recentes · Programadas e andamento</button>
              <button className={buttonClass} style={recency.sort==='newest' && statuses.length === 1 && statuses[0] === 'Programada' ? green : neutral} aria-pressed={recency.sort==='newest' && statuses.length === 1 && statuses[0] === 'Programada'} onClick={()=>showRecent('Programada')}>Recentes · Programadas</button>
              <button className={buttonClass} style={recency.sort==='newest' && statuses.length === 1 && statuses[0] === 'Andamento' ? green : neutral} aria-pressed={recency.sort==='newest' && statuses.length === 1 && statuses[0] === 'Andamento'} onClick={()=>showRecent('Andamento')}>Recentes · Em andamento</button>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 apoio-recency-fields">
              <label className="text-xs font-semibold">Ordenar ordens<select className="mt-1" style={field} value={recency.sort} onChange={e=>setRecency(c=>({...c,sort:e.target.value as ApoioRecencyOptions['sort']}))}><option value="organized">Agrupadas por Apoio / oficina</option><option value="newest">Mais recentes primeiro</option><option value="oldest">Mais antigas primeiro</option></select></label>
              <label className="text-xs font-semibold">Período de recência<select className="mt-1" style={field} value={recency.window} onChange={e=>{setRecency(c=>({...c,window:e.target.value as ApoioRecencyOptions['window']}));setRecencyClock(new Date());}}><option value="all">Sem limite de período</option><option value="1h">Última hora</option><option value="6h">Últimas 6 horas</option><option value="24h">Últimas 24 horas</option><option value="today">Hoje — Brasília</option><option value="7d">Últimos 7 dias</option><option value="custom">Intervalo personalizado</option></select></label>
              <label className="text-xs font-semibold">Data de referência<select className="mt-1" style={field} value={recency.basis} onChange={e=>setRecency(c=>({...c,basis:e.target.value as ApoioRecencyOptions['basis']}))}><option value="entrada">Entrada da OS</option><option value="primeira_vista">Primeira detecção no Apoio</option></select></label>
            </div>
            {recency.window==='custom' && <div className="grid sm:grid-cols-2 gap-3"><label className="text-xs font-semibold">Data inicial<input type="date" className="mt-1" style={field} value={recency.start} onChange={e=>setRecency(c=>({...c,start:e.target.value}))}/></label><label className="text-xs font-semibold">Data final<input type="date" className="mt-1" style={field} value={recency.end} onChange={e=>setRecency(c=>({...c,end:e.target.value}))}/></label></div>}
            <p className="text-xs" style={muted}>Entrada usa a data informada na OS; primeira detecção mostra quando ela apareceu no Apoio, não quando mudou de status. A última sincronização não torna uma ordem antiga recente. Datas ausentes ou futuras ficam no final da ordenação e não entram em períodos recentes.</p>
            {recencyError && <p role="alert" className="apoio-recency-error">{recencyError}</p>}
          </section>
          <ApoioGroupFleetFilter
            groups={data.groups}
            fleets={data.fleets}
            baseRows={baseRows}
            selectedGroups={groupsFilter}
            fleetsByGroup={fleetsByGroup}
            onGroupsChange={setGroupsFilter}
            onFleetsByGroupChange={setFleetsByGroup}
            onClear={clearFilters}
          />
          <div className="flex justify-end"><button className="text-xs underline" onClick={clearFilters}>Limpar filtros</button></div>
        </section>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Equipamentos', value: new Set(rows.map(o => o.frota)).size, Icon: Truck },
            { label: 'Ordens filtradas', value: rows.length, Icon: FileText },
            { label: 'Oficina Interna', value: rows.filter(o => oficinaLabel(o.origem) === 'Oficina Interna').length, Icon: Wrench },
            { label: 'Oficina Externa', value: rows.filter(o => oficinaLabel(o.origem) === 'Oficina Externa').length, Icon: Building2 },
            { label: 'Em andamento', value: rows.filter(o => getMaintenanceOrderClosure(o).status === 'andamento').length, Icon: Clock },
            { label: 'Programadas', value: rows.filter(o => getMaintenanceOrderClosure(o).status === 'programado').length, Icon: Clock },
          ].map(kpi => <div key={kpi.label} className="glass-card apoio-kpi p-4" style={panel}><div className="apoio-kpi-label flex justify-between gap-2 text-xs" style={muted}>{kpi.label}<kpi.Icon size={16} /></div><strong className="block text-2xl mt-2">{kpi.value}</strong></div>)}
        </div>
        <p className="text-xs" style={muted}>{rows.filter(o => apoioOrderStatusLabel(o) === 'Outros' && /aguardando\s+pe[cç]a/i.test(o.status)).length} aguardando peça · {rows.filter(o => oficinaLabel(o.origem) === 'Campo').length} no campo · {orders.filter(o => o.ativo && !fleetMap.has(o.frota)).length} ordens fora do controle próprio{invalidDates > 0 ? ` · ${invalidDates} datas ${recency.basis === 'entrada' ? 'de entrada' : 'de primeira detecção'} ausentes, futuras ou inválidas na seleção antes da recência` : ''}</p>
          </div>
        </details>
        {/* Busca no fluxo normal: logo após Filtros de acompanhamento e antes das abas. */}
        <section className="apoio-sticky-search" role="search" aria-label="Pesquisar e exibir ordens">
          <div className="apoio-direct-toolbar">
            <label className="apoio-direct-search-label" htmlFor="apoio-direct-search">
              Pesquisar frota, OS ou narrativa
              <span className="apoio-direct-search-control"><Search size={16} aria-hidden="true" /><input id="apoio-direct-search" aria-label="Pesquisar frota, OS ou narrativa" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: frota, OS ou trecho da narrativa" autoComplete="off" /></span>
            </label>
            <button type="button" className="apoio-direct-clear" disabled={!query} onClick={() => setQuery('')}>Limpar busca</button>
            <span className="apoio-direct-count" aria-live="polite">{rows.length} {rows.length === 1 ? 'ordem' : 'ordens'} na seleção{query.trim() ? ` · busca aplicada: “${query.trim()}”` : ''}</span>
          </div>
        </section>
        <div className="mt-status-tabs" role="group" aria-label="Situação das ordens Apoio">
          {[{label:'Todas',value:''},{label:'Programado',value:'Programada'},{label:'Em andamento',value:'Andamento'},{label:'Encerrado',value:'Encerrada'},{label:'Outros',value:'Outros'}].map(item => <button key={item.label} type="button" aria-pressed={item.value ? statuses.length === 1 && statuses[0] === item.value : !statuses.length} onClick={() => {setStatuses(item.value ? [item.value] : []);setRecency(current => ({...current,scheduledAndRunning:false}));if(item.value === 'Encerrada')showClosed();else if(view === 'encerradas')setView('abertas');}}>{item.label}<b>{item.value === 'Encerrada' ? closedCount : item.value ? baseRows.filter(row => item.value === 'Andamento' ? getMaintenanceOrderClosure(row).status === 'andamento' : item.value === 'Programada' ? getMaintenanceOrderClosure(row).status === 'programado' : getMaintenanceOrderClosure(row).status === 'outros' || getMaintenanceOrderClosure(row).status === 'ausente').length : baseRows.length}</b></button>)}
        </div>
        <section className="mt-results apoio-orders-panel">
          <div className="mt-toolbar">
            <div><p className="mt-eyebrow">Visão operacional</p><h3>{rows.length} ordens selecionadas</h3><p>{new Set(rows.map(row => row.frota)).size} frotas · todos os filtros valem para os relatórios</p></div>
            <div className="mt-toolbar-actions">
              <div className="apoio-view-toggle" role="group" aria-label="Visualização dos resultados"><button type="button" aria-pressed={displayMode === 'cards'} onClick={() => setDisplayMode('cards')}>Cartões</button><button type="button" aria-pressed={displayMode === 'table'} onClick={() => setDisplayMode('table')}>Tabela</button></div>
              <button type="button" className="mt-btn" disabled={!rows.length || exporting} onClick={() => void exportReport('pdf')}><FileText size={17} aria-hidden="true" />Relatório PDF</button>
              <button type="button" className="mt-btn" disabled={!rows.length || exporting} onClick={() => void exportReport('xlsx')}><Download size={17} aria-hidden="true" />Excel</button>
              <button type="button" className="mt-btn" disabled={!oficinaTerceirosSelecionadas.length || exporting} title="Relatório em PNG conforme modo escolhido: oficina externa, emergenciais ou juntos" onClick={() => void exportOficinaTerceiros('png')}><Building2 size={17} aria-hidden="true" />{oficinaScope === 'externa' ? 'Oficina de terceiros' : oficinaScope === 'emergencia' ? 'Emergenciais · Interna/Campo' : 'Terceiros + Emergenciais'}</button>
            </div>
          </div>
          <p className="mt-history-summary" aria-live="polite">{recencyLabel}</p>
          <details className="mt-filters apoio-image-reports">
            <summary><span className="apoio-filter-title"><Download size={18} aria-hidden="true" />Relatórios em imagem</span><span>{oficinaTerceirosSelecionadas.length} de {oficinaTerceirosEntries.length} equipamentos ({oficinaScope === 'externa' ? 'oficina de terceiros' : oficinaScope === 'emergencia' ? 'emergenciais interna/campo' : 'terceiros + emergenciais'}) · {OFICINA_REPORT_FORMATS[oficinaFormat].shortLabel} ({OFICINA_REPORT_QUALITIES[oficinaQuality].shortLabel})</span></summary>
            <div className="mt-filter-body apoio-command-content apoio-image-reports-body">
              <div className="grid lg:grid-cols-2 gap-4">
                <section className="p-4 space-y-3" style={panel} aria-label="Equipamentos em Oficina de Terceiros">
                  <div className="apoio-panel-heading"><h3>{oficinaReportTitle(oficinaScope)}</h3><span className="text-xs" style={muted}>frota, modelo e oficina/local</span></div>
                  <p className="text-xs" style={muted}>Escolha se deseja visualizar e cobrar <strong>separado</strong> (só Oficina de Terceiros ou só Emergenciais na Oficina Interna/Campo) ou <strong>junto</strong> no mesmo PNG para Celular, Tablet ou Computador.</p>
                  <div className="apoio-report-scope-group" role="group" aria-label="Modo de cobrança e visualização">
                    <button
                      type="button"
                      className={`apoio-report-scope-btn${oficinaScope === 'externa' ? ' is-active' : ''}`}
                      aria-pressed={oficinaScope === 'externa'}
                      onClick={() => changeOficinaScope('externa')}
                    >
                      Separado · Oficina de terceiros ({oficinaExternaEntries.length})
                    </button>
                    <button
                      type="button"
                      className={`apoio-report-scope-btn${oficinaScope === 'emergencia' ? ' is-active' : ''}`}
                      aria-pressed={oficinaScope === 'emergencia'}
                      onClick={() => changeOficinaScope('emergencia')}
                    >
                      Separado · Emergenciais Interna/Campo ({oficinaEmergenciaEntries.length})
                    </button>
                    <button
                      type="button"
                      className={`apoio-report-scope-btn${oficinaScope === 'juntos' ? ' is-active' : ''}`}
                      aria-pressed={oficinaScope === 'juntos'}
                      onClick={() => changeOficinaScope('juntos')}
                    >
                      Junto · Terceiros + Emergenciais ({oficinaJuntosEntries.length})
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <span className="block text-xs font-semibold mb-1.5">Modo / dispositivo do PNG</span>
                      <div className="apoio-report-scope-group" role="group" aria-label="Formato de tela do relatório de oficina">
                        {(['celular', 'tablet', 'computador'] as const).map(fmtKey => (
                          <button
                            key={fmtKey}
                            type="button"
                            disabled={exporting}
                            className={`apoio-report-scope-btn${oficinaFormat === fmtKey ? ' is-active' : ''}`}
                            aria-pressed={oficinaFormat === fmtKey}
                            onClick={() => setOficinaFormat(fmtKey)}
                          >
                            {OFICINA_REPORT_FORMATS[fmtKey].shortLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="block text-xs font-semibold" htmlFor="apoio-oficina-qualidade">
                      Qualidade da imagem
                      <select
                        id="apoio-oficina-qualidade"
                        className="mt-1"
                        style={field}
                        disabled={exporting}
                        value={oficinaQuality}
                        onChange={event => setOficinaQuality(event.target.value as OficinaReportQuality)}
                      >
                        {(Object.entries(OFICINA_REPORT_QUALITIES) as Array<[OficinaReportQuality, { label: string }]>).map(([qKey, qInfo]) => (
                          <option key={qKey} value={qKey}>{qInfo.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {(() => {
                    const previewDims = resolveOficinaRenderDimensions(oficinaFormat, oficinaQuality);
                    return (
                      <p className="text-xs" style={muted}>
                        Saída mínima: <strong>{previewDims.pixelWidth} × {previewDims.pixelHeight} px</strong> ({OFICINA_REPORT_FORMATS[oficinaFormat].label} · escala {previewDims.scale}×). Base mínima: {OFICINA_TERCEIROS_IMAGE.width} px no celular.
                      </p>
                    );
                  })()}
                  <label className="block text-xs font-semibold" htmlFor="apoio-relatorio-oficina-busca">Pesquisar equipamento, oficina ou local
                    <input id="apoio-relatorio-oficina-busca" className="mt-1" style={field} value={oficinaQuery} onChange={event => setOficinaQuery(event.target.value)} placeholder="Ex.: 4508, Fratini, Interna ou Campo" autoComplete="off" />
                  </label>
                  <ApoioMultiSelect label={oficinaScope === 'externa' ? 'Oficina de terceiro' : 'Oficina ou local'} options={oficinaTerceirosProviders} value={oficinaPrestadores} onChange={setOficinaPrestadores} description="múltipla" />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button type="button" className={buttonClass} style={green} disabled={!oficinaTerceirosSelecionadas.length || exporting} onClick={() => void exportOficinaTerceiros('png')}><Download size={16} aria-hidden="true" />{exporting ? 'Gerando…' : `Baixar PNG (${OFICINA_REPORT_FORMATS[oficinaFormat].shortLabel})`}</button>
                    <button type="button" className={buttonClass} style={neutral} disabled={!oficinaTerceirosSelecionadas.length || exporting} onClick={() => void exportOficinaTerceiros('xlsx')}><Download size={16} aria-hidden="true" />Exportar Excel</button>
                    <button type="button" className={buttonClass} style={neutral} disabled={!oficinaScopedOrders.length || exporting} onClick={() => void exportOficinaTerceiros('pdf')}><FileText size={16} aria-hidden="true" />Exportar PDF</button>
                    <button type="button" className={buttonClass} style={neutral} disabled={!oficinaQuery.trim() && !oficinaPrestadores.length} onClick={() => { setOficinaQuery(''); setOficinaPrestadores([]); }}>Limpar filtros do relatório</button>
                    <span className="text-xs" style={muted} aria-live="polite">{oficinaTerceirosSelecionadas.length} de {oficinaTerceirosFiltered.length} marcados</span>
                  </div>
                  <div className="apoio-image-picker-actions">
                    <button type="button" className="apoio-image-picker-action" disabled={!oficinaTerceirosFiltered.length || oficinaTerceirosOcultos === 0} onClick={marcarOficinaVisiveis}>Marcar todos</button>
                    <button type="button" className="apoio-image-picker-action" disabled={!oficinaTerceirosSelecionadas.length} onClick={desmarcarOficinaVisiveis}>Desmarcar todos</button>
                    {oficinaTerceirosOcultos > 0 && <span className="text-xs" style={muted}>{oficinaTerceirosOcultos} {oficinaTerceirosOcultos === 1 ? 'desmarcado não sai' : 'desmarcados não saem'} no PNG</span>}
                  </div>
                  <div className="apoio-image-preview" role="group" aria-label="Equipamentos que sairão no relatório">
                    {oficinaTerceirosFiltered.map(entry => {
                      const marcado = !oficinaDesmarcados.includes(entry.frota);
                      const isEmergencyEntry = entry.categoria === 'emergencial_interna' || entry.categoria === 'emergencial_campo';
                      return (
                        <label className={`glass-card apoio-image-preview-row${marcado ? ' is-marked is-selected' : ' is-unmarked'}`} key={entry.frota}>
                          <input type="checkbox" checked={marcado} onChange={() => toggleOficinaEquipamento(entry.frota)} aria-label={`Incluir frota ${entry.frota} no relatório`} />
                          <EquipmentThumbnail
                            equipment={{
                              frota: entry.frota,
                              apoio: entry.grupo,
                              grupo_id: entry.grupo_id ?? fleetMap.get(entry.frota)?.grupo_id,
                              grupo_fonte: entry.grupo_fonte,
                              modelo: entry.modelo,
                              equipamento: entry.equipamento,
                            }}
                            size="table"
                          />
                          <span className="apoio-image-preview-text">
                            <strong>{entry.frota}</strong>
                            <span>{entry.modelo}</span>
                            <small className={isEmergencyEntry ? 'apoio-preview-emergency' : undefined}>
                              {entry.prestador}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                    {!oficinaTerceirosFiltered.length && <p className="text-xs" style={muted}>{oficinaScope === 'emergencia' ? 'Nenhum equipamento emergencial ativo em Oficina Interna ou Campo com os filtros atuais.' : 'Nenhum equipamento com esses filtros. Ajuste a busca, o modo ou a oficina para voltar a ter registros no relatório.'}</p>}
                  </div>
                </section>
                <section className="p-4 space-y-3" style={panel} aria-label="Imagem premium">
                  <div className="apoio-panel-heading"><h3>Imagem premium</h3><span className="text-xs" style={muted}>relatório completo das ordens</span></div>
                  <p className="text-xs" style={muted}>Frota, modelo, status, oficina, dias observados e narrativa de {rows.length} {rows.length === 1 ? 'ordem' : 'ordens'} · {new Set(rows.map(row => row.frota)).size} {new Set(rows.map(row => row.frota)).size === 1 ? 'frota' : 'frotas'} nesta seleção.</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="text-xs font-semibold">Formato<select value={imageFormat} disabled={exporting} onChange={event => setImageFormat(event.target.value as ApoioImageFormat)} className="mt-1" style={field}>{Object.entries(APOIO_IMAGE_FORMATS).map(([value, preset]) => <option key={value} value={value}>{preset.label}</option>)}</select></label>
                    <label className="text-xs font-semibold">Qualidade<select value={imageQuality} disabled={exporting} onChange={event => setImageQuality(event.target.value as ApoioImageQuality)} className="mt-1" style={field}><option value="ultra">Ultra · resolução máxima</option><option value="alta">Alta · arquivo mais leve</option></select></label>
                  </div>
                  <p className="text-xs" style={muted}>Cada página: {APOIO_IMAGE_FORMATS[imageFormat].width * (imageQuality === 'ultra' ? APOIO_IMAGE_FORMATS[imageFormat].ultraScale : 2)} × {APOIO_IMAGE_FORMATS[imageFormat].height * (imageQuality === 'ultra' ? APOIO_IMAGE_FORMATS[imageFormat].ultraScale : 2)} pixels. A qualidade Ultra pode levar mais tempo no celular.</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button type="button" className={buttonClass} style={green} disabled={!rows.length || exporting} onClick={() => void exportReport('image')}><Download size={16} aria-hidden="true" />{exporting ? 'Gerando imagens…' : 'Baixar imagens PNG'}</button>
                    <span className="text-xs" role="status" style={muted}>{exportProgress}</span>
                  </div>
                </section>
              </div>
            </div>
          </details>
          {displayMode === 'table' ? (
            <ApoioOrdersTable
              rows={shown}
              expanded={expanded}
              onToggle={key => setExpanded(expanded === key ? null : key)}
              groups={data.groups}
              groupIdForFleet={frota => fleetMap.get(frota)?.grupo_id || ''}
              busy={busy}
              onAssign={(order, groupId) => void assignGroup(order, groupId)}
            />
          ) : (
            <div className="apoio-shared-card-container">
              <div className="mt-card-grid">
                {shown.map(order => <ApoioOrderCard key={order.chave} order={order} groups={data.groups} groupId={fleetMap.get(order.frota)?.grupo_id || ''} busy={busy} clock={recencyClock} expanded={expanded === order.chave} onToggle={() => setExpanded(expanded === order.chave ? null : order.chave)} onAssign={groupId => void assignGroup(order, groupId)} />)}
              </div>
            </div>
          )}
          {!rows.length && <div className="p-10 text-center"><Truck size={28} className="mx-auto mb-3" style={muted} /><h4 className="font-semibold">Nenhuma ordem nesta seleção</h4><p className="text-sm mt-2" style={muted}>{view === 'encerradas' ? 'Nenhuma ordem com confirmação de encerramento foi encontrada para os filtros atuais.' : !data.fleets.length && view === 'abertas' ? 'Crie seus grupos Apoio e cadastre nossas frotas. Os equipamentos de terceiros não entram automaticamente no controle.' : 'Confira os filtros e a data de atualização da fonte.'}</p>{!data.fleets.length && <button className={`${buttonClass} mt-4`} style={green} onClick={() => setTab('cadastros')}>Cadastrar nossas frotas</button>}</div>}
          {rows.length > 0 && <div className="p-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--border-primary)' }}><span className="text-xs" style={muted}>Página {actualPage} de {pages} · {shown.length} nesta página</span><div className="flex gap-2"><button className={buttonClass} style={neutral} disabled={actualPage <= 1} onClick={() => setPage(actualPage - 1)}>Anterior</button><button className={buttonClass} style={neutral} disabled={actualPage >= pages} onClick={() => setPage(actualPage + 1)}>Próxima</button></div></div>}
        </section>
      </>}
      <details className="mt-filters apoio-extra-tools">
        <summary>Relatórios e atualização <span>{rows.length} ordens nesta seleção</span></summary>
        <div className="mt-filter-body apoio-command-content space-y-4">
        <div className="apoio-sync">
          <span>Atualização da fonte: <strong>{fmt(data?.sync?.fonte_atualizada)}</strong></span>
          <span>Última consulta: {fmt(data?.sync?.consultado_em)}</span>
          <span>Sincronização válida: {fmt(data?.sync?.sincronizado_em)}</span>
        </div>
        <p className="apoio-sync-note">Modo econômico: atualização automática a cada 3 minutos com a tela visível e leitura condicional do snapshot.</p>
      <div className="apoio-actions" aria-label="Atualização e relatórios">
        <button className={buttonClass} style={green} disabled={!rows.length || exporting} onClick={() => void exportReport('pdf')}><FileText size={16} />{exporting ? 'Gerando…' : 'Relatório premium'}</button>
        <button className={buttonClass} style={neutral} disabled={!rows.length || exporting} onClick={() => void exportReport('xlsx')}><Download size={16} />Excel</button>
        <button className={buttonClass} style={showWhatsApp ? green : neutral} disabled={!rows.length} aria-expanded={showWhatsApp} onClick={() => setShowWhatsApp(value => !value)}><MessageSquare size={16} />WhatsApp · Cobrar retorno</button>
      </div>
      <p className="text-xs" style={muted}>Imagens e relatórios de oficina de terceiros ficam no painel <strong>Relatórios em imagem</strong>, acima da lista de ordens. {oficinaTerceirosEntries.length ? `${oficinaTerceirosSummary(oficinaTerceirosEntries, oficinaScope)} nesta seleção.` : oficinaScope === 'emergencia' ? 'Nenhum equipamento emergencial em Oficina Interna ou Campo na seleção atual.' : oficinaScope === 'juntos' ? 'Nenhum equipamento em oficina externa ou emergencial (Interna/Campo) na seleção atual.' : 'Nenhum equipamento em oficina externa na seleção atual.'}</p>

      {showWhatsApp && <ApoioWhatsAppPanel options={exportOptions} disabled={exporting} onBusyChange={setExporting} />}

        </div>
      </details>
      <footer className="apoio-footer">Branco Peres Agro S/A · Manutenção &amp; Frota · Controle de Equipamentos — Apoio</footer>
    </div>
  );
}
