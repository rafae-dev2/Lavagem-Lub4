import type { ApoioData, ApoioOrder, ApoioReportRow } from "../types/apoio";
import { CATEGORIAS_PADRAO } from "./frotaCategorias";
import { oficinaLabel } from "../types/apoio";
import {
  resolveReformEquipment,
  type ReformEquipmentCategory,
} from "./reformEquipment";

/** Módulos operacionais consumidos pela Gestão de Ordens de Manutenção. */
export type TrackingModule =
  | "preventivas"
  | "lubrificacao"
  | "reformas"
  | "reformas-rodomuda"
  | "reformas-colhedoras"
  | "reformas-trator-transbordo"
  | "reformas-trator-reboque";

/** Status de rastreamento. Atraso é um indicador separado, não um status. */
export type TrackingStatus =
  | "programado"
  | "andamento"
  | "encerrado"
  | "ausente"
  | "outros";

export type TrackingClosureOrigin = "fonte" | "ausencia";

export interface TrackingRow extends ApoioReportRow {
  trackingStatus: TrackingStatus;
  classificationReason: string;
  overdue: boolean;
  /** Origem derivada do encerramento; ausente em fixtures legadas é válido. */
  closureOrigin?: TrackingClosureOrigin | null;
  /** Data/hora em que a saída da fonte foi detectada, nunca data de execução. */
  closedDetectedAt?: string | null;
}

export interface TrackingFilters {
  query: string;
  status: string;
  group: string;
  location: string;
  provider: string;
  start: string;
  end: string;
}

export interface TrackingCounts {
  total: number;
  programado: number;
  andamento: number;
  encerrado: number;
  ausente: number;
  outros: number;
  atrasado: number;
  frotas: number;
}

export const TRACKING_TITLES: Record<TrackingModule, string> = {
  preventivas: "Preventivas Carretas Canavieiras",
  lubrificacao: "Lubrificação Carretas Canavieiras",
  reformas: "Reformas Equipamentos Apoio",
  "reformas-rodomuda": "Controle de Reforma Carretas Rodomuda",
  "reformas-colhedoras": "Controle de Reforma Colhedora",
  "reformas-trator-transbordo": "Controle Reforma Trator Transbordo",
  "reformas-trator-reboque": "Controle Reforma Trator Reboque",
};

const REFORM_MODULE_CATEGORIES: Partial<
  Record<TrackingModule, ReformEquipmentCategory>
> = {
  "reformas-rodomuda": "rodomuda",
  "reformas-colhedoras": "colhedoras",
  "reformas-trator-transbordo": "trator-transbordo",
  "reformas-trator-reboque": "trator-reboque",
};

const CANAVIEIRA_CATEGORY_ID = "carretas_canavieiras";
const CANAVIEIRA_FLEETS = new Set(
  (
    CATEGORIAS_PADRAO.find((category) => category.id === CANAVIEIRA_CATEGORY_ID)
      ?.frotas || []
  )
    .map((fleet) => fleet.trim())
    .filter(Boolean),
);

