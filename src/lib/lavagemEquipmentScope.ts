import type { Programacao } from '../types';
import { CATEGORIAS_PADRAO } from './frotaCategorias';

export interface LavagemEquipmentIdentity {
  frota: string;
  apoioNome?: string;
}

export const HIDDEN_LAVAGEM_GROUPS = [
  'Carretas Canavieiras',
  'Trator Transbordo',
  'Colhedoras',
  'Carretas Rodomuda',
  'Dolly Canavieiros',
  'Carreta Tanque Vinhaça',
] as const;

const fallbackFleets = new Set(
  CATEGORIAS_PADRAO
    .filter(category => ['carretas_canavieiras', 'colhedoras_cana', 'carretas_rodomuda'].includes(category.id))
    .flatMap(category => category.frotas.map(fleet => fleet.trim())),
);

function normalize(value: unknown): string {
  return String(value ?? '').trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function hiddenGroup(group: string): boolean {
  const compact = group.replace(/\s+/g, '');
  if (/^(?:carretas?canavieiras?|carretas?rodomudas?|colhedoras?|trator(?:es)?(?:de)?transbordos?|dollys?canavieir\w*)$/.test(compact)) return true;
  // Carreta(s) Tanque [de] Vinhaça: singular/plural, "de" opcional e nome
  // compacto do Apoio. O par tanque + vinhaça é exigido para não esconder
  // grupos de água (Caminhão Pipa) nem tanques de outros produtos.
  if (/^(?:carretas?)?(?:de)?tanques?(?:de)?vinhacas?$/.test(compact)) return true;
  return /\bcarretas?\b.*\bcanavieiras?\b/.test(group)
    || /\bcarretas?\b.*\brodomudas?\b/.test(group)
    || /\bcolhedoras?\b/.test(group)
    || /\btrator(?:es)?\b.*\btransbordos?\b/.test(group)
    || /\bdollys?\b.*\bcanavieir\w*\b/.test(group)
    || /\bcanavieir\w*\b.*\bdollys?\b/.test(group)
    || (/\btanques?\b/.test(group) && /\bvinhacas?\b/.test(group));
}

/**
 * Visibilidade somente; não ignora, suspende, encerra ou exclui a ordem.
 * O grupo compartilhado informado pela RPC prevalece sobre mapas antigos.
 * Sem grupo, somente mapas exatos conhecidos podem esconder um legado.
 * Trator Geral/Pesado e Reboque não são convertidos em Transbordo.
 */
export function isHiddenLavagemEquipment(row: LavagemEquipmentIdentity): boolean {
  const group = normalize(row.apoioNome);
  if (group && !['sem categoria', 'nao informado', 'grupo nao encontrado'].includes(group)) {
    return hiddenGroup(group);
  }
  return fallbackFleets.has(String(row.frota ?? '').trim());
}

export function filterLavagemEquipmentSchedules<T extends LavagemEquipmentIdentity>(rows: readonly T[]): T[] {
  return rows.filter(row => !isHiddenLavagemEquipment(row));
}

export function countHiddenLavagemSchedules(rows: readonly Programacao[]): number {
  return rows.reduce((total, row) => total + Number(isHiddenLavagemEquipment(row)), 0);
}
