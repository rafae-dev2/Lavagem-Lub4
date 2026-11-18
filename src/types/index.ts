export type StatusType = 'PENDENTE' | 'ATRASADO' | 'PROGRAMADO' | 'ENCERRADO' | 'ANDAMENTO';
export type TipoPreventiva = 'Lavagem / Lubrificação' | 'Troca de Óleo' | 'Lubrificação' | string;
export type LocalType = 'LAVADOR' | 'CAMPO' | string;

// Tipos para Preventiva Mecânica de Carretas
export type TipoPreventivaMecanica = 'PREVENTIVA' | string;
export type LocalTypeCarreta = 'MECANICA' | string;

export interface Programacao {
  id: string;
  frota: string;
  descricaoPonto: LocalType;
  tipoPreventiva: TipoPreventiva;
  dataProgramada: string;   // ISO: "2026-03-30"
  dataRealizada: string;    // ISO ou ""
  situacao: StatusType;
  horarioAgendado: string;  // "08:00"
  observacao: string;
  rowIndex?: number;        // linha na planilha (para edição/exclusão)
  /** Metadados opcionais da origem PCM; os campos legados acima permanecem o contrato dos relatórios. */
  origemRegistro?: 'MANUAL' | 'PCM';
  pcmChave?: string;
  numeroOS?: string;
  apoioId?: string;
  apoioNome?: string;
  statusPCM?: string;
  entradaPCM?: string;
  previsaoPCM?: string;
  narrativaPCM?: string;
  encerradoDetectadoEm?: string;
  motivoEncerramento?: string;
  ultimaSincronizacaoPCM?: string;
  execucaoConfirmadaEm?: string;
  dataRealizadaOrigem?: 'MANUAL' | 'PCM';
  pcmEdicaoCampos?: Record<string, unknown>;
  pcmEditadoEm?: string;
  manualArquivadoEm?: string;
  manualAutomaticoId?: number;
}

// Interface para Preventiva Mecânica de Carretas
export interface ProgramacaoCarreta {
  id: string;
  frota: string;
  local: LocalTypeCarreta;      // sempre 'MECANICA'
  tipo: TipoPreventivaMecanica; // sempre 'PREVENTIVA'
  dataProgramada: string;       // ISO: "2026-03-30"
  horarioAgendado: string;      // "08:00"
  situacao: StatusType;
  dataRealizada: string;        // ISO ou ""
  observacao: string;
  rowIndex?: number;            // linha na planilha (para edição/exclusão)
}

export interface DashboardStats {
  total: number;
  pendente: number;
  atrasado: number;
  programado: number;
  encerrado: number;
  andamento?: number;
}

// Stats para carretas (mesma estrutura)
export interface DashboardStatsCarreta extends DashboardStats {}

export interface ChartDataItem {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyData {
  mes: string;
  lavagem: number;
  lubrificacao: number;
  trocaOleo: number;
  encerrado: number;
  andamento?: number;
}

// Interface para Manutenção de Equipamentos
export interface ManutencaoEquipamentos {
  id: string;
  numeroFrota: string;           // CD_EQUIPTO
  numeroOS: string;              // NO_BOLETIM
  localOrigem: 'Oficina Interna' | 'Oficina Externa' | 'Campo';
  nomeOficinaExterna?: string;   // Nome da oficina externa (ex: "Oficina do Maia")
  dataAbertura: string;          // ISO: "2026-05-29"
  descricaoServico: string;      // DE_SERVICO
  status: StatusType;
  dataFinalizacao?: string;      // ISO ou ""
  categoria?: string;            // Classificação
  observacoes?: string;
  rowIndex?: number;             // Índice na planilha
}

export interface DashboardStatsManutencaoEquip extends DashboardStats {}

export type PageType = 'central-gerencial' | 'reformas-rodomuda' | 'reformas-colhedoras' | 'reformas-trator-transbordo' | 'reformas-trator-reboque' | 'preventivas-canavieiras' | 'lubrificacao-canavieiras' | 'reformas-apoio' | 'modo-tv-externas' | 'modo-tv' | 'controle-apoio' | 'gestao-ordens-manutencao' | 'dashboard' | 'programacoes' | 'calendario' | 'importar' | 'exportar' | 'configuracoes';

// Configuração da integração com Google Sheets
// A comunicação é feita EXCLUSIVAMENTE via Apps Script — sem API Key do Google
export interface SheetsConfig {
  appsScriptUrl: string;
  spreadsheetId: string;
  sheetName: string;
}

// Config para carretas (sheetName = 'Carretas')
export interface SheetsConfigCarreta extends SheetsConfig {}

// Config para manutenção de equipamentos (sheetName = 'Manutenção_Equipamentos')
export interface SheetsConfigManutencaoEquip extends SheetsConfig {}
