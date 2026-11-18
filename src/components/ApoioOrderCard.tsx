import type { ChangeEvent } from "react";
import MaintenanceOrderCard from "./MaintenanceOrderCard";
import { apoioForecastOverdue } from "../lib/apoioCardPresentation";
import {
  getMaintenanceOrderClosure,
  type TrackingRow,
} from "../lib/maintenanceTracking";
import type { ApoioGroup, ApoioReportRow } from "../types/apoio";

interface Props {
  order: ApoioReportRow;
  groups: ApoioGroup[];
  groupId: string;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAssign: (groupId: string) => void;
  clock?: Date;
}

/**
 * Adapta a fotografia do Controle Apoio ao contrato visual compartilhado com
 * AcompanhamentoManutencao e ReformasEquipamentosApoio.
 *
 * O Controle Apoio não aplica uma classificação de serviço: toda ordem recebida
 * pode ser própria, histórica ou aguardando cadastro. Fechamento e atraso são
 * derivados pelas mesmas funções operacionais usadas pelos acompanhamentos.
 */
function rowApoioReportRow(order: ApoioReportRow, clock: Date, registered = true): TrackingRow {
  const closure = getMaintenanceOrderClosure(order);
  const closed = closure.status === "encerrado";

  return {
    ...order,
    trackingStatus: closure.status,
    classificationReason: registered ? "Frota no controle Apoio" : "Frota ainda não cadastrada no controle próprio",
    closureOrigin: closure.origin,
    closedDetectedAt: closure.detectedAt,
    overdue: closed ? false : apoioForecastOverdue(order, clock),
  };
}

function groupDetails(
  order: ApoioReportRow,
  groups: ApoioGroup[],
  groupId: string,
  busy: boolean,
  onAssign: (groupId: string) => void,
) {
  const label = `Grupo Apoio da frota ${order.frota}`;
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onAssign(event.target.value);
  };

  return (
    <dl className="mt-detail-meta apoio-assignment-details">
      <div className="mt-detail-full">
        <dt>Grupo Apoio</dt>
        <dd>
          <label>
            <span className="sr-only">{label}</span>
            <select
              aria-label={label}
              value={groupId}
              disabled={busy || !groups.length || order.frota === "SEM-FROTA"}
              onChange={handleChange}
            >
              <option value="" disabled={Boolean(groupId)}>
                Não cadastrado
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.nome}
                </option>
              ))}
            </select>
          </label>
        </dd>
      </div>
    </dl>
  );
}

export default function ApoioOrderCard({
  order,
  groups,
  groupId,
  busy,
  expanded,
  onToggle,
  onAssign,
  clock,
}: Props) {
  const referenceClock = clock ?? new Date();
  const row = rowApoioReportRow(order, referenceClock, Boolean(groupId));

  return (
    <MaintenanceOrderCard
      row={row}
      clock={referenceClock}
      expanded={expanded}
      onToggle={onToggle}
      extraDetails={groupDetails(order, groups, groupId, busy, onAssign)}
    />
  );
}

export { rowApoioReportRow };
