import { memo, useCallback, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpen, CheckCircle2, Clock3, Download, FileSpreadsheet, Filter, Layers3, ListFilter, RefreshCw, Search, ShieldAlert, Truck, Wrench, X } from 'lucide-react';
import { MAINTENANCE_CENTRAL_REFRESH_MS, useMaintenanceTracking } from '../hooks/useMaintenanceTracking';
import { oficinaLabel } from '../types/apoio';
import { formatApoioDate } from '../lib/apoioDate';
import { BI_AGE_BANDS, BI_DEFAULT_FILTERS, BI_STATUS_LABELS, buildBIModel, buildBIRows, filterBIRows, getBIFilterLabels, validateBIFilters, type BIFilters, type BIRow, type BIStatus } from '../lib/managementAnalytics';
import { exportManagementExcel, exportManagementPDF } from '../lib/managementReport';
import BIMultiSelect, { type BISelectOption } from '../components/BIMultiSelect';
import BIOrderExplorer from '../components/BIOrderExplorer';
import ManagementCharts from '../components/ManagementCharts';
import { VerdanCountUp } from '../components/VerdanAnimatedWidgets';
import { useTheme } from '../contexts/ThemeContext';
import '../styles/central-gerencial.css';

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const brasiliaDayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const n = (value: number | null | undefined) => value === null || value === undefined ? '—' : numberFormat.format(value);
const day = (value: number | null) => value === null ? '—' : `${n(value)} d`;
const freshFilters = (): BIFilters => ({ ...BI_DEFAULT_FILTERS, groups: [], statuses: [], locations: [], providers: [], classes: [], workshops: [] });
function brasiliaDay(value: Date): string {
  const parts = brasiliaDayFormat.formatToParts(value);
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-${parts.find(part => part.type === 'day')?.value}`;
}
function options(rows: BIRow[], key: (row: BIRow) => string, label: (row: BIRow) => string): BISelectOption[] {
  const values = new Map<string, BISelectOption>();
  rows.forEach(row => { const value = key(row); const previous = values.get(value); values.set(value, { value, label: label(row), count: (previous?.count || 0) + 1 }); });
  return [...values.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function CentralGerencial() {
  const { theme } = useTheme();
  const isVerdan = theme === 'verdan';
  const isDashboardV32 = theme === 'dashboard-v32';
  const isVitrea = theme === 'vitrea';
  const { data, loading, refreshing, error, refresh, clock } = useMaintenanceTracking({ automaticRefreshMs: MAINTENANCE_CENTRAL_REFRESH_MS, syncOnAutomaticRefresh: false });
  const [filters, setFilters] = useState<BIFilters>(freshFilters);
  const [advanced, setAdvanced] = useState(false);
  const [view, setView] = useState<'dashboard' | 'orders' | 'methodology'>('dashboard');
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');
  const allRows = useMemo(() => buildBIRows(data, clock), [data, clock]);
  const filterError = validateBIFilters(filters);
  const rows = useMemo(() => filterBIRows(allRows, filters), [allRows, filters]);
  const model = useMemo(() => buildBIModel(rows, clock), [rows, clock]);
  const summary = model.summary;
  const labels = getBIFilterLabels(filters, allRows);
  const selectionKey = JSON.stringify(filters);
  const groupOptions = useMemo(() => options(allRows, row => row.groupId, row => row.apoio), [allRows]);
  const locationOptions = useMemo(() => options(allRows, row => oficinaLabel(row.origem), row => oficinaLabel(row.origem)), [allRows]);
  const providerOptions = useMemo(() => options(allRows, row => String(row.prestador || '').trim(), row => row.prestador?.trim() || 'Não informado'), [allRows]);
  const classOptions = useMemo(() => options(allRows, row => String(row.classe || '').trim(), row => row.classe?.trim() || 'Não informada'), [allRows]);
  const workshopOptions = useMemo(() => options(allRows, row => row.workshop, row => row.workshop), [allRows]);
  const statusOptions = useMemo(() => Object.entries(BI_STATUS_LABELS).map(([value, label]) => ({ value, label, count: allRows.filter(row => row.statusKey === value).length })), [allRows]);
  const sourceUpdated = data?.sync?.fonte_atualizada || null;
  const lastSynced = data?.sync?.sincronizado_em || null;
  const sourceAge = sourceUpdated ? (clock.getTime() - Date.parse(sourceUpdated)) / 60000 : Infinity;
  const stale = !!data && (!Number.isFinite(sourceAge) || sourceAge > 75 || sourceAge < -5);
  const sourceError = [error, data?.sync?.erro, stale ? 'Data da fonte ausente, inconsistente ou superior a75minutos. A seleção é uma fotografia, não informação em tempo real.' : ''].filter(Boolean).join(' · ');
  const patch = <K extends keyof BIFilters>(key: K, value: BIFilters[K]) => setFilters(previous => ({ ...previous, [key]: value, ...(key === 'ageMin' || key === 'ageMax' ? { ageBandKey: '' } : {}) }));
  const reset = () => { setFilters(freshFilters()); setExportError(''); };
  const period = (days: number | null) => {
    if (days === null) { setFilters(previous => ({ ...previous, start: '', end: '' })); return; }
    const end = brasiliaDay(clock);
    const start = new Date(Date.parse(`${end}T00:00:00Z`) - (days - 1) * 86400000).toISOString().slice(0, 10);
    setFilters(previous => ({ ...previous, start, end }));
  };
  const pickGroup = useCallback((id: string) => {
    if (!allRows.some(row => row.groupId === id)) return;
    setFilters(previous => ({ ...previous, groups: [id] }));
  }, [allRows]);
  const pickStatus = useCallback((status: BIStatus) => setFilters(previous => ({ ...previous, statuses: previous.statuses.length === 1 && previous.statuses[0] === status ? [] : [status], waitingOnly: false })), []);
  const pickAge = useCallback((key: string) => {
    const band = BI_AGE_BANDS.find(item => item.key === key);
    if (band) setFilters(previous => ({ ...previous, ageMin: '', ageMax: '', ageBandKey: key, waitingOnly: true, statuses: ['programado', 'aguardando'] }));
  }, []);
  const pickWorkshop = useCallback((id: string) => {
    const label = model.workshopChart.find(item => item.id === id)?.label;
    if (label) setFilters(previous => ({ ...previous, workshops: previous.workshops.length === 1 && previous.workshops[0] === label ? [] : [label] }));
  }, [model.workshopChart]);
  const preset = (kind: string) => {
    const next = freshFilters();
    if (kind === 'queue') next.waitingOnly = true;
    if (kind === 'overdue') next.overdueOnly = true;
    if (kind === 'external') next.locations = ['Oficina Externa'];
    if (kind === 'closed') next.statuses = ['encerrado'];
    setFilters(next);
  };
  const exportReport = async (kind: 'pdf' | 'excel') => {
    if (filterError || !rows.length || exporting) return;
    setExportError(''); setExporting(kind);
    try {
      const payload = { rows, model, filters: labels, sourceUpdated, lastSynced, sourceError: sourceError || null };
      if (kind === 'pdf') await exportManagementPDF(payload); else await exportManagementExcel(payload);
    } catch (err) { setExportError(err instanceof Error ? err.message : 'Não foi possível gerar o relatório. Tente novamente.'); }
    finally { setExporting(''); }
  };
  const kpis: Array<{ label: string; value: string; numericValue?: number; note: string; icon: typeof Layers3; tone: string }> = [
    { label: 'Ordens da seleção', value: n(summary.total), numericValue: summary.total, note: `${n(summary.fleets)} frotas distintas`, icon: Layers3, tone: 'green' },
    { label: 'Carteira aberta', value: n(summary.open), numericValue: summary.open, note: `${n(summary.inProgress)} em andamento`, icon: Wrench, tone: 'blue' },
    { label: 'Em fila atualmente', value: n(summary.waiting), numericValue: summary.waiting, note: 'Programadas e aguardando', icon: ListFilter, tone: 'amber' },
    { label: 'Idade média da fila', value: day(summary.meanWaitingDays), note: `${n(summary.waitingWithDate)} ordens com data válida`, icon: Clock3, tone: 'amber' },
    { label: 'Mediana / P90 da fila', value: `${day(summary.medianWaitingDays)} / ${day(summary.p90WaitingDays)}`, note: '50% / 90% até esta idade', icon: Activity, tone: 'purple' },
    { label: 'Previsões vencidas', value: n(summary.overdue), numericValue: summary.overdue, note: 'Somente ordens abertas', icon: ShieldAlert, tone: 'red' },
    { label: 'Idade média aberta', value: day(summary.meanOpenDays), note: `${n(summary.openWithDate)} ordens com entrada válida`, icon: Truck, tone: 'blue' },
    { label: 'Encerradas na seleção', value: n(summary.closed), numericValue: summary.closed, note: `${n(summary.closureDetected)} saídas com data de detecção`, icon: CheckCircle2, tone: 'green' },
  ];

  return <div className="bi-root" data-central="gerencial" aria-busy={loading || refreshing}>
    <header className="bi-header">
      <div className="bi-brand"><img src="/logo.png" alt="Branco Peres" /><div><span className="bi-eyebrow">GESTÃO DE FROTA · INTELIGÊNCIA OPERACIONAL</span><h1>Central Gerencial</h1><p>Todos os equipamentos. Uma visão integrada das ordens.</p></div></div>
      <div className="bi-header-actions"><span className="bi-premium-label"><BarChart3 size={14} />ANÁLISE GERENCIAL</span><button className="bi-button" type="button" disabled={refreshing || loading} onClick={() => { void refresh(); }}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Atualizando…' : 'Atualizar'}</button><button className="bi-button" type="button" disabled={!rows.length || !!filterError || !!exporting} onClick={() => { void exportReport('excel'); }}><FileSpreadsheet size={15} />{exporting === 'excel' ? 'Gerando…' : 'Excel'}</button><button className="bi-button bi-button-primary" type="button" disabled={!rows.length || !!filterError || !!exporting} onClick={() => { void exportReport('pdf'); }}><Download size={15} />{exporting === 'pdf' ? 'Gerando…' : 'Relatório PDF'}</button></div>
    </header>
    <div className="bi-source-line"><span className={`bi-source-dot ${sourceError ? 'is-warning' : ''}`} /><strong>{loading ? 'Consultando a fonte…' : sourceError ? 'Fotografia requer atenção' : 'Fotografia integrada disponível'}</strong><span>Fonte: {sourceUpdated ? formatApoioDate(sourceUpdated) : 'Não informada'}</span><span>Sincronização: {lastSynced ? formatApoioDate(lastSynced) : 'Não informada'}</span><span>Atualização automática: a cada 5 minutos · fonte permanece uma fotografia</span><span className="bi-base-count">{n(allRows.length)} ordens na base</span></div>
    {sourceError && <div className="bi-notice bi-notice-warning" role="alert"><ShieldAlert size={17} /><div><strong>Atualização requer atenção.</strong><p>{sourceError} {data ? "A última base válida continua visível e este aviso acompanha os relatórios." : "Nenhuma base válida carregada. Tente atualizar novamente."}</p></div></div>}
    {exportError && <div className="bi-notice bi-notice-warning" role="alert">{exportError}</div>}

    <section className={`bi-filter-panel ${advanced ? "is-expanded" : ""}`} aria-label="Filtros gerenciais">
      <div className="bi-filter-top"><div className="bi-search"><Search size={18} /><input aria-label="Pesquisar ordens gerenciais" value={filters.query} onChange={event => patch('query', event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setView('orders'); }} placeholder="Pesquisar frota, OS, narrativa, equipamento ou grupo…" />{filters.query && <button type="button" aria-label="Limpar pesquisa" onClick={() => patch('query', '')}><X size={15} /></button>}</div><button className={`bi-button ${advanced ? 'is-active' : ''}`} type="button" aria-expanded={advanced} onClick={() => setAdvanced(current => !current)}><Filter size={15} />Mais filtros</button><button className="bi-button bi-button-subtle" type="button" onClick={reset}>Limpar seleção</button></div>
      <div className="bi-main-filters"><BIMultiSelect label="Grupos de equipamentos" options={groupOptions} value={filters.groups} onChange={value => patch('groups', value)} /><BIMultiSelect label="Situações" options={statusOptions} value={filters.statuses} onChange={value => patch('statuses', value as BIStatus[])} /><BIMultiSelect label="Origem da manutenção" options={locationOptions} value={filters.locations} onChange={value => patch('locations', value)} /><div className="bi-period"><span className="bi-field-label">Período de entrada das ordens</span><div><input type="date" aria-label="Entrada a partir de" value={filters.start} onChange={event => patch('start', event.target.value)} /><span>até</span><input type="date" aria-label="Entrada até" value={filters.end} onChange={event => patch('end', event.target.value)} /></div></div></div>
      <div className="bi-filter-bottom"><div className="bi-period-shortcuts"><span>Entrada:</span><button type="button" onClick={() => period(null)}>Todos os períodos</button>{[7, 30, 90].map(value => <button key={value} type="button" onClick={() => period(value)}>{value} dias</button>)}</div><p><strong>{n(summary.total)}</strong> de {n(allRows.length)} ordens · clique nos gráficos para cruzar filtros</p></div>
      {advanced && <div className="bi-advanced-filters"><BIMultiSelect label="Prestadores" options={providerOptions} value={filters.providers} onChange={value => patch('providers', value)} /><BIMultiSelect label="Classe da ordem" options={classOptions} value={filters.classes} onChange={value => patch('classes', value)} /><BIMultiSelect label="Oficinas / pontos" options={workshopOptions} value={filters.workshops} onChange={value => patch('workshops', value)} /><label><span className="bi-field-label">Escopo de equipamentos</span><select aria-label="Escopo de equipamentos" value={filters.scope} onChange={event => patch('scope', event.target.value as BIFilters['scope'])}><option value="all">Toda a fonte + cadastro</option><option value="registered">Cadastrados no Apoio</option><option value="unregistered">Sem cadastro Apoio</option></select></label><div className="bi-age-range"><span className="bi-field-label">Idade aberta da ordem em dias</span><div><input type="number" min="0" step="0.1" aria-label="Idade mínima em dias" placeholder="Mínima" value={filters.ageMin} onChange={event => patch('ageMin', event.target.value)} /><span>até</span><input type="number" min="0" step="0.1" aria-label="Idade máxima em dias" placeholder="Máxima" value={filters.ageMax} onChange={event => patch('ageMax', event.target.value)} /></div></div><div className="bi-toggle-filters"><label><input type="checkbox" checked={filters.waitingOnly} onChange={event => patch('waitingOnly', event.target.checked)} />Somente em fila</label><label><input type="checkbox" checked={filters.overdueOnly} onChange={event => patch('overdueOnly', event.target.checked)} />Previsão vencida</label></div></div>}
      {filterError && <div className="bi-filter-error" role="alert">{filterError} Corrija os filtros para consultar ou exportar.</div>}
      <div className="bi-filter-summary"><span>SELEÇÃO ATUAL</span>{labels.length ? labels.map((label, index) => <small key={`${label}-${index}`}>{label}</small>) : <small>Toda a fonte · todos os grupos</small>}</div>
    </section>

    <div className="bi-view-toolbar"><nav aria-label="Seções da Central Gerencial"><button type="button" aria-pressed={view === 'dashboard'} onClick={() => setView('dashboard')}><BarChart3 size={15} />Painel gerencial</button><button type="button" aria-pressed={view === 'orders'} onClick={() => setView('orders')}><ListFilter size={15} />Consulta de ordens <span>{n(summary.total)}</span></button><button type="button" aria-pressed={view === 'methodology'} onClick={() => setView('methodology')}><BookOpen size={15} />Metodologia</button></nav><div className="bi-presets"><span>Consultas rápidas</span><button type="button" onClick={() => preset('all')}>Geral</button><button type="button" onClick={() => preset('queue')}>Fila</button><button type="button" onClick={() => preset('overdue')}>Vencidas</button><button type="button" onClick={() => preset('external')}>Externas</button><button type="button" onClick={() => preset('closed')}>Encerradas</button></div></div>

    {loading && !data ? <div className="bi-loading" role="status"><RefreshCw size={24} className="animate-spin" /><h2>Carregando a visão integrada</h2><p>Consultando grupos, equipamentos e ordens na fonte compartilhada.</p></div> : <>
      <section className="bi-kpis" aria-label="Indicadores gerenciais">{kpis.map(item => <article className={`bi-kpi bi-kpi-${item.tone}`} key={item.label}><div><span>{item.label}</span><item.icon size={17} /></div><strong>{(isVerdan || isDashboardV32 || isVitrea) && typeof item.numericValue === 'number' ? <VerdanCountUp value={item.numericValue} /> : item.value}</strong><p>{item.note}</p></article>)}</section>
      <div className="bi-method-note"><Clock3 size={15} /><p><strong>Leitura correta dos tempos:</strong> idade da fila é Entrada → agora para a situação atual. A fonte não informa o início do reparo; não é espera líquida ou MTTR. {summary.invalidDates > 0 && <span className="bi-quality-flag">{n(summary.invalidDates)} ordens com entrada ausente/inconsistente não geram média temporal.</span>}</p></div>
      {view === 'dashboard' && <ManagementCharts model={model} onGroup={pickGroup} onStatus={pickStatus} onAgeBand={pickAge} onWorkshop={pickWorkshop} />}
      {view === 'orders' && <BIOrderExplorer rows={rows} selectionKey={selectionKey} />}
      {view === 'methodology' && <section className="bi-panel bi-methodology"><span className="bi-eyebrow">TRANSPARÊNCIA DAS MÉTRICAS</span><h2>Como interpretar a Central Gerencial</h2><div><article><h3>Carteira e fila</h3><p>Carteira aberta considera ordens atuais não encerradas. Fila considera programadas e aguardando/pendentes. A idade começa na Entrada, não no momento em que a ordem entrou em cada situação.</p></article><article><h3>Média, mediana e P90</h3><p>Datas ausentes, inválidas ou futuras não são substituídas por zero. Os cards informam a quantidade válida. Mediana divide a amostra em50%; P90 indica a idade que cobre90% da amostra, sem prometer prazo de atendimento.</p></article><article><h3>Encerramento e ciclo observado</h3><p>A saída comprovada de uma fotografia válida encerra operacionalmente. O status encerrado na fonte não cria data de execução. Ciclo observado compara Entrada com última presença válida, não tempo real de reparo. Média nesta seleção: {day(summary.meanObservedCycleDays)} em {n(rows.filter(row => row.observedCycleDays !== null).length)} ordens com evidência temporal.</p></article><article><h3>Evolução e período</h3><p>Filtros de período selecionam pela Entrada em Brasília, incluindo início e fim. A evolução mostra até90dias da fotografia e apenas saídas com detecção conhecida. Não é um registro completo de cada transição histórica nem saldo diário de backlog.</p></article><article><h3>Grupos e equipamentos</h3><p>O cadastro Apoio fornece o grupo quando disponível. Frotas sem cadastro seguem o grupo informado na fonte, sem inferir categoria por narrativa. Os quatro grupos ocultos em Lavagem continuam disponíveis aqui.</p></article><article><h3>Consultas e relatórios</h3><p>Gráficos cruzados, indicadores e ordens usam a mesma seleção. Os relatórios incluem todas as ordens selecionadas, não só a página. Filtros e avisos de fonte acompanham cada arquivo. A central é somente de consulta e não altera ordens.</p></article></div></section>}
      {!rows.length && view === 'dashboard' && <div className="bi-empty-callout"><strong>Nenhuma ordem nesta seleção.</strong><p>Limpe filtros ou consulte outro período. Não são utilizados valores demonstrativos para preencher os gráficos.</p><button className="bi-button" type="button" onClick={reset}>Limpar seleção</button></div>}
    </>}
    <footer className="bi-footer"><span>BRANCO PERES · INTELIGÊNCIA DE MANUTENÇÃO</span><span>Consulta integrada · dias contínuos · referência Brasília · sem alteração de ordens</span></footer>
  </div>;
}

export default memo(CentralGerencial);
