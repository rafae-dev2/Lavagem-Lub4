import type { ApoioData, ApoioOrder } from '../src/types/apoio';

const makeOrder = (frota: string, index: number, origem: string, prestador: string, modelo: string): ApoioOrder => ({
  chave: `demo-${index}`,
  os: `DEMO-${index}`,
  frota,
  modelo,
  grupo_fonte: '',
  setor: '',
  ponto: '',
  origem,
  prestador,
  status: 'Andamento',
  entrada: '2026-11-04',
  previsao: '',
  narrativa: 'DADO FICTÍCIO: cobrar retorno da oficina.',
  ativo: true,
  primeira_vista: new Date().toISOString(),
  ultima_vista: new Date().toISOString(),
  ausente_desde: null,
});

const data: ApoioData = {
  groups: [{ id: 'caminhoes', nome: 'Caminhões — Demonstração', cor: '#82aef5' }],
  fleets: [
    { frota: '4508', grupo_id: 'caminhoes', nome: 'Caminhão Munck — Demo' },
    { frota: '4512', grupo_id: 'caminhoes', nome: 'Caminhão Caçamba — Demo' },
    { frota: '4520', grupo_id: 'caminhoes', nome: 'Caminhão interno — Demo' },
  ],
  orders: [
    makeOrder('4508', 1, 'Terceiro', 'FRATINI REPARACAO DE IMPLEMENTOS', 'MB 2831 6x4 muck'),
    makeOrder('4512', 2, 'Terceiro', 'SERGIO MAIA ADAMANTINA - ME', 'MB 2219 6x4 muck'),
    makeOrder('4520', 3, 'Oficina', '', 'MB 2638 6x4 Caçamba'),
  ],
  sync: {
    id: 1,
    fonte_atualizada: new Date().toISOString(),
    consultado_em: new Date().toISOString(),
    sincronizado_em: new Date().toISOString(),
    total: 3,
    erro: null,
  },
  role: 'viewer',
};

export async function loadApoioData() { return data; }
export async function syncApoio() { return; }
export async function saveApoioGroup() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }
export async function deleteApoioGroup() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }
export async function saveApoioFleet() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }
export async function deleteApoioFleet() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }

/** Versão fictícia: igual à fotografia do mock, para o teste não recarregar à toa. */
export async function loadApoioVersion() {
  return {
    fonteAtualizada: data.sync.fonte_atualizada,
    sincronizadoEm: data.sync.sincronizado_em,
    total: data.sync.total,
    erro: null,
  };
}
export async function loadApoioTVData() { return data; }
