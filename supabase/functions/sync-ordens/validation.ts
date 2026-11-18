export const SOURCE_FIELDS = [
  'os',
  'eq',
  'modelo',
  'grupo',
  'setor',
  'ponto',
  'origem',
  'prestador',
  'status',
  'entrada',
  'prev',
  'narrativa',
  'motivo',
  'classe',
  'cdPonto',
] as const;

export type SourceField = (typeof SOURCE_FIELDS)[number];

export interface SourceOrder {
  os: string;
  eq: string;
  modelo: string;
  grupo: string;
  setor: string;
  ponto: string;
  origem: string;
  prestador: string;
  status: string;
  entrada: string;
  prev: string;
  narrativa: string;
  motivo?: string;
  classe?: string;
  cdPonto?: string;
}

export interface SourcePayload {
  ok: true;
  total: number;
  atualizado: string;
  ordens: SourceOrder[];
}

export class SourceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sourceText(value: unknown, field: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  throw new SourceValidationError(`campo ${field} tem tipo inválido`);
}

/**
 * Valida e normaliza exatamente o contrato recebido da fonte pública.
 * `now` é injetável para que as regras de 5/75 minutos sejam testáveis.
 */
export function validateSourcePayload(input: unknown, now = new Date()): SourcePayload {
  if (!isRecord(input)) throw new SourceValidationError('resposta não é um objeto');
  if (input.ok !== true) throw new SourceValidationError('resposta não confirmou ok=true');
  if (!Number.isInteger(input.total) || (input.total as number) < 0) {
    throw new SourceValidationError('total não é inteiro não negativo');
  }
  if (typeof input.atualizado !== 'string' || !input.atualizado.trim()) {
    throw new SourceValidationError('atualizado ausente ou inválido');
  }
  const updatedAt = Date.parse(input.atualizado);
  const nowMs = now.getTime();
  if (!Number.isFinite(updatedAt) || !Number.isFinite(nowMs)) {
    throw new SourceValidationError('atualizado não é uma data válida');
  }
  if (updatedAt > nowMs + 5 * 60 * 1000) {
    throw new SourceValidationError('fonte está mais de 5 minutos no futuro');
  }
  if (updatedAt < nowMs - 75 * 60 * 1000) {
    throw new SourceValidationError('fonte tem mais de 75 minutos');
  }
  if (!Array.isArray(input.ordens)) throw new SourceValidationError('ordens não é array');
  if (input.ordens.length !== input.total) {
    throw new SourceValidationError('total difere da quantidade de ordens');
  }

  const seen = new Set<string>();
  const ordens = input.ordens.map((raw, index): SourceOrder => {
    if (!isRecord(raw)) throw new SourceValidationError(`ordem ${index + 1} não é objeto`);
    const normalized = {} as SourceOrder;
    for (const field of SOURCE_FIELDS.slice(0, 12)) {
      if (!Object.prototype.hasOwnProperty.call(raw, field)) {
        throw new SourceValidationError(`ordem ${index + 1}: campo obrigatório ${field} omitido`);
      }
      if (raw[field] === null && !['eq', 'prev', 'prestador'].includes(field)) {
        throw new SourceValidationError(`ordem ${index + 1}: campo obrigatório ${field} nulo`);
      }
    }
    for (const field of SOURCE_FIELDS) normalized[field] = sourceText(raw[field], field);
    normalized.os = normalized.os.trim();
    normalized.eq = normalized.eq.trim();
    if (!normalized.os) throw new SourceValidationError(`ordem ${index + 1} tem OS vazia`);
    // A fonte contém OS sem equipamento: preservar com marcador explícito,
    // que jamais é um número real de frota.
    if (!normalized.eq) normalized.eq = 'SEM-FROTA';
    const key = `${normalized.eq}::${normalized.os}`;
    if (seen.has(key)) throw new SourceValidationError(`ordem duplicada: ${key}`);
    seen.add(key);
    return normalized;
  });

  return {
    ok: true,
    total: input.total as number,
    atualizado: input.atualizado,
    ordens,
  };
}
