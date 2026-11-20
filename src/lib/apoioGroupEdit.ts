import type { ApoioFleet, ApoioGroup } from '../types/apoio';

const FLEET_CODE_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;

export function parseFleetCodes(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const code = part.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

export interface GroupFleetValidationResult {
  ok: boolean;
  error?: string;
  frotas: string[];
  alreadyInGroup: string[];
  reassignedFromOtherGroup: string[];
  newlyAdded: string[];
}

export function validateGroupFleetAddition(
  raw: string,
  targetGroupId: string,
  existingFleets: readonly ApoioFleet[],
): GroupFleetValidationResult {
  const groupId = targetGroupId.trim();
  const frotas = parseFleetCodes(raw);
  if (!groupId) {
    return {
      ok: false,
      error: 'Selecione ou salve o grupo Apoio antes de adicionar equipamentos.',
      frotas: [],
      alreadyInGroup: [],
      reassignedFromOtherGroup: [],
      newlyAdded: [],
    };
  }
  if (!frotas.length) {
    return {
      ok: false,
      error: 'Informe ao menos um número de frota para adicionar ao grupo.',
      frotas: [],
      alreadyInGroup: [],
      reassignedFromOtherGroup: [],
      newlyAdded: [],
    };
  }
  if (frotas.some((frota) => !FLEET_CODE_PATTERN.test(frota))) {
    return {
      ok: false,
      error: 'Use números ou códigos de frota sem espaços. Separe várias frotas por vírgula.',
      frotas,
      alreadyInGroup: [],
      reassignedFromOtherGroup: [],
      newlyAdded: [],
    };
  }
  if (frotas.some((frota) => frota.toUpperCase() === 'SEM-FROTA')) {
    return {
      ok: false,
      error: 'Registros sem número de frota (SEM-FROTA) não podem ser cadastrados como equipamento próprio.',
      frotas,
      alreadyInGroup: [],
      reassignedFromOtherGroup: [],
      newlyAdded: [],
    };
  }

  const byFrota = new Map(existingFleets.map((fleet) => [fleet.frota, fleet]));
  const alreadyInGroup: string[] = [];
  const reassignedFromOtherGroup: string[] = [];
  const newlyAdded: string[] = [];

  for (const frota of frotas) {
    const existing = byFrota.get(frota);
    if (!existing) {
      newlyAdded.push(frota);
    } else if (existing.grupo_id === groupId) {
      alreadyInGroup.push(frota);
    } else {
      reassignedFromOtherGroup.push(frota);
    }
  }

  return {
    ok: true,
    frotas,
    alreadyInGroup,
    reassignedFromOtherGroup,
    newlyAdded,
  };
}

export function getGroupFleets(fleets: readonly ApoioFleet[], groupId: string): ApoioFleet[] {
  if (!groupId) return [];
  return fleets
    .filter((fleet) => fleet.grupo_id === groupId)
    .slice()
    .sort((a, b) => a.frota.localeCompare(b.frota, 'pt-BR', { numeric: true }));
}

export interface GroupEditDraftSync {
  groupDraft: ApoioGroup;
  fleetGroupId: string;
  inlineFrotas: string;
  inlineNome: string;
}

export function createGroupEditSession(group: ApoioGroup): GroupEditDraftSync {
  return {
    groupDraft: { ...group },
    fleetGroupId: group.id,
    inlineFrotas: '',
    inlineNome: '',
  };
}
