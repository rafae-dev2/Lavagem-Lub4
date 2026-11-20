import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  MapPin,
  Wrench,
} from 'lucide-react';
import { formatApoioDate as formatDate } from '../lib/apoioDate';
import { getMaintenanceOrderClosure } from '../lib/maintenanceTracking';
import {
  ApoioClassifiedOrder,
  ApoioPanelGroupBy,
  groupApoioOrdersForPanel,
  summarizeApoioPanelMetrics,
} from '../lib/apoioOperationalBoard';
import { ApoioGroup, ApoioReportRow } from '../types/apoio';
import EquipmentThumbnail from './EquipmentThumbnail';
import '../styles/apoio-operational-panel.css';

interface Props {
  rows: ApoioReportRow[];
  groups?: ApoioGroup[];
  groupIdForFleet?: (frota: string) => string;
  busy?: boolean;
  clock?: Date;
  onAssign?: (row: ApoioReportRow, groupId: string) => void;
}

type QuickFilter = 'all' | 'overdue' | 'progress' | 'external';

function localSummary(row: ApoioReportRow, local: string): string {
  if (local === 'Oficina Externa') return row.prestador || 'Prestador não informado';
  return [row.setor, row.ponto].filter(Boolean).join(' · ') || local;
}

function DossierBody({
  item,
  groups,
  groupId,
  busy,
  onAssign,
}: {
  item: ApoioClassifiedOrder;
  groups: ApoioGroup[];
  groupId: string;
  busy: boolean;
  onAssign?: (row: ApoioReportRow, groupId: string) => void;
}) {
  const { row, statusLabel, closed, overdue, days, local } = item;
  const closure = getMaintenanceOrderClosure(row);
  const narrative = row.narrativa?.trim() || 'Sem narrativa informada na origem.';

  return (
    <div className="apoio-dossier__body">
      <div className="apoio-dossier__header">
        <EquipmentThumbnail
          equipment={{
            frota: row.frota,
            apoio: row.apoio,
            grupo_id: groupId,
            grupo_fonte: row.grupo_fonte,
            modelo: row.modelo,
            equipamento: row.equipamento,
          }}
          size="card"
        />
        <div className="apoio-dossier__headline">
          <div className="apoio-dossier__kicker">
            <span>{row.apoio || 'Sem grupo Apoio'}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">OS {row.os || '—'}</span>
          </div>
          <h4>Frota {row.frota === 'SEM-FROTA' ? 'Não informada' : row.frota}</h4>
          <p className="apoio-dossier__model">{row.modelo || row.equipamento || 'Equipamento não informado'}</p>
        </div>
        <div className="apoio-dossier__status-col">
          <span className={`apoio-op-status is-${item.tier}`}>
            {closed && <CheckCircle2 size={12} aria-hidden="true" />}
            {statusLabel}
          </span>
          {days !== null && (
            <span className={`apoio-op-days tabular-nums${overdue ? ' is-overdue' : ''}`}>
              {days} {days === 1 ? 'dia' : 'dias'}
            </span>
          )}
        </div>
      </div>

      {overdue && (
        <div className="apoio-dossier__alert" role="note">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>Previsão vencida em {formatDate(row.previsao)} · situação mantida conforme a fonte.</span>
        </div>
      )}

      <dl className="apoio-dossier__grid">
        <div>
          <dt>Local / Oficina</dt>
          <dd>{local}</dd>
        </div>
        <div>
          <dt>{local === 'Oficina Externa' ? 'Prestador' : 'Setor / Ponto'}</dt>
          <dd>{localSummary(row, local)}</dd>
        </div>
        <div>
          <dt>Entrada da OS</dt>
          <dd className="tabular-nums">{formatDate(row.entrada)}</dd>
        </div>
        <div>
          <dt>Previsão de saída</dt>
          <dd className="tabular-nums">{formatDate(row.previsao)}</dd>
        </div>
        <div>
          <dt>Status na fonte</dt>
          <dd>{row.status?.trim() || 'Não informado'}</dd>
        </div>
        <div>
          <dt>Última leitura</dt>
          <dd className="tabular-nums">{formatDate(row.ultima_vista)}</dd>
        </div>
      </dl>

      {onAssign && groups.length > 0 && row.frota !== 'SEM-FROTA' && (
        <label className="apoio-dossier__assign">
          <span>Grupo Apoio desta frota</span>
          <select
            value={groupId}
            disabled={busy}
            onChange={event => onAssign(row, event.target.value)}
            aria-label={`Grupo Apoio da frota ${row.frota}`}
          >
            <option value="">Sem grupo próprio</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.nome}</option>
            ))}
          </select>
        </label>
      )}

      <div className="apoio-dossier__narrative">
        <strong>Serviço / narrativa completa</strong>
        <p>{narrative}</p>
      </div>

      {closure.status === 'encerrado' && closure.detectedAt && (
        <p className="apoio-dossier__footnote">
          Encerramento detectado em {formatDate(closure.detectedAt)} ({closure.origin === 'ausencia' ? 'ausência validada' : 'status da fonte'}).
        </p>
      )}
    </div>
  );
}

