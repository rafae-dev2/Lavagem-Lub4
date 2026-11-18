import { SourceValidationError, validateSourcePayload } from './validation.ts';

const NOW = new Date('2026-11-03T15:00:00.000Z');

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ok: true,
    total: 1,
    atualizado: '2026-11-03T14:45:00.000Z',
    ordens: [{
      os: 'OS-1',
      eq: 'EQ-10',
      modelo: 'Modelo',
      grupo: 'Grupo',
      setor: 'Setor',
      ponto: 'Ponto',
      origem: 'Campo',
      prestador: '',
      status: 'Andamento',
      entrada: '2026-11-03',
      prev: '2026-11-04',
      narrativa: 'Teste',
      motivo: 'Motivo de teste',
      classe: 'Classe de teste',
      cdPonto: '99',
    }],
    ...overrides,
  };
}

function assertInvalid(input: unknown, label: string): void {
  let invalid = false;
  try {
    validateSourcePayload(input, NOW);
  } catch (error) {
    invalid = error instanceof SourceValidationError;
  }
  if (!invalid) throw new Error(`esperava rejeição: ${label}`);
}

Deno.test('aceita payload válido e normaliza os campos da ordem', () => {
  const result = validateSourcePayload(validPayload(), NOW);
  if (result.total !== 1 || result.ordens[0]?.eq !== 'EQ-10') {
    throw new Error('payload válido não foi normalizado corretamente');
  }
  if (result.ordens[0]?.motivo !== 'Motivo de teste'
      || result.ordens[0]?.classe !== 'Classe de teste'
      || result.ordens[0]?.cdPonto !== '99') {
    throw new Error('campos estruturados da fonte não foram preservados');
  }
});

Deno.test('normaliza campos estruturados opcionais ausentes como texto vazio', () => {
  const order = (validPayload().ordens as Array<Record<string, unknown>>)[0] || {};
  delete order.motivo;
  delete order.classe;
  delete order.cdPonto;
  const result = validateSourcePayload(validPayload({ ordens: [order] }), NOW);
  if (result.ordens[0]?.motivo !== ''
      || result.ordens[0]?.classe !== ''
      || result.ordens[0]?.cdPonto !== '') {
    throw new Error('campos estruturados opcionais não foram normalizados');
  }
});

Deno.test('rejeita total divergente', () => {
  assertInvalid(validPayload({ total: 2 }), 'total divergente');
});

Deno.test('rejeita OS vazia e preserva ordens sem frota', () => {
  const order = (validPayload().ordens as Array<Record<string, unknown>>)[0] || {};
  assertInvalid(validPayload({ ordens: [{ ...order, os: '' }] }), 'OS vazia');
  const withoutFleet = validateSourcePayload(validPayload({ ordens: [{ ...order, eq: '   ' }] }), NOW);
  if (withoutFleet.ordens[0].eq !== 'SEM-FROTA') throw new Error('OS sem equipamento não foi preservada');
});

Deno.test('rejeita chave frota + OS duplicada', () => {
  const one = (validPayload().ordens as Array<Record<string, unknown>>)[0];
  assertInvalid(validPayload({ total: 2, ordens: [one, { ...one }] }), 'duplicata');
});

Deno.test('aplica limite de idade de 75 minutos e tolerância futura de 5 minutos', () => {
  assertInvalid(validPayload({ atualizado: '2026-11-03T13:44:59.000Z' }), 'fonte velha');
  assertInvalid(validPayload({ atualizado: '2026-11-03T15:05:01.000Z' }), 'fonte futura');
  validateSourcePayload(validPayload({ atualizado: '2026-11-03T13:45:00.000Z' }), NOW);
  validateSourcePayload(validPayload({ atualizado: '2026-11-03T15:05:00.000Z' }), NOW);
});
