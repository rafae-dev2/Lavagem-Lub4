import type { ApoioData, ApoioFleet, ApoioGroup, ApoioOrder } from "../types/apoio";
import { CATEGORIAS_PADRAO } from "./frotaCategorias";

/** Categorias próprias dos quatro acompanhamentos de reforma. */
export type ReformEquipmentCategory =
  | "rodomuda"
  | "colhedoras"
  | "trator-transbordo"
  | "trator-reboque";

export type ReformEquipmentEvidence =
  | "grupo-apoio"
  | "frota-apoio"
  | "fonte"
  | "categoria-padrao"
  | null;

export interface ReformEquipmentResolution {
  category: ReformEquipmentCategory | null;
  evidence: ReformEquipmentEvidence;
  reason: string;
}

export const REFORM_EQUIPMENT_LABELS: Record<ReformEquipmentCategory, string> = {
  rodomuda: "Carreta Rodomuda",
  colhedoras: "Colhedora",
  "trator-transbordo": "Trator Transbordo",
  "trator-reboque": "Trator Reboque",
};

const STANDARD_CATEGORY_IDS: ReadonlyArray<
  readonly [string, ReformEquipmentCategory]
> = [
  ["carretas_rodomuda", "rodomuda"],
  ["colhedoras_cana", "colhedoras"],
];

