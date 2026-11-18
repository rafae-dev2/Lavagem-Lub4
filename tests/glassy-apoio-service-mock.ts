import type { ApoioData, ApoioOrder } from '../src/types/apoio';
const makeOrder = (frota: string, index: number, external = false): ApoioOrder => ({ chave: `demo-${index}`, os: `DEMO-${index}`, frota, modelo: 'Equipamento de demonstração', grupo_fonte: '', setor: '', ponto: '', origem: external ? 'Terceiro' : 'Oficina', prestador: external ? 'Fratini' : '', status: index % 2 ? 'Andamento' : 'Programada', entrada: '2026-11-04', previsao: '', narrativa: 'DADO FICTÍCIO: verificar vazamento e informar andamento e previsão da manutenção.', ativo: true, primeira_vista: new Date().toISOString(), ultima_vista: new Date().toISOString(), ausente_desde: null });
const data: ApoioData = {
  groups: [{ id: 'caminhoes', nome: 'Caminhões — Demonstração', cor: '#82aef5' }, { id: 'caminhonetes', nome: 'Caminhonetes — Demonstração', cor: '#b49ee4' }],
  fleets: [{ frota: '4508', grupo_id: 'caminhoes', nome: 'Caminhão Munck — Demo' }, { frota: '4512', grupo_id: 'caminhoes', nome: 'Caminhão Caçamba — Demo' }, { frota: '4520', grupo_id: 'caminhoes', nome: 'Caminhão sem ordem — Demo' }, { frota: '7010', grupo_id: 'caminhonetes', nome: 'Caminhonete — Demo' }],
  orders: [makeOrder('4508', 1), makeOrder('4512', 2, true), makeOrder('7010', 3, true)],
  sync: { id: 1, fonte_atualizada: new Date().toISOString(), consultado_em: new Date().toISOString(), sincronizado_em: new Date().toISOString(), total: 3, erro: null }, role: 'viewer',
};
const groupNames = ['Área de Vivência', 'Caminhão Caçamba', 'Caminhão Carga-Seca', 'Caminhão Cavalo', 'Caminhão Munck', 'Caminhão Pipa', 'Caminhonetes Geral', 'Carreta Canavieira', 'Carreta Tanque Vinhaça', 'Reboque Prancha', 'Trator Reboque', 'Veículos Leve'];
const counts = [16, 6, 3, 11, 9, 13, 12, 0, 0, 3, 6, 9];
const manyGroups = groupNames.map((nome, i) => ({ id: `group-demo-${i}`, nome, cor: ['#af65dc', '#219875', '#5882dc', '#887296'][i % 4] }));
const manyFleets = manyGroups.flatMap((group, i) => Array.from({ length: counts[i] }, (_, j) => ({ frota: String(8000 + i * 100 + j), grupo_id: group.id, nome: `Equipamento ${j + 1} — DADO FICTÍCIO` })));
const manyData: ApoioData = { ...data, groups: manyGroups, fleets: manyFleets, orders: manyFleets.map((fleet, i) => makeOrder(fleet.frota, i + 100, i % 2 === 0)) };
export async function loadApoioData() { return new URLSearchParams(location.search).get('fixture') === '12' ? manyData : data; }
export async function syncApoio() { return; }
export async function saveApoioGroup() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }
export async function deleteApoioGroup() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }
export async function saveApoioFleet() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }
export async function deleteApoioFleet() { throw new Error('Dados fictícios: mutação proibida neste teste.'); }
