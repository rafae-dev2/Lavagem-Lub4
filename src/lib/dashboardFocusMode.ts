import { Programacao } from "../types";

export type DashboardFocusContext = "atrasados" | "proximos7";
export type DashboardFocusUrgencyTone = "overdue" | "today" | "upcoming" | "completed";

export interface DashboardFocusHistoryEntry {
  id: string;
  dataIso: string;
  dataFormatted: string;
  tipoPreventiva: string;
  situacao: Programacao["situacao"];
  local: string;
}

export interface DashboardFocusDetail {
  schedule: Programacao;
  context: DashboardFocusContext;
  daysDelta: number | null;
  urgencyTone: DashboardFocusUrgencyTone;
  urgencyText: string;
  formattedProgramada: string;
  formattedRealizada: string;
  originLabel: string;
  narrativeText: string;
  recentFleetHistory: DashboardFocusHistoryEntry[];
}

const MS_PER_DAY = 86_400_000;

function parseIsoDayMs(iso: string | null | undefined): number | null {
  const raw = (iso || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const ms = Date.parse(`${raw}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function toUtcTodayMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatFocusDateBr(iso: string | null | undefined): string {
  const raw = (iso || "").trim().slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "Não informada";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function buildDashboardFocusDetail(
  schedule: Programacao,
  context: DashboardFocusContext,
  allSchedules: readonly Programacao[] = [],
  today: Date = new Date(),
): DashboardFocusDetail {
  const todayMs = toUtcTodayMs(today);
  const progMs = parseIsoDayMs(schedule.dataProgramada);
  const daysDelta =
    progMs !== null ? Math.round((progMs - todayMs) / MS_PER_DAY) : null;

  let urgencyTone: DashboardFocusUrgencyTone = "upcoming";
  let urgencyText = "Programação agendada";

  if (schedule.situacao === "ENCERRADO") {
    urgencyTone = "completed";
    urgencyText = schedule.dataRealizada
      ? `Concluída em ${formatFocusDateBr(schedule.dataRealizada)}`
      : "Ordem encerrada";
  } else if (schedule.situacao === "ATRASADO" || (daysDelta !== null && daysDelta < 0)) {
    urgencyTone = "overdue";
    const lateDays = daysDelta !== null ? Math.abs(daysDelta) : 0;
    urgencyText =
      lateDays > 0
        ? `Em atraso há ${lateDays} ${lateDays === 1 ? "dia" : "dias"}`
        : "Marcada como atrasada";
  } else if (daysDelta === 0) {
    urgencyTone = "today";
    urgencyText = schedule.horarioAgendado
      ? `Agendada para hoje às ${schedule.horarioAgendado}`
      : "Agendada para hoje";
  } else if (daysDelta !== null && daysDelta > 0) {
    urgencyTone = "upcoming";
    urgencyText = `Programada para daqui a ${daysDelta} ${daysDelta === 1 ? "dia" : "dias"}`;
  }

  const originLabel =
    schedule.origemRegistro === "PCM"
      ? "Integração PCM"
      : "Cadastro Manual";

  const narrativeParts = [
    schedule.observacao?.trim(),
    schedule.narrativaPCM?.trim(),
  ].filter((part, idx, arr): part is string => Boolean(part) && arr.indexOf(part) === idx);

  const narrativeText =
    narrativeParts.length > 0
      ? narrativeParts.join("\n\n")
      : "Nenhuma observação ou narrativa registrada para esta programação.";

  const targetFleet = (schedule.frota || "").trim().toLowerCase();
  const recentFleetHistory: DashboardFocusHistoryEntry[] = targetFleet
    ? allSchedules
        .filter(
          (item) =>
            item.id !== schedule.id &&
            (item.frota || "").trim().toLowerCase() === targetFleet,
        )
        .sort((a, b) => {
          const dateA = a.dataRealizada || a.dataProgramada || "";
          const dateB = b.dataRealizada || b.dataProgramada || "";
          return dateB.localeCompare(dateA);
        })
        .slice(0, 4)
        .map((item) => {
          const bestIso = item.dataRealizada || item.dataProgramada || "";
          return {
            id: item.id,
            dataIso: bestIso,
            dataFormatted: formatFocusDateBr(bestIso),
            tipoPreventiva: item.tipoPreventiva || "Preventiva",
            situacao: item.situacao,
            local: item.descricaoPonto || "Não informado",
          };
        })
    : [];

  return {
    schedule,
    context,
    daysDelta,
    urgencyTone,
    urgencyText,
    formattedProgramada: formatFocusDateBr(schedule.dataProgramada),
    formattedRealizada: schedule.dataRealizada
      ? formatFocusDateBr(schedule.dataRealizada)
      : "Pendente",
    originLabel,
    narrativeText,
    recentFleetHistory,
  };
}

export function getAdjacentFocusOrder(
  list: readonly Programacao[],
  currentId: string,
  direction: "prev" | "next",
): Programacao | null {
  if (list.length <= 1) return null;
  const idx = list.findIndex((item) => item.id === currentId);
  if (idx === -1) return list[0] ?? null;
  const nextIndex =
    direction === "next"
      ? (idx + 1) % list.length
      : (idx - 1 + list.length) % list.length;
  return list[nextIndex] ?? null;
}

export function buildDashboardFocusCopyText(detail: DashboardFocusDetail): string {
  const s = detail.schedule;
  const lines = [
    `Frota ${s.frota}${s.numeroOS ? ` · OS ${s.numeroOS}` : ""}`,
    `Serviço: ${s.tipoPreventiva || "Lavagem / Lubrificação"} (${s.descricaoPonto || "Local não informado"})`,
    `Situação: ${s.situacao} — ${detail.urgencyText}`,
    `Programação: ${detail.formattedProgramada}${s.horarioAgendado ? ` às ${s.horarioAgendado}` : ""}`,
    s.apoioNome ? `Grupo Apoio: ${s.apoioNome}` : null,
    `Observações: ${detail.narrativeText}`,
  ].filter(Boolean);
  return lines.join("\n");
}