export default function ApoioOrdersPanelView({
  rows,
  groups = [],
  groupIdForFleet = () => '',
  busy = false,
  clock,
  onAssign,
}: Props) {
  const [groupBy, setGroupBy] = useState<ApoioPanelGroupBy>('priority');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => summarizeApoioPanelMetrics(rows, clock), [rows, clock]);

  const scopedRows = useMemo(() => {
    if (quickFilter === 'all') return rows;
    if (quickFilter === 'overdue') {
      return rows.filter(row => {
        const c = getMaintenanceOrderClosure(row);
        return c.status !== 'encerrado' && groupApoioOrdersForPanel([row], 'priority', clock)[0]?.id === 'overdue';
      });
    }
    if (quickFilter === 'progress') {
      return rows.filter(row => getMaintenanceOrderClosure(row).status === 'andamento');
    }
    return rows.filter(row => {
      const origin = (row.origem || '').trim().toLocaleLowerCase('pt-BR');
      return ['terceiro', 'externo', 'externa', 'oficina externa'].includes(origin);
    });
  }, [rows, quickFilter, clock]);

  const buckets = useMemo(
    () => groupApoioOrdersForPanel(scopedRows, groupBy, clock),
    [scopedRows, groupBy, clock],
  );

  const flatItems = useMemo(() => buckets.flatMap(bucket => bucket.items), [buckets]);

  useEffect(() => {
    if (!flatItems.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !flatItems.some(item => item.row.chave === selectedKey)) {
      setSelectedKey(flatItems[0].row.chave);
    }
  }, [flatItems, selectedKey]);

  const selectedItem = useMemo(
    () => flatItems.find(item => item.row.chave === selectedKey) ?? flatItems[0] ?? null,
    [flatItems, selectedKey],
  );

  const toggleBucket = (id: string) => {
    setCollapsedBuckets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!rows.length) {
    return null;
  }

  return (
    <div className="apoio-op-panel" data-testid="apoio-operational-panel">
      {/* Control bar: quick triage counters + grouping mode */}
      <div className="apoio-op-controls">
        <div className="apoio-op-triage" role="group" aria-label="Triagem rápida das ordens">
          <button
            type="button"
            className={`apoio-op-chip${quickFilter === 'all' ? ' is-active' : ''}`}
            aria-pressed={quickFilter === 'all'}
            onClick={() => setQuickFilter('all')}
          >
            <span>Todas</span>
            <strong className="tabular-nums">{summary.total}</strong>
          </button>
          <button
            type="button"
            className={`apoio-op-chip is-danger${quickFilter === 'overdue' ? ' is-active' : ''}`}
            aria-pressed={quickFilter === 'overdue'}
            onClick={() => setQuickFilter(quickFilter === 'overdue' ? 'all' : 'overdue')}
          >
            <AlertTriangle size={13} aria-hidden="true" />
            <span>Vencidas</span>
            <strong className="tabular-nums">{summary.overdueCount}</strong>
          </button>
          <button
            type="button"
            className={`apoio-op-chip is-progress${quickFilter === 'progress' ? ' is-active' : ''}`}
            aria-pressed={quickFilter === 'progress'}
            onClick={() => setQuickFilter(quickFilter === 'progress' ? 'all' : 'progress')}
          >
            <Wrench size={13} aria-hidden="true" />
            <span>Andamento</span>
            <strong className="tabular-nums">{summary.inProgressCount}</strong>
          </button>
          <button
            type="button"
            className={`apoio-op-chip${quickFilter === 'external' ? ' is-active' : ''}`}
            aria-pressed={quickFilter === 'external'}
            onClick={() => setQuickFilter(quickFilter === 'external' ? 'all' : 'external')}
          >
            <Building2 size={13} aria-hidden="true" />
            <span>Terceiros</span>
            <strong className="tabular-nums">{summary.externalCount}</strong>
          </button>
        </div>

        <div className="apoio-op-groupby" role="group" aria-label="Agrupamento do painel operacional">
          <Layers size={14} aria-hidden="true" className="apoio-op-groupby__icon" />
          {(
            [
              { id: 'priority', label: 'Urgência' },
              { id: 'status', label: 'Situação' },
              { id: 'group', label: 'Grupo' },
            ] as const
          ).map(opt => (
            <button
              key={opt.id}
              type="button"
              className={`apoio-op-groupby__btn${groupBy === opt.id ? ' is-active' : ''}`}
              aria-pressed={groupBy === opt.id}
              onClick={() => setGroupBy(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!buckets.length ? (
        <div className="apoio-op-empty">
          <p>Nenhuma ordem corresponde à triagem rápida selecionada.</p>
          <button type="button" className="apoio-op-chip is-active" onClick={() => setQuickFilter('all')}>
            Mostrar todas desta página
          </button>
        </div>
      ) : (
        <div className="apoio-op-workspace">
          {/* Left Master Queue */}
          <div className="apoio-op-queue" role="list" aria-label="Fila operacional de ordens">
            {buckets.map(bucket => {
              const isCollapsed = Boolean(collapsedBuckets[bucket.id]);
              return (
                <section key={bucket.id} className={`apoio-op-bucket is-${bucket.tone}`}>
                  <button
                    type="button"
                    className="apoio-op-bucket__header"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleBucket(bucket.id)}
                  >
                    <span className="apoio-op-bucket__title">
                      {isCollapsed ? <ChevronRight size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                      <strong>{bucket.title}</strong>
                    </span>
                    <span className="apoio-op-bucket__meta tabular-nums">
                      {bucket.overdueCount > 0 && bucket.id !== 'overdue' && (
                        <span className="apoio-op-bucket__overdue">{bucket.overdueCount} venc.</span>
                      )}
                      <span className="apoio-op-bucket__count">{bucket.items.length}</span>
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="apoio-op-bucket__list">
                      {bucket.items.map(item => {
                        const { row, overdue, days, statusLabel, local } = item;
                        const isSelected = selectedItem?.row.chave === row.chave;
                        const groupId = groupIdForFleet(row.frota);

                        return (
                          <div
                            key={row.chave}
                            role="listitem"
                            className={`apoio-op-item${isSelected ? ' is-selected' : ''}${overdue ? ' is-overdue' : ''}`}
                          >
                            <button
                              type="button"
                              className="apoio-op-row"
                              aria-expanded={isSelected}
                              onClick={() => setSelectedKey(prev => (prev === row.chave ? null : row.chave))}
                            >
                              <div className="apoio-op-row__thumb">
                                <EquipmentThumbnail
                                  equipment={{
                                    frota: row.frota,
                                    apoio: row.apoio,
                                    grupo_id: groupId,
                                    grupo_fonte: row.grupo_fonte,
                                    modelo: row.modelo,
                                    equipamento: row.equipamento,
                                  }}
                                  size="table"
                                />
                              </div>

                              <div className="apoio-op-row__main">
                                <div className="apoio-op-row__top">
                                  <strong className="apoio-op-row__fleet tabular-nums">
                                    {row.frota === 'SEM-FROTA' ? 'S/F' : row.frota}
                                  </strong>
                                  <span className="apoio-op-row__equip">
                                    {row.equipamento || row.apoio || 'Equipamento'}
                                  </span>
                                  <span className="apoio-op-row__os tabular-nums">OS {row.os || '—'}</span>
                                </div>

                                <div className="apoio-op-row__meta">
                                  <span>
                                    <MapPin size={11} aria-hidden="true" />
                                    {local} · {localSummary(row, local)}
                                  </span>
                                  {row.previsao && (
                                    <span className={`tabular-nums${overdue ? ' is-overdue' : ''}`}>
                                      <CalendarClock size={11} aria-hidden="true" />
                                      Prev. {formatDate(row.previsao)}
                                    </span>
                                  )}
                                </div>

                                <p className="apoio-op-row__excerpt">
                                  {row.narrativa?.trim() || 'Sem narrativa informada'}
                                </p>
                              </div>

                              <div className="apoio-op-row__aside">
                                <span className={`apoio-op-status is-${item.tier}`}>{statusLabel}</span>
                                <span className={`apoio-op-days tabular-nums${overdue ? ' is-overdue' : ''}`}>
                                  <Clock size={11} aria-hidden="true" />
                                  {days !== null ? `${days}d` : '—'}
                                </span>
                                {overdue && (
                                  <span className="apoio-op-overdue-flag">
                                    <AlertTriangle size={11} aria-hidden="true" />
                                    Vencida
                                  </span>
                                )}
                              </div>
                            </button>

                            {/* Mobile / narrow inline expandable dossier */}
                            {isSelected && (
                              <div className="apoio-op-inline-dossier">
                                <DossierBody
                                  item={item}
                                  groups={groups}
                                  groupId={groupId}
                                  busy={busy}
                                  onAssign={onAssign}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Desktop sticky side inspector (Dossiê da Ordem) */}
          <aside className="apoio-op-inspector" aria-label="Dossiê da ordem selecionada">
            {selectedItem ? (
              <DossierBody
                item={selectedItem}
                groups={groups}
                groupId={groupIdForFleet(selectedItem.row.frota)}
                busy={busy}
                onAssign={onAssign}
              />
            ) : (
              <div className="apoio-op-inspector__empty">
                <p>Selecione uma ordem na fila à esquerda para inspecionar o dossiê completo.</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
