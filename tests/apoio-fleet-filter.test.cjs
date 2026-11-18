const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { build } = require('esbuild');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'apoio-fleet-filter-'));
  try {
    const outfile = path.join(temp, 'apoioFilters.cjs');
    await build({ entryPoints: ['src/lib/apoioFilters.ts'], bundle: true, outfile, format: 'cjs', platform: 'node' });
    const { apoioBaseRows, filterApoioRows, reconcileApoioFleetSelection } = require(outfile);
    const order = (frota, os, origem, status, prestador = '') => ({
      chave: `${frota}|${os}`,
      frota,
      os,
      origem,
      status,
      prestador,
      ativo: true,
      modelo: `Modelo ${frota}`,
      grupo_fonte: '', setor: '', ponto: '', entrada: '2026-01-01T09:00:00', previsao: '',
      narrativa: `Serviço ${frota}`, primeira_vista: '', ultima_vista: '', ausente_desde: null,
    });
    const data = {
      groups: [
        { id: 'g1', nome: 'Leves', cor: '#00aa00' },
        { id: 'g2', nome: 'Pesados', cor: '#0000aa' },
        { id: 'g3', nome: 'Reserva', cor: '#aa0000' },
      ],
      fleets: [
        { frota: '4508', grupo_id: 'g1', nome: 'Caminhão 4508' },
        { frota: '45080', grupo_id: 'g1', nome: 'Caminhão 45080' },
        { frota: '4509', grupo_id: 'g2', nome: 'Trator 4509' },
        { frota: '4510', grupo_id: 'g2', nome: 'Trator 4510' },
        { frota: '9999', grupo_id: 'g3', nome: 'Reserva 9999' },
      ],
      orders: [
        order('4508', '1', 'Terceiro', 'Andamento', 'Oficina Alfa'),
        order('45080', '2', 'Terceiro', 'Programada', 'Oficina Alfa'),
        order('4509', '3', 'Campo', 'Andamento'),
        order('4510', '4', 'Oficina', 'Aguardando Peça'),
        order('9999', '5', 'Oficina', 'Programada'),
      ],
      sync: null,
      role: 'admin',
    };
    const empty = { query: '', groups: [], location: '', status: '', provider: '' };
    const base = apoioBaseRows(data, 'abertas');

    assert.equal(base.length, 5, 'fixture tem cinco ordens próprias');
    assert.deepEqual(filterApoioRows(data, base, { ...empty, groups: ['g1', 'g2'], fleetsByGroup: { g1: ['4508'], g2: ['4509'] } }).map(row => row.frota), ['4508', '4509'], 'união de grupos aplica cada restrição no grupo certo');
    assert.deepEqual(filterApoioRows(data, base, { ...empty, groups: ['g1', 'g2'], fleetsByGroup: { g1: ['4508'] } }).map(row => row.frota), ['4508', '4509', '4510'], 'restrição de um grupo não remove as frotas do outro');
    assert.deepEqual(filterApoioRows(data, base, { ...empty, groups: ['g1', 'g2'], fleetsByGroup: { g1: [], g2: ['4509'] } }).map(row => row.frota), ['4509'], 'lista vazia explícita significa nenhuma frota somente naquele grupo');
    assert.deepEqual(filterApoioRows(data, base, { ...empty, groups: ['g1'], fleetsByGroup: { g1: ['4508'] } }).map(row => row.frota), ['4508'], 'seleção é igualdade exata e não prefixo: 4508 não seleciona 45080');
    assert.deepEqual(filterApoioRows(data, base, { ...empty, groups: [], fleetsByGroup: {} }).map(row => row.frota), ['4508', '45080', '4509', '4510', '9999'], 'Todos sem restrições preserva todos os grupos');
    assert.equal(filterApoioRows(data, base, { ...empty, groups: ['g1'], fleetsByGroup: { g1: ['4508'] }, query: '4508', location: 'Oficina Externa', status: 'Andamento', provider: 'Oficina Alfa' }).length, 1, 'frota combina com busca, localização, status e prestador');
    assert.equal(filterApoioRows(data, base, { ...empty, groups: ['g1'], fleetsByGroup: { g1: [] }, query: '4508' }).length, 0, 'restrição vazia continua bloqueando mesmo com busca coincidente');
    assert.equal(filterApoioRows(data, base, empty).length, 5, 'limpar grupos e restrições restaura o conjunto completo');

    const selected = ['g1', 'g2'];
    const restrictions = { g1: ['4508'], g2: ['4509'] };
    const unchanged = reconcileApoioFleetSelection(data, selected, restrictions);
    assert.equal(unchanged.groups, selected, 'auto consulta sem mudança mantém grupos');
    assert.equal(unchanged.fleetsByGroup, restrictions, 'auto consulta sem mudança mantém seleção');
    const registry = { ...data, groups: data.groups.filter(group => group.id !== 'g2'), fleets: data.fleets.map(fleet => fleet.frota === '4508' ? { ...fleet, grupo_id: 'g3' } : fleet) };
    const reconciled = reconcileApoioFleetSelection(registry, selected, restrictions);
    assert.deepEqual(reconciled.groups, ['g1'], 'grupo removido não permanece oculto no filtro');
    assert.deepEqual(reconciled.fleetsByGroup, { g1: [] }, 'frota movida removida do grupo anterior e [] não vira todas');
    assert.equal(filterApoioRows(registry, apoioBaseRows(registry, 'abertas'), { ...empty, groups: reconciled.groups, fleetsByGroup: reconciled.fleetsByGroup }).length, 0, 'nenhuma seleção substituída por frota diferente');

    const controle = fs.readFileSync(path.resolve('src/pages/ControleApoio.tsx'), 'utf8');
    assert.match(controle, /<ApoioGroupFleetFilter/, 'ControleApoio usa o seletor novo');
    assert.match(controle, /fleetsByGroup/, 'ControleApoio mantém restrições por grupo');
    assert.match(controle, /filtersExcel/, 'ControleApoio separa o resumo de frotas do Excel');
    assert.match(controle, /rows,\s*\n\s*filters:/, 'PDF, imagens e WhatsApp continuam recebendo as rows visíveis');
    assert.match(controle, /setFleetsByGroup\(\{\}\)/, 'Limpar filtros remove as restrições de frota');
    console.log('OK: escopo por grupo, igualdade exata, interseção, reconciliação de cadastros e integração de exportação.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