const CATEGORY_BY_STANDARD_ID: ReadonlyMap<string, ReformEquipmentCategory> =
  new Map<string, ReformEquipmentCategory>(
    STANDARD_CATEGORY_IDS.flatMap(([categoryId, category]) => {
      const categoryDefinition = CATEGORIAS_PADRAO.find(
        (candidate) => candidate.id === categoryId,
      );
      return (categoryDefinition?.frotas || [])
        .map((fleet) => [fleet.trim(), category] as const)
        .filter(([fleet]) => Boolean(fleet));
    }),
  );

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** Normalização de nomes de grupos/modelos sem perder a separação entre palavras. */
export function normalizeReformEquipmentText(value: unknown): string {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasWord(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}

function hasReboquePrancha(value: string): boolean {
  return /\breboqueprancha\b/.test(value) || /\breboque\s+prancha\b/.test(value);
}

/**
 * Detecta apenas identidades explícitas. O retorno nulo também cobre textos
 * conflitantes, que não devem ser arbitrariamente convertidos em uma categoria.
 */
function explicitCategories(value: string): Set<ReformEquipmentCategory> {
  const categories = new Set<ReformEquipmentCategory>();
  if (hasWord(value, /\brodomudas?\b/)) categories.add("rodomuda");
  if (hasWord(value, /\bcolhedor(?:a|as|es)?\b/)) categories.add("colhedoras");

  const hasTractor = /\btrator(?:es)?\b/.test(value);
  if (hasTractor && /\btransbordo(?:s)?\b/.test(value))
    categories.add("trator-transbordo");
  if (
    hasTractor &&
    /\breboque(?:s)?\b/.test(value) &&
    !hasReboquePrancha(value)
  )
    categories.add("trator-reboque");
  return categories;
}

function oneExplicitCategory(value: string): ReformEquipmentCategory | null {
  const categories = explicitCategories(value);
  return categories.size === 1 ? [...categories][0] : null;
}

function categoryLabel(category: ReformEquipmentCategory): string {
  return REFORM_EQUIPMENT_LABELS[category];
}

function categoryReason(
  category: ReformEquipmentCategory,
  origin: "grupo-apoio" | "frota-apoio" | "fonte" | "categoria-padrao",
  detail: string,
): string {
  const prefix =
    origin === "grupo-apoio"
      ? "Grupo do cadastro Apoio"
      : origin === "frota-apoio"
        ? "Nome da frota no cadastro Apoio"
        : origin === "fonte"
          ? "Grupo/modelo da fonte"
          : "Mapa padrão de frotas";
  return `${prefix} identifica ${categoryLabel(category)}${detail ? ` (${detail})` : ""}`;
}

function ownFleet(data: ApoioData, fleet: string): ApoioFleet | undefined {
  return data.fleets.find((candidate) => candidate.frota === fleet);
}

function ownGroup(data: ApoioData, fleet: ApoioFleet | undefined): ApoioGroup | undefined {
  return fleet
    ? data.groups.find((candidate) => candidate.id === fleet.grupo_id)
    : undefined;
}

function knownNonTargetIdentity(value: string): boolean {
  // Estes sinais identificam outro universo de equipamento e, portanto,
  // impedem que um ID padrão seja usado como chute. "Trator" sozinho não
  // recebe uma divisão arbitrária entre transbordo e reboque.
  return (
    /\bcanavieir\w*\b/.test(value) ||
    /\bcavalos?\b/.test(value) ||
    /\bcaminhao(?:s|es)?\b/.test(value) ||
    /\bprancha\b/.test(value) ||
    hasReboquePrancha(value) ||
    /\breboque(?:s)?\b/.test(value) ||
    /\btrator(?:es)?\b/.test(value) ||
    (/(?:transbordo|transbordos)\b/.test(value) &&
      !/\btrator(?:es)?\b/.test(value))
  );
}

function strongNonTargetRegistryIdentity(value: string): boolean {
  // "Tratores Pesados" e "Trator Geral" são grupos genéricos: não podem
  // escolher reboque/transbordo, mas também não anulam um modelo/fonte que
  // os identifique explicitamente.
  return (
    /\bcanavieir\w*\b/.test(value) ||
    /\bcavalos?\b/.test(value) ||
    /\bcaminhao(?:s|es)?\b/.test(value) ||
    /\bprancha\b/.test(value) ||
    hasReboquePrancha(value)
  );
}

function standardCategoryForFleet(fleet: string): ReformEquipmentCategory | null {
  return CATEGORY_BY_STANDARD_ID.get(fleet) || null;
}

function standardCategoryIsContradicted(
  category: ReformEquipmentCategory,
  value: string,
): boolean {
  const normalized = normalizeReformEquipmentText(value);
  if (!normalized) return false;
  const explicit = oneExplicitCategory(normalized);
  if (explicit) return explicit !== category;
  if (category === "rodomuda" || category === "colhedoras")
    return knownNonTargetIdentity(normalized);
  return false;
}

/**
 * Resolve a categoria de uma ordem sem consultar narrativa, ponto, setor,
 * motivo ou serviço. O cadastro próprio é a autoridade quando declara um
 * alvo; grupo/modelo da fonte só complementam um cadastro genérico.
 */
export function resolveReformEquipment(
  data: ApoioData,
  order: ApoioOrder,
): ReformEquipmentResolution {
  const fleetNumber = text(order.frota);
  const registeredFleet = ownFleet(data, fleetNumber);
  if (!registeredFleet) {
    return {
      category: null,
      evidence: null,
      reason: "Frota não está cadastrada em apoio_frotas; reforma específica exige equipamento próprio cadastrado",
    };
  }

  const registeredGroup = ownGroup(data, registeredFleet);
  const groupText = normalizeReformEquipmentText(registeredGroup?.nome);
  const fleetText = normalizeReformEquipmentText(registeredFleet.nome);
  const sourceText = normalizeReformEquipmentText(
    `${text(order.grupo_fonte)} ${text(order.modelo)}`,
  );

  // Um grupo de apoio explicitamente alvo é autoridade, inclusive quando a
  // fonte usa o outro implemento (transbordo/reboque) para a mesma frota.
  const groupCategory = oneExplicitCategory(groupText);
  if (groupCategory) {
    return {
      category: groupCategory,
      evidence: "grupo-apoio",
      reason: categoryReason(groupCategory, "grupo-apoio", text(registeredGroup?.nome)),
    };
  }

  // O nome da frota é uma evidência própria secundária. O grupo continua
  // podendo ser genérico (por exemplo, Equipamentos Apoio).
  const fleetCategory = oneExplicitCategory(fleetText);
  if (fleetCategory) {
    return {
      category: fleetCategory,
      evidence: "frota-apoio",
      reason: categoryReason(fleetCategory, "frota-apoio", registeredFleet.nome),
    };
  }

  const sourceCategories = explicitCategories(sourceText);
  if (sourceCategories.size === 1) {
    const sourceCategory = [...sourceCategories][0];
    // Um cadastro nominalmente contraditório não é "genérico" e não deve ser
    // sobreposto por um texto de fonte. Grupos como Tratores Pesados, porém,
    // são genéricos para a divisão reforma e permitem a evidência explícita da
    // fonte (sem jamais escolher reboque/transbordo sozinhos).
    const registeredStrongIdentity =
      strongNonTargetRegistryIdentity(groupText) ||
      strongNonTargetRegistryIdentity(fleetText);
    if (!registeredStrongIdentity) {
      return {
        category: sourceCategory,
        evidence: "fonte",
        reason: categoryReason(sourceCategory, "fonte", text(order.grupo_fonte) || text(order.modelo)),
      };
    }
  }

  const standardCategory = standardCategoryForFleet(fleetNumber);
  if (
    standardCategory &&
    !standardCategoryIsContradicted(standardCategory, `${groupText} ${fleetText}`) &&
    !standardCategoryIsContradicted(standardCategory, sourceText)
  ) {
    return {
      category: standardCategory,
      evidence: "categoria-padrao",
      reason: categoryReason(
        standardCategory,
        "categoria-padrao",
        `frota ${fleetNumber}`,
      ),
    };
  }

  const groupOrFleetDetail = text(registeredGroup?.nome) || registeredFleet.nome;
  const sourceDetail = text(order.grupo_fonte) || text(order.modelo);
  const detail = sourceDetail
    ? `cadastro ${groupOrFleetDetail || "genérico"}; fonte ${sourceDetail}`
    : `cadastro ${groupOrFleetDetail || "genérico"}`;
  return {
    category: null,
    evidence: null,
    reason: `Cadastro/fonte não identificam uma categoria única de reforma (${detail})`,
  };
}

/** Alias semântico para consumidores que preferem explicitar "categoria". */
export const resolveReformEquipmentCategory = resolveReformEquipment;

export function reformEquipmentLabel(
  category: ReformEquipmentCategory | null | undefined,
): string {
  return category ? categoryLabel(category) : "Equipamento de reforma não classificado";
}

export function reformEquipmentCategoryMatches(
  category: ReformEquipmentCategory | null,
  expected: ReformEquipmentCategory,
): boolean {
  return category === expected;
}

export { standardCategoryForFleet as standardReformEquipmentCategory };