function text(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

/** Normalização para comparação: acentos e pontuação não mudam a regra. */
function fold(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

/*
 * Os termos abaixo são deliberadamente estreitos. "Manutenção", "corretiva"
 * ou "reparo" sozinhos não transformam uma ordem em reforma ou preventiva.
 * O fallback só entra quando classe/motivo não deram um sinal conhecido.
 */
const REFORM_TERMS = [
  /\breforma(?:r|ndo|do|da|s)?\b/,
  /\brecondicion(?:a|ar|ado|amento|acao|acao)\w*\b/,
  /\brestaur(?:a|ar|ado|acao)\w*\b/,
];

const LUBRIFICATION_TERMS = [
  /\blubrifica\w*\b/,
  /\blub\b/,
  /\bengrax\w*\b/,
  /\bgrax\w*\b/,
];

const PREVENTIVE_TERMS = [/\bprevent\w*\b/, /\bplano\s+mecanic\w*\b/];

function structuredText(order: ApoioOrder): string {
  return fold(`${text(order.classe)} ${text(order.motivo)}`);
}

function fallbackText(order: ApoioOrder): string {
  return fold(`${text(order.ponto)} ${text(order.setor)} ${text(order.narrativa)}`);
}

function classText(order: ApoioOrder): string {
  return fold(text(order.classe));
}

function serviceStructuredText(order: ApoioOrder): string {
  return fold(`${text(order.motivo)} ${text(order.ponto)} ${text(order.setor)}`);
}

function explicitReform(value: string): boolean {
  return hasAny(value, REFORM_TERMS);
}

function explicitLubrification(value: string): boolean {
  return hasAny(value, LUBRIFICATION_TERMS);
}

function explicitPreventive(value: string): boolean {
  return hasAny(value, PREVENTIVE_TERMS);
}

function orderIsReform(order: ApoioOrder): {
  matched: boolean;
  source: "structured" | "fallback" | null;
} {
  const structured = structuredText(order);
  if (explicitReform(structured))
    return { matched: true, source: "structured" };
  // Um sinal estruturado conhecido de outro módulo bloqueia narrativa
  // conflitante: a fonte estruturada tem precedência sobre o fallback.
  if (explicitLubrification(structured) || explicitPreventive(structured))
    return { matched: false, source: null };

  const fallback = fallbackText(order);
  if (explicitReform(fallback)) return { matched: true, source: "fallback" };
  return { matched: false, source: null };
}

function orderIsLubrification(order: ApoioOrder): {
  matched: boolean;
  source: "structured" | "fallback" | null;
} {
  const classValue = classText(order);
  const serviceStructured = serviceStructuredText(order);
  // Classe PREVENTIVA é regime de manutenção, não serviço. Um ponto ou
  // motivo de lubrificação deve vencer essa classe genérica.
  if (explicitLubrification(serviceStructured))
    return { matched: true, source: "structured" };
  if (explicitLubrification(classValue))
    return { matched: true, source: "structured" };
  if (
    explicitReform(classValue) ||
    explicitPreventive(classValue) ||
    explicitPreventive(text(order.motivo))
  )
    return { matched: false, source: null };

  const fallback = fallbackText(order);
  if (explicitLubrification(fallback))
    return { matched: true, source: "fallback" };
  return { matched: false, source: null };
}

function orderIsPreventive(order: ApoioOrder): {
  matched: boolean;
  source: "structured" | "fallback" | null;
} {
  const serviceStructured = serviceStructuredText(order);
  const classValue = classText(order);
  // Motivo/ponto/setor descrevem o serviço. Não deixe a classe PREVENTIVA
  // genérica transformar lubrificação em preventiva.
  if (explicitReform(serviceStructured) || explicitLubrification(serviceStructured))
    return { matched: false, source: null };
  if (explicitPreventive(text(order.motivo)) || explicitPreventive(classValue))
    return { matched: true, source: "structured" };

  // Uma classe corretiva desconhecida não é evidência de preventiva; só um
  // sinal preventivo explícito permite a entrada neste módulo.
  if (/\bcorretiv\w*\b/.test(classValue))
    return { matched: false, source: null };

  const fallback = fallbackText(order);
  if (explicitReform(fallback) || explicitLubrification(fallback))
    return { matched: false, source: null };
  if (explicitPreventive(fallback))
    return { matched: true, source: "fallback" };
  return { matched: false, source: null };
}

function assertiveCanavieira(value: string): boolean {
  if (/\b(?:cavalo|cavalos|caminhao|caminhoes)\b/.test(value)) return false;
  // Implementos canavieiros especiais cuja descrição não contém “carreta canavieira”.
  const specializedCanavieira =
    /\bcarretas?\s+tanque\s+(?:de\s+)?vinhaca\b/.test(value) ||
    /\bdollys?\s+(?:canavieir\w*|de\s+cana|da\s+cana)\b/.test(value) ||
    /\b(?:canavieir\w*|de\s+cana|da\s+cana)\s+dollys?\b/.test(value);
  return (
    specializedCanavieira ||
    /\b(?:carreta|carretas|reboque|reboques|implemento|implementos)\s+(?:canavieir\w*|de\s+cana|da\s+cana)\b/.test(
      value,
    ) ||
    /\bcanavieir\w*\s+(?:carreta|carretas|reboque|reboques|implemento|implementos)\b/.test(
      value,
    )
  );
}

function canavieiraIdentity(
  order: ApoioOrder,
  data?: ApoioData,
): { matched: boolean; reason: string } {
  const fleet = text(order.frota);
  if (CANAVIEIRA_FLEETS.has(fleet)) {
    return {
      matched: true,
      reason: `Frota ${fleet} reconhecida no mapa padrão de carretas canavieiras`,
    };
  }

  // A fonte pode trazer frota nova antes do mapa local. Só aceitamos
  // identificadores assertivos; a palavra genérica "carreta" não basta.
  const sourceIdentity = fold(
    `${text(order.grupo_fonte)} ${text(order.modelo)}`,
  );
  if (assertiveCanavieira(sourceIdentity)) {
    const descriptor = text(order.grupo_fonte) || text(order.modelo);
    return {
      matched: true,
      reason: `Grupo/modelo da fonte identifica carreta canavieira (${descriptor})`,
    };
  }

  // Cadastro próprio também é uma fonte assertiva para frotas novas. O nome
  // do grupo, seu id/slug e o nome da frota precisam mencionar cana/canavieiro.
  const registered = data?.fleets.find(
    (candidate) => candidate.frota === fleet,
  );
  const group = registered
    ? data?.groups.find((candidate) => candidate.id === registered.grupo_id)
    : undefined;
  const registryIdentity = fold(
    `${registered?.nome || ""} ${group?.nome || ""} ${registered?.grupo_id || ""}`,
  );
  if (!assertiveCanavieira(registryIdentity))
    return { matched: false, reason: "" };
  return {
    matched: true,
    reason: `Cadastro identifica carreta canavieira (${text(group?.nome, text(registered?.nome, fleet))})`,
  };
}

function ownFleet(
  data: ApoioData,
  fleet: string,
): ApoioData["fleets"][number] | undefined {
  return data.fleets.find((candidate) => candidate.frota === fleet);
}

const EXPLICIT_CLOSED_STATUSES = new Set([
  "encerrado",
  "encerrada",
  "concluido",
  "concluida",
  "realizado",
  "realizada",
  "fechado",
  "fechada",
]);

const PROGRAMMED_STATUSES = new Set([
  "programado",
  "programada",
  "agendado",
  "agendada",
]);

function isExplicitClosedStatus(value: unknown): boolean {
  return EXPLICIT_CLOSED_STATUSES.has(fold(value));
}

function isProgrammedStatus(value: unknown): boolean {
  return PROGRAMMED_STATUSES.has(fold(value));
}

function classifyStatus(order: ApoioOrder): TrackingStatus {
  const raw = fold(order.status);

  // Um status explícito de encerramento continua sendo origem da fonte.
  if (isExplicitClosedStatus(raw)) return "encerrado";
  // Uma saída só é encerramento operacional quando o snapshot traz o
  // conjunto de marcas temporais gravado pela integração validada.
  if (order.ativo === false)
    return absenceProof(order) ? "encerrado" : "ausente";

  if (raw === "andamento" || raw === "em andamento" || raw === "em execucao")
    return "andamento";
  if (PROGRAMMED_STATUSES.has(raw))
    return "programado";
  return "outros";
}

interface ParsedDate {
  timestamp: number;
  dateOnly: boolean;
  dateKey: string;
}

const OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";
const OPERATIONAL_OFFSET_MS = 3 * 60 * 60 * 1000;
// A configuração é fixa: reutilizar Intl evita uma construção por data/ordem.
const OPERATIONAL_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: OPERATIONAL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function brazilDateKey(timestamp: number): string | null {
  if (!Number.isFinite(timestamp)) return null;
  const parts = OPERATIONAL_DAY_FORMATTER.formatToParts(new Date(timestamp));
  const values: Record<string, string> = {};
  for (const part of parts)
    if (part.type !== "literal") values[part.type] = part.value;
  if (!values.year || !values.month || !values.day) return null;
  return `${values.year}-${values.month}-${values.day}`;
}

function operationalTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number {
  // Fonte Apoio envia horário de parede sem offset. O contrato operacional é
  // fixo em Brasília -03; nunca delegar esse caso ao fuso do navegador.
  return (
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond) +
    OPERATIONAL_OFFSET_MS
  );
}

/** Datas da fonte são aceitas somente quando o calendário é válido. */
function parseDate(value: unknown): ParsedDate | null {
  const raw = text(value);
  if (!raw) return null;

  const dmy =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      raw,
    );
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const hour = Number(dmy[4] || 0);
    const minute = Number(dmy[5] || 0);
    const second = Number(dmy[6] || 0);
    if (
      !validCalendarDate(year, month, day) ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    )
      return null;
    const timestamp = operationalTimestamp(
      year,
      month,
      day,
      hour,
      minute,
      second,
    );
    return {
      timestamp,
      dateOnly: !dmy[4],
      dateKey: brazilDateKey(timestamp) || dateKey(year, month, day),
    };
  }

  const iso =
    /^(\d{4})-(\d{2})-(\d{2})(?:(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      raw,
    );
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  const hasTime = iso[4] !== undefined;
  const hour = Number(iso[4] || 0);
  const minute = Number(iso[5] || 0);
  const second = Number(iso[6] || 0);
  if (
    !validCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return null;
  if (iso[8] && iso[8] !== "Z") {
    const zone = /[+-](\d{2}):?(\d{2})$/.exec(iso[8]);
    if (!zone || Number(zone[1]) > 23 || Number(zone[2]) > 59) return null;
  }

  // Date-only and no-zone timestamps are operational wall time. Only explicit
  // offsets/Z use Date.parse; this avoids silently adopting the browser zone.
  const fraction = iso[7] ? Number((iso[7] + "000").slice(0, 3)) : 0;
  const timestamp = iso[8]
    ? Date.parse(
        raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw,
      )
    : operationalTimestamp(year, month, day, hour, minute, second, fraction);
  if (!Number.isFinite(timestamp)) return null;
  const operationalKey = brazilDateKey(timestamp);
  if (!operationalKey) return null;
  return {
    timestamp,
    dateOnly: !hasTime,
    dateKey: operationalKey,
  };
}

/**
 * Evidência mínima gravada pelo aplicar_apoio_snapshot para uma saída real da
 * fotografia. Falha/atraso de consulta não cria estes campos e, portanto, não
 * pode ser confundido com encerramento.
 */
function absenceProof(order: ApoioOrder | TrackingRow): ParsedDate | null {
  if (order.ativo !== false) return null;
  const firstSeen = parseDate(order.primeira_vista);
  const lastSeen = parseDate(order.ultima_vista);
  const detected = parseDate(order.ausente_desde);
  if (!firstSeen || !lastSeen || !detected) return null;
  if (firstSeen.timestamp > lastSeen.timestamp || lastSeen.timestamp > detected.timestamp) return null;
  return detected;
}

interface DerivedClosure {
  origin: TrackingClosureOrigin | null;
  detectedAt: string | null;
}

function closureFromOrder(order: ApoioOrder): DerivedClosure {
  const absence = absenceProof(order);
  if (isExplicitClosedStatus(order.status)) {
    return {
      origin: "fonte",
      detectedAt: absence ? text(order.ausente_desde) : null,
    };
  }
  return absence
    ? { origin: "ausencia", detectedAt: text(order.ausente_desde) }
    : { origin: null, detectedAt: null };
}

/** Estado operacional compartilhado por Apoio e pelos três acompanhamentos. Não grava status na fonte. */
export function getMaintenanceOrderClosure(order: ApoioOrder) {
  return { status: classifyStatus(order), ...closureFromOrder(order) };
}

function validNow(now: Date): Date {
  return Number.isFinite(now.getTime()) ? now : new Date(Number.NaN);
}

function isOverdue(
  row: Pick<TrackingRow, "trackingStatus" | "status" | "previsao" | "overdue">,
  now = new Date(),
): boolean {
  const reference = validNow(now);
  if (row.trackingStatus === "encerrado" || row.trackingStatus === "ausente")
    return false;
  const due = parseDate(row.previsao);
  if (!due || !Number.isFinite(reference.getTime())) return false;
  if (due.dateOnly) {
    const today = brazilDateKey(reference.getTime());
    if (!today) return false;
    return due.dateKey < today;
  }
  return due.timestamp < reference.getTime();
}

function makeReportRow(
  data: ApoioData,
  order: ApoioOrder,
  identityReason: string,
  signalReason: string,
  fallbackEquipment = "Equipamento da fonte",
): TrackingRow {
  const fleet = ownFleet(data, text(order.frota));
  const group = fleet
    ? data.groups.find((candidate) => candidate.id === fleet.grupo_id)
    : undefined;
  const apoio = fleet
    ? text(group?.nome, "Grupo não encontrado")
    : text(order.grupo_fonte, "Carretas Canavieiras — fonte");
  const equipamento = fleet
    ? text(fleet.nome, text(order.modelo, "Equipamento não informado"))
    : text(order.modelo, fallbackEquipment);
  const trackingStatus = classifyStatus(order);
  const closure = closureFromOrder(order);
  const base = {
    ...order,
    apoio,
    equipamento,
    trackingStatus,
    // Estes campos são derivados apenas para apresentação; a fotografia e o
    // status original continuam exatamente como vieram da fonte.
    closureOrigin: closure.origin,
    closedDetectedAt: closure.detectedAt,
    classificationReason: [identityReason, signalReason]
      .filter(Boolean)
      .join("; "),
    overdue: false,
  } satisfies Omit<TrackingRow, "overdue"> & { overdue: boolean };
  return { ...base, overdue: isOverdue(base, new Date()) };
}

function rowAtNow(row: TrackingRow, now: Date): TrackingRow {
  const overdue = isOverdue(row, now);
  return overdue === row.overdue ? row : { ...row, overdue };
}

function signalReason(
  kind: "lubrificacao" | "reforma",
  source: "structured" | "fallback" | null,
): string {
  const label = kind === "lubrificacao" ? "Lubrificação" : "Reforma";
  if (source === "structured")
    return `${label} identificada em classe/motivo estruturado`;
  if (source === "fallback")
    return `${label} identificada em ponto/narrativa (fallback conservador)`;
  return "";
}

/**
 * Seleciona ordens da fotografia do Apoio para um módulo.
 *
 * Regras de escopo:
 * - preventivas/lubrificação: frota do mapa/cadastro ou grupo/modelo assertivo;
 * - reformas: somente frota atualmente cadastrada em apoio_frotas;
 * - reformas específicas: além do cadastro próprio, a categoria precisa ser
 *   resolvida pelo grupo/nome cadastrado, grupo/modelo da fonte ou mapa padrão;
 * - classe/motivo estruturados têm prioridade; ponto/narrativa são fallback;
 * - preventiva exige "preventiva/prevent" ou "plano mecânico" explícito;
 * - lubrificação exige "lubrifica/engrax/graxa"; lavagem, limpeza e óleo
 *   isolados permanecem fora deste módulo;
 * - uma ordem não é considerada reforma por conter apenas "manutenção" ou
 *   "corretiva".
 */
export function buildTrackingRows(
  data: ApoioData | null,
  module: TrackingModule,
  now = new Date(),
): TrackingRow[] {
  if (!data || !Array.isArray(data.orders)) return [];
  const reference = validNow(now);
  const rows: TrackingRow[] = [];

  for (const order of data.orders) {
    const identity = canavieiraIdentity(order, data);
    const reform = orderIsReform(order);
    const lubrication = orderIsLubrification(order);
    const preventive = orderIsPreventive(order);
    const targetReformCategory = REFORM_MODULE_CATEGORIES[module];
    const reformEquipment = targetReformCategory
      ? resolveReformEquipment(data, order)
      : null;
    let include = false;
    let reason = "";

    if (module === "reformas") {
      // Reforma só existe no universo de equipamentos próprios cadastrados.
      include = Boolean(ownFleet(data, text(order.frota)) && reform.matched);
      if (include) reason = "Equipamento cadastrado em apoio_frotas";
    } else if (targetReformCategory) {
      // Os quatro controles específicos nunca usam equipamento da fonte como
      // frota própria implícita: a ordem precisa estar em apoio_frotas.
      include = Boolean(
        ownFleet(data, text(order.frota)) &&
          reform.matched &&
          reformEquipment?.category === targetReformCategory,
      );
      if (include) reason = reformEquipment?.reason || "";
    } else if (identity.matched) {
      if (module === "lubrificacao") {
        include = lubrication.matched && !reform.matched;
        reason = identity.reason;
      } else {
        include = preventive.matched && !lubrication.matched && !reform.matched;
        reason = identity.reason;
      }
    }

    if (!include) continue;
    const row = makeReportRow(
      data,
      order,
      reason,
      module === "reformas"
        ? signalReason("reforma", reform.source)
        : targetReformCategory
          ? signalReason("reforma", reform.source)
        : module === "lubrificacao"
          ? signalReason("lubrificacao", lubrication.source)
          : `Preventiva identificada em ${preventive.source === "structured" ? "classe/motivo estruturado" : "ponto/narrativa (fallback conservador)"}`,
      module === "preventivas" || module === "lubrificacao"
        ? "Carreta canavieira"
        : "Equipamento da fonte",
    );
    rows.push(rowAtNow(row, reference));
  }
  return rows;
}

function matchesNormalized(actual: unknown, expected: string): boolean {
  return !expected || fold(actual) === fold(expected);
}

function normalizedFilterStatus(value: string): string {
  const key = fold(value);
  if (PROGRAMMED_STATUSES.has(key)) return "programado";
  if (key === "em andamento" || key === "em execucao") return "andamento";
  if (EXPLICIT_CLOSED_STATUSES.has(key)) return "encerrado";
  if (key === "ausente da fonte") return "ausente";
  return key;
}

const OFFICIAL_STATUS_KEYS = new Set([
  "programado",
  "andamento",
  "encerrado",
  "ausente",
  "outros",
]);

function statusMatches(
  row: TrackingRow,
  current: TrackingRow,
  status: string,
): boolean {
  if (status === "atrasado") return current.overdue;
  // Situações oficiais são sempre derivadas. O status da fonte só serve para
  // filtros brutos fora deste vocabulário, preservando compatibilidade.
  if (OFFICIAL_STATUS_KEYS.has(status))
    return current.trackingStatus === status || (status === "outros" && current.trackingStatus === "ausente");
  return status === fold(row.status);
}

function isLegacyStatusAlias(value: string): boolean {
  return (
    value === "programado" ||
    value === "andamento" ||
    value === "encerrado" ||
    value === "ausente" ||
    value === "outros"
  );
}

function normalizedStatusForCompatibility(value: string): string {
  const normalized = normalizedFilterStatus(value);
  if (isLegacyStatusAlias(normalized)) return normalized;
  if (normalized === "em andamento") return "andamento";
  if (normalized === "encerrada")
    return "encerrado";
  return normalized;
}

function filterDateKey(value: string): string | null {
  const parsed = parseDate(value);
  return parsed?.dateKey || null;
}

/** Filtra sem reordenar e sem eliminar dados derivados das linhas recebidas. */
export function filterTrackingRows(
  rows: TrackingRow[],
  filters: TrackingFilters,
  now = new Date(),
): TrackingRow[] {
  const safeRows = Array.isArray(rows) ? rows : [];
  const input = filters || ({} as TrackingFilters);
  const query = fold(input.query);
  const status = normalizedStatusForCompatibility(text(input.status));
  const group = text(input.group);
  const location = text(input.location);
  const provider = text(input.provider);
  const start = text(input.start) ? filterDateKey(text(input.start)) : null;
  const end = text(input.end) ? filterDateKey(text(input.end)) : null;
  const invalidStart = Boolean(text(input.start)) && !start;
  const invalidEnd = Boolean(text(input.end)) && !end;
  const reference = validNow(now);

  return safeRows
    .filter((row) => {
      const current = rowAtNow(row, reference);
      if (invalidStart || invalidEnd) return false;
      if (status && status !== "todos" && status !== "all") {
        if (!statusMatches(row, current, status)) return false;
      }
      if (
        group &&
        !matchesNormalized(row.apoio, group) &&
        !matchesNormalized(row.grupo_fonte, group)
      )
        return false;
      if (
        location &&
        !matchesNormalized(oficinaLabel(row.origem), location) &&
        !matchesNormalized(row.origem, location)
      )
        return false;
      if (provider) {
        const actualProvider = text(row.prestador, "Não informado");
        if (!matchesNormalized(actualProvider, provider)) return false;
      }
      const parsedEntry = parseDate(row.entrada);
      if (start && (!parsedEntry || parsedEntry.dateKey < start)) return false;
      if (end && (!parsedEntry || parsedEntry.dateKey > end)) return false;
      if (query) {
        const haystack = fold(
          [
            row.chave,
            row.os,
            row.frota,
            row.modelo,
            row.equipamento,
            row.apoio,
            row.grupo_fonte,
            row.setor,
            row.ponto,
            row.origem,
            row.prestador,
            row.status,
            row.classe,
            row.motivo,
            row.cd_ponto,
            row.narrativa,
            row.classificationReason,
            row.trackingStatus,
          ]
            .map((value) => text(value))
            .join(" "),
        );
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .map((row) => rowAtNow(row, reference));
}

export function statusLabel(status: TrackingStatus): string {
  switch (status) {
    case "programado":
      return "Programado";
    case "andamento":
      return "Em andamento";
    case "encerrado":
      return "Encerrado";
    case "ausente":
      return "Ausente da fonte";
    case "outros":
      return "Outros";
  }
}

/**
 * Origem do encerramento sem exigir que fixtures antigas já tenham os campos
 * derivados. Status explícito da fonte sempre vence a ausência registrada.
 */
export function trackingClosureOrigin(
  row: TrackingRow,
): TrackingClosureOrigin | null {
  if (isExplicitClosedStatus(row.status)) return "fonte";
  // Uma ordem ativa programada reapareceu: não carregar um encerramento
  // antigo que eventualmente exista em fixture ou objeto reaproveitado.
  if (row.ativo === true && isProgrammedStatus(row.status)) return null;
  if (
    row.trackingStatus === "encerrado" &&
    (row.closureOrigin === "fonte" || row.closureOrigin === "ausencia")
  )
    return row.closureOrigin;
  return absenceProof(row) ? "ausencia" : null;
}

/** Data de detecção operacional; nunca infere data humana de execução. */
export function trackingClosedAt(row: TrackingRow): string | null {
  const origin = trackingClosureOrigin(row);
  if (!origin) return null;
  const explicit = text(row.closedDetectedAt);
  if (explicit && parseDate(explicit)) return explicit;
  if (!absenceProof(row)) return null;
  const detected = text(row.ausente_desde);
  return detected && parseDate(detected) ? detected : null;
}

export function trackingClosureLabel(row: TrackingRow): string {
  const origin = trackingClosureOrigin(row);
  if (origin === "ausencia") return "Encerrado (por saída da fonte)";
  if (origin === "fonte") return "Encerrado (status da fonte)";
  return statusLabel(row.trackingStatus);
}

export function getTrackingCounts(rows: TrackingRow[]): TrackingCounts {
  const counts: TrackingCounts = {
    total: Array.isArray(rows) ? rows.length : 0,
    programado: 0,
    andamento: 0,
    encerrado: 0,
    ausente: 0,
    outros: 0,
    atrasado: 0,
    frotas: 0,
  };
  const fleets = new Set<string>();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.trackingStatus in counts) {
      counts[
        row.trackingStatus as
          | "programado"
          | "andamento"
          | "encerrado"
          | "ausente"
          | "outros"
      ] += 1;
    } else {
      counts.outros += 1;
    }
    if (row.overdue) counts.atrasado += 1;
    const fleet = fold(row.frota);
    if (fleet && fleet !== "sem frota") fleets.add(fleet);
  }
  counts.frotas = fleets.size;
  return counts;
}

export { parseDate as parseTrackingDate };

/** Dias civis observados no mesmo fuso e relógio dos filtros e indicadores. */
export function trackingObservedDays(
  row: TrackingRow,
  now = new Date(),
): number | null {
  const entry = parseDate(row.entrada);
  const reference = row.ativo
    ? brazilDateKey(now.getTime())
    : parseDate(row.ultima_vista)?.dateKey;
  if (!entry || !reference || entry.dateKey > reference) return null;
  return Math.round(
    (Date.parse(`${reference}T00:00:00Z`) -
      Date.parse(`${entry.dateKey}T00:00:00Z`)) /
      86400000,
  );
}
