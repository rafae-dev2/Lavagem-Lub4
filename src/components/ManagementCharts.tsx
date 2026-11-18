import React, { ReactNode, useMemo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  BarChart,
} from 'recharts';
import type { BIModel, BIStatus } from '../lib/managementAnalytics';
import { BI_AGE_BANDS, BI_STATUS_LABELS } from '../lib/managementAnalytics';
import '../styles/management-charts.css';

export interface ManagementChartsProps {
  model: BIModel;
  onGroup: (id: string) => void;
  onStatus: (status: BIStatus) => void;
  onAgeBand: (key: string) => void;
  onWorkshop: (id: string) => void;
}

interface ChartPanelProps {
  id: string;
  title: string;
  caption: string;
  children: ReactNode;
  className?: string;
}

interface TooltipPayloadItem {
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: Record<string, unknown>;
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const integerFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const decimalFormats = new Map<number, Intl.NumberFormat>([[1, numberFormat]]);

const STATUS_LABELS: Record<BIStatus, string> = BI_STATUS_LABELS;

const STATUS_COLORS: Record<BIStatus, string> = {
  programado: '#3478a6',
  aguardando: '#d97706',
  andamento: '#23836a',
  encerrado: '#667085',
  outros: '#ae8a2d',
};

const PORTFOLIO_COLORS = {
  waiting: '#d97706',
  inProgress: '#23836a',
  closed: '#667085',
  other: '#ae8a2d',
};

const safeList = <T,>(value: T[] | readonly T[] | null | undefined): T[] =>
  Array.isArray(value) ? [...value] : [];

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function formatNumber(value: unknown, unit = '', decimals = 1): string {
  const number = asFiniteNumber(value);
  if (number === null) return 'Não informado';
  let formatter = decimalFormats.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals });
    decimalFormats.set(decimals, formatter);
  }
  const formatted = formatter.format(number);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatInteger(value: unknown, unit = ''): string {
  const number = asFiniteNumber(value);
  if (number === null) return 'Não informado';
  const formatted = integerFormat.format(number);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatPercent(value: unknown): string {
  const number = asFiniteNumber(value);
  return number === null ? 'Não informado' : `${percentFormat.format(number)}%`;
}

function truncateLabel(value: unknown, maxLength = 25): string {
  const label = String(value ?? 'Sem identificação');
  return label.length > maxLength ? `${label.slice(0, Math.max(1, maxLength - 1))}…` : label;
}

function statusKey(value: unknown): BIStatus {
  return value === 'programado' || value === 'aguardando' || value === 'andamento' || value === 'encerrado'
    ? value
    : 'outros';
}

function valueLabel(dataKey: unknown, fallback: unknown): string {
  const key = String(dataKey ?? '');
  const labels: Record<string, string> = {
    count: 'Ordens',
    total: 'Ordens',
    waiting: 'Fila (programado + aguardando)',
    inProgress: 'Em andamento',
    closed: 'Encerradas',
    other: 'Outros',
    opened: 'Entradas',
    detectedClosed: 'Saídas detectadas',
    meanWaitingDays: 'Média de espera',
    p90WaitingDays: 'P90 de espera',
    cumulativePercent: 'Acumulado',
  };
  return labels[key] ?? String(fallback ?? key ?? 'Valor');
}

function valueWithUnit(dataKey: unknown, value: unknown): string {
  const key = String(dataKey ?? '');
  if (key === 'meanWaitingDays' || key === 'p90WaitingDays') return formatNumber(value, 'dias');
  if (key === 'cumulativePercent') return formatPercent(value);
  return formatInteger(value, 'ordens');
}

function hasPositiveValue<T extends Record<string, unknown>>(rows: T[], keys: string[]): boolean {
  return rows.some((row) => keys.some((key) => {
    const number = asFiniteNumber(row[key]);
    return number !== null && number > 0;
  }));
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: ReactNode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const source = payload[0]?.payload ?? {};
  const title = source.fullLabel ?? source.label ?? label ?? 'Detalhamento';
  return (
    <div className="bi-tooltip" role="status">
      <strong>{String(title)}</strong>
      <div className="bi-tooltip-list">
        {payload.map((item, index) => (
          <div className="bi-tooltip-row" key={`${String(item.dataKey ?? item.name ?? 'value')}-${index}`}>
            <span className="bi-tooltip-swatch" style={{ backgroundColor: item.color || '#174d32' }} aria-hidden="true" />
            <span>{valueLabel(item.dataKey, item.name)}</span>
            <b>{valueWithUnit(item.dataKey, item.value)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartLegend({ payload }: { payload?: Array<{ value?: string; color?: string }> }) {
  if (!payload || payload.length === 0) return null;
  return (
    <div className="bi-chart-legend" aria-label="Legenda do gráfico">
      {payload.map((entry, index) => (
        <span className="bi-legend-item" key={`${entry.value ?? 'item'}-${index}`}>
          <span className="bi-legend-dot" style={{ backgroundColor: entry.color || '#174d32' }} aria-hidden="true" />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

function AxisTick({ x, y, payload, angle = 0 }: { x?: number; y?: number; payload?: { value?: unknown }; angle?: number }) {
  const fullLabel = String(payload?.value ?? '');
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0}) rotate(${angle})`}>
      <title>{fullLabel}</title>
      <text x={angle ? 0 : -4} y={angle ? 0 : 4} textAnchor={angle ? 'end' : 'end'} className="bi-axis-tick">
        {truncateLabel(fullLabel, angle ? 16 : 22)}
      </text>
    </g>
  );
}

function ChartPanel({ id, title, caption, children, className = '' }: ChartPanelProps) {
  return (
    <section className={`bi-chart-panel ${className}`.trim()} aria-labelledby={id} data-chart-key={id}>
      <header className="bi-chart-panel-header">
        <div>
          <h3 id={id}>{title}</h3>
          <p>{caption}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ChartEmpty({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="bi-chart-empty" role="status">
      <strong>{message}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

function GroupActionList({
  rows,
  onGroup,
  label = 'Filtrar grupos exibidos',
}: {
  rows: Array<{ id: string; label: string }>;
  onGroup: (id: string) => void;
  label?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="bi-chart-actions" aria-label={label}>
      {rows.map((row) => (
        <button key={row.id} type="button" onClick={() => onGroup(row.id)} title={row.label}>
          {truncateLabel(row.label, 21)}
        </button>
      ))}
    </div>
  );
}

function statusChartColor(value: unknown): string {
  return STATUS_COLORS[statusKey(value)];
}

function isParetoAggregate(row: { id?: string; label?: string }): boolean {
  const id = String(row.id ?? '').toLowerCase();
  const label = String(row.label ?? '').toLowerCase();
  return id === 'demais' || id === '__demais__' || id === '__other__' || id === 'restante' || id === 'outros-grupos' || label === 'demais' || label === 'demais grupos';
}

function ManagementCharts({ model, onGroup, onStatus, onAgeBand, onWorkshop }: ManagementChartsProps) {
  const groups = useMemo(() => safeList(model?.groupsChart)
    .filter((row) => row && typeof row.id === 'string')
    .sort((a, b) => (asFiniteNumber(b.total) ?? 0) - (asFiniteNumber(a.total) ?? 0)), [model]);
  const topGroups = groups.slice(0, 10);
  const statuses = useMemo(() => safeList(model?.statusChart)
    .filter((row) => row && asFiniteNumber(row.count) !== null), [model]);
  const aging = useMemo(() => safeList(model?.agingChart)
    .filter((row) => row && asFiniteNumber(row.count) !== null), [model]);
  const trend = useMemo(() => safeList(model?.trendChart)
    .filter((row) => row && typeof row.date === 'string'), [model]);
  const pareto = useMemo(() => safeList(model?.paretoChart)
    .filter((row) => row && typeof row.id === 'string'), [model]);
  const workshops = useMemo(() => safeList(model?.workshopChart)
    .filter((row) => row && typeof row.id === 'string'), [model]);
  const scatter = useMemo(() => safeList(model?.scatterChart)
    .filter((row) => row && typeof row.id === 'string' && (asFiniteNumber(row.count) ?? 0) > 0 && asFiniteNumber(row.meanWaitingDays) !== null && row.meanWaitingDays! >= 0), [model]);
  const heatmap = useMemo(() => safeList(model?.heatmap)
    .filter((row) => row && typeof row.id === 'string'), [model]);
  const ageBands = useMemo(() => safeList(BI_AGE_BANDS), []);

  const summary = model?.summary;
  const total = asFiniteNumber(summary?.total) ?? 0;
  const waiting = asFiniteNumber(summary?.waiting) ?? 0;
  const waitingWithDate = asFiniteNumber(summary?.waitingWithDate) ?? 0;
  const heatMax = Math.max(1, ...heatmap.flatMap((row) => ageBands.map((band) => asFiniteNumber(row.counts?.[band.key]) ?? 0)));

  const groupsWithData = topGroups.filter((row) => (asFiniteNumber(row.total) ?? 0) > 0);
  const statusesWithData = statuses.filter((row) => (asFiniteNumber(row.count) ?? 0) > 0);
  const agingWithData = aging.filter((row) => (asFiniteNumber(row.count) ?? 0) > 0);
  const trendWithData = trend.filter((row) => (asFiniteNumber(row.opened) ?? 0) > 0 || (asFiniteNumber(row.detectedClosed) ?? 0) > 0);
  const paretoWithData = pareto.filter((row) => (asFiniteNumber(row.count) ?? 0) > 0);
  const workshopWithData = workshops.filter((row) => (asFiniteNumber(row.count) ?? 0) > 0 || (asFiniteNumber(row.meanWaitingDays) ?? 0) > 0);
  const heatmapWithData = heatmap.filter((row) => ageBands.some((band) => (asFiniteNumber(row.counts?.[band.key]) ?? 0) > 0));

  const groupFromChart = (entry: { payload?: { id?: string } } | undefined) => {
    const id = entry?.payload?.id;
    if (typeof id === 'string' && id) onGroup(id);
  };

  const statusFromChart = (entry: { payload?: { key?: BIStatus } } | undefined) => {
    const key = entry?.payload?.key;
    if (key) onStatus(statusKey(key));
  };

  const ageFromChart = (entry: { payload?: { key?: string } } | undefined) => {
    const key = entry?.payload?.key;
    if (typeof key === 'string' && key) onAgeBand(key);
  };

  const workshopFromChart = (entry: { payload?: { id?: string } } | undefined) => {
    const id = entry?.payload?.id;
    if (typeof id === 'string' && id) onWorkshop(id);
  };

  const paretoFromChart = (entry: { payload?: { id?: string; label?: string } } | undefined) => {
    const row = entry?.payload;
    if (row && typeof row.id === 'string' && !isParetoAggregate(row)) onGroup(row.id);
  };

  return (
    <div className="bi-charts" aria-label="Análises da central gerencial">
      <div className="bi-chart-grid">
        <ChartPanel
          id="bi-chart-groups"
          title="Carteira por grupo"
          caption={`${formatInteger(groupsWithData.length)} grupos exibidos · ${formatInteger(total, 'ordens')} no recorte · fila inclui Programado e Aguardando`}
        >
          {groupsWithData.length === 0 ? (
            <ChartEmpty message="Não há ordens por grupo no recorte." detail="Ajuste os filtros ou verifique a qualidade da base." />
          ) : (
            <>
              <div className="bi-chart-frame bi-chart-frame-tall">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <BarChart data={groupsWithData} layout="vertical" margin={{ top: 4, right: 20, left: 12, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e9e5" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} />
                    <YAxis type="category" dataKey="label" width={138} tick={<AxisTick />} interval={0} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend content={<ChartLegend />} />
                    <Bar dataKey="waiting" name="Fila (programado + aguardando)" stackId="portfolio" fill={PORTFOLIO_COLORS.waiting} cursor="pointer" onClick={groupFromChart} isAnimationActive={false} />
                    <Bar dataKey="inProgress" name="Em andamento" stackId="portfolio" fill={PORTFOLIO_COLORS.inProgress} cursor="pointer" onClick={groupFromChart} isAnimationActive={false} />
                    <Bar dataKey="closed" name="Encerradas" stackId="portfolio" fill={PORTFOLIO_COLORS.closed} cursor="pointer" onClick={groupFromChart} isAnimationActive={false} />
                    <Bar dataKey="other" name="Outros" stackId="portfolio" fill={PORTFOLIO_COLORS.other} cursor="pointer" onClick={groupFromChart} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <GroupActionList rows={groupsWithData.map((row) => ({ id: row.id, label: row.label }))} onGroup={onGroup} />
            </>
          )}
        </ChartPanel>

        <ChartPanel
          id="bi-chart-statuses"
          title="Situações atuais"
          caption={`${formatInteger(statusesWithData.length)} situações · denominador: ${formatInteger(total, 'ordens')} do recorte`}
        >
          {statusesWithData.length === 0 ? (
            <ChartEmpty message="Não há situações para distribuir." detail="A seleção atual não retornou ordens válidas." />
          ) : (
            <>
              <div className="bi-chart-frame bi-chart-frame-donut">
                <ResponsiveContainer width="100%" height={270} minWidth={0}>
                  <PieChart>
                    <Pie data={statusesWithData} dataKey="count" nameKey="label" innerRadius={66} outerRadius={94} paddingAngle={2} onClick={statusFromChart} cursor="pointer" isAnimationActive={false}>
                      {statusesWithData.map((row) => <Cell key={row.key} fill={statusChartColor(row.key)} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend content={<ChartLegend />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="bi-chart-actions" aria-label="Filtrar por situação">
                {statusesWithData.map((row) => {
                  const key = statusKey(row.key);
                  return <button key={key} type="button" onClick={() => onStatus(key)} title={STATUS_LABELS[key]}><span className="bi-action-dot" style={{ backgroundColor: STATUS_COLORS[key] }} aria-hidden="true" />{STATUS_LABELS[key]} ({formatInteger(row.count)})</button>;
                })}
              </div>
            </>
          )}
        </ChartPanel>

        <ChartPanel
          id="bi-chart-aging"
          title="Idade da fila"
          caption={`${formatInteger(waitingWithDate, 'ordens')} com idade válida · fila total: ${formatInteger(waiting, 'ordens')} · dias completos · faixas selecionáveis`}
        >
          {agingWithData.length === 0 ? (
            <ChartEmpty message="Não há idade de fila válida." detail="Datas ausentes, inválidas ou fora do recorte não entram no histograma." />
          ) : (
            <>
              <div className="bi-chart-frame">
                <ResponsiveContainer width="100%" height={270} minWidth={0}>
                  <BarChart data={aging} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9e5" />
                    <XAxis dataKey="label" tick={<AxisTick angle={-28} />} height={48} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Ordens na fila" fill="#d97706" radius={[5, 5, 0, 0]} cursor="pointer" onClick={ageFromChart} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bi-chart-actions" aria-label="Filtrar por faixa de idade">
                {aging.map((row) => <button key={row.key} type="button" onClick={() => onAgeBand(row.key)} title={row.label}>{row.label} ({formatInteger(row.count)})</button>)}
              </div>
            </>
          )}
        </ChartPanel>

        <ChartPanel
          id="bi-chart-scatter"
          title="Idade média da fila × volume"
          caption={`${formatInteger(scatter.length, 'grupos')} com idade média válida · volume = fila com data · médias ausentes excluídas`}
        >
          {scatter.length === 0 ? (
            <ChartEmpty message="Não há grupos com idade média válida." detail="O cálculo exige volume e idade de fila válida, inclusive zero." />
          ) : (
            <>
              <div className="bi-chart-frame">
                <ResponsiveContainer width="100%" height={270} minWidth={0}>
                  <ScatterChart margin={{ top: 8, right: 18, bottom: 12, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e9e5" />
                    <XAxis type="number" dataKey="count" name="Volume" allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} />
                    <YAxis type="number" dataKey="meanWaitingDays" name="Idade média da fila" unit=" dias" tick={{ fontSize: 11, fill: '#667085' }} />
                    <ZAxis type="number" dataKey="p90WaitingDays" range={[70, 420]} />
                    <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={scatter} name="Grupos" fill="#174d32" onClick={groupFromChart} cursor="pointer" isAnimationActive={false}>
                      {scatter.map((row) => <Cell key={row.id} fill="#174d32" />)}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <GroupActionList rows={scatter.map((row) => ({ id: row.id, label: row.label }))} onGroup={onGroup} label="Filtrar grupos da dispersão" />
            </>
          )}
        </ChartPanel>

        <ChartPanel
          id="bi-chart-trend"
          title="Entradas e saídas detectadas"
          caption={`${formatInteger(trendWithData.length, 'dias com evidência')} no snapshot · saídas são encerramentos detectados, não histórico inventado`}
        >
          {trendWithData.length === 0 ? (
            <ChartEmpty message="Não há série diária no recorte." detail="A série só mostra dias com entradas ou encerramentos detectados válidos." />
          ) : (
            <div className="bi-chart-frame">
              <ResponsiveContainer width="100%" height={270} minWidth={0}>
                <ComposedChart data={trend} margin={{ top: 8, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9e5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#667085' }} minTickGap={22} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend content={<ChartLegend />} />
                  <Area type="monotone" dataKey="opened" name="Entradas" stroke="#174d32" fill="#d8e8dd" strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="detectedClosed" name="Saídas detectadas" stroke="#d97706" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartPanel>

        <ChartPanel
          id="bi-chart-pareto"
          title="Pareto da fila por grupo"
          caption={`${formatInteger(waiting, 'ordens na fila')} · top 10 grupos + Demais até 100% · célula agregada não filtrável`}
        >
          {paretoWithData.length === 0 ? (
            <ChartEmpty message="Não há grupos na fila para o Pareto." detail="Ordens encerradas não entram nesta análise." />
          ) : (
            <>
              <div className="bi-chart-frame bi-chart-frame-tall">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <ComposedChart data={paretoWithData} margin={{ top: 8, right: 20, left: 0, bottom: 42 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9e5" />
                    <XAxis dataKey="label" tick={<AxisTick angle={-30} />} height={58} interval={0} />
                    <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} />
                    <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11, fill: '#667085' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend content={<ChartLegend />} />
                    <Bar yAxisId="count" dataKey="count" name="Ordens na fila" fill="#174d32" onClick={paretoFromChart} isAnimationActive={false}>
                      {paretoWithData.map((row) => <Cell key={row.id} fill={isParetoAggregate(row) ? '#ae8a2d' : '#174d32'} cursor={isParetoAggregate(row) ? 'default' : 'pointer'} />)}
                    </Bar>
                    <Line yAxisId="percent" type="monotone" dataKey="cumulativePercent" name="Acumulado" stroke="#d97706" strokeWidth={2.5} dot={{ r: 2 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <GroupActionList rows={paretoWithData.filter((row) => !isParetoAggregate(row)).map((row) => ({ id: row.id, label: row.label }))} onGroup={onGroup} label="Filtrar grupos do Pareto" />
            </>
          )}
        </ChartPanel>

        <ChartPanel
          id="bi-chart-workshops"
          title="Oficinas e pontos de manutenção"
          caption={`${formatInteger(workshopWithData.length, 'pontos')} · barras mostram volume; linha = idade média da fila com entrada válida`}
        >
          {workshopWithData.length === 0 ? (
            <ChartEmpty message="Não há oficinas ou pontos com dados." detail="Médias sem data válida ficam fora da linha de espera." />
          ) : (
            <>
              <div className="bi-chart-frame bi-chart-frame-tall">
                <ResponsiveContainer width="100%" height={300} minWidth={0}>
                  <ComposedChart data={workshopWithData} margin={{ top: 8, right: 20, left: 0, bottom: 46 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e9e5" />
                    <XAxis dataKey="label" tick={<AxisTick angle={-30} />} height={62} interval={0} />
                    <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 11, fill: '#667085' }} />
                    <YAxis yAxisId="days" orientation="right" tick={{ fontSize: 11, fill: '#667085' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend content={<ChartLegend />} />
                    <Bar yAxisId="count" dataKey="count" name="Ordens" fill="#3478a6" radius={[5, 5, 0, 0]} cursor="pointer" onClick={workshopFromChart} isAnimationActive={false} />
                    <Line yAxisId="days" type="monotone" dataKey="meanWaitingDays" name="Idade média da fila (dias)" stroke="#d97706" strokeWidth={2.5} connectNulls={false} dot={{ r: 3 }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="bi-chart-actions" aria-label="Filtrar por oficina ou ponto">
                {workshopWithData.map((row) => <button key={row.id} type="button" onClick={() => onWorkshop(row.id)} title={row.label}>{truncateLabel(row.label, 23)} ({formatInteger(row.count)})</button>)}
              </div>
            </>
          )}
        </ChartPanel>

        <ChartPanel
          id="bi-chart-heatmap"
          title="Mapa de calor: grupo × idade"
          caption={`${formatInteger(waitingWithDate, 'ordens')} na fila com idade válida · selecione grupo e faixa simultaneamente`}
          className="bi-chart-panel-wide"
        >
          {heatmapWithData.length === 0 || ageBands.length === 0 ? (
            <ChartEmpty message="Não há células de idade válidas." detail="O mapa considera somente a fila com data de entrada válida." />
          ) : (
            <div className="bi-heatmap-wrap" role="grid" aria-label="Mapa de calor por grupo e faixa de idade">
              <div className="bi-heatmap-row bi-heatmap-head" role="row">
                <span className="bi-heatmap-group-label" role="columnheader">Grupo</span>
                {ageBands.map((band) => <span key={band.key} role="columnheader" title={band.label}>{truncateLabel(band.label, 16)}</span>)}
              </div>
              {heatmapWithData.map((row) => (
                <div className="bi-heatmap-row" role="row" key={row.id}>
                  <button type="button" className="bi-heatmap-group-label bi-heatmap-group-button" onClick={() => onGroup(row.id)} title={row.label} role="gridcell">
                    {truncateLabel(row.label, 25)}
                  </button>
                  {ageBands.map((band) => {
                    const count = asFiniteNumber(row.counts?.[band.key]) ?? 0;
                    const intensity = count > 0 ? Math.max(0.12, Math.min(1, count / heatMax)) : 0;
                    return (
                      <button
                        type="button"
                        role="gridcell"
                        key={`${row.id}-${band.key}`}
                        className={`bi-heat-cell${count === 0 ? ' is-zero' : ''}`}
                        style={{ '--heat-intensity': intensity, color: intensity >= 0.6 ? '#fff' : '#173d28', textShadow: intensity >= 0.6 ? '0 1px 1px #0002' : 'none' } as React.CSSProperties}
                        onClick={() => { onGroup(row.id); onAgeBand(band.key); }}
                        aria-label={`${row.label}, ${band.label}: ${formatInteger(count, 'ordens')}`}
                        title={`${row.label} · ${band.label}: ${formatInteger(count, 'ordens')}`}
                      >
                        {formatInteger(count)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ChartPanel>
      </div>
    </div>
  );
}

export default React.memo(ManagementCharts);

export { STATUS_COLORS, STATUS_LABELS, formatNumber, hasPositiveValue };
