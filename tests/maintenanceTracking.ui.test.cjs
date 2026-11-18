const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-tracking-ui-'));
  const output = path.join(dir, 'interface.cjs');
  const order = (index) => ({
    chave: `23677-os-${index}`, os: `OS-${index}`, frota: '23677',
    modelo: 'Carreta canavieira', grupo_fonte: 'Carretas Canavieiras',
    setor: 'Mecânica', ponto: 'Preventiva mecânica', origem: 'Oficina',
    prestador: 'Oficina Teste', status: index === 0 ? 'Encerrada' : 'Programada',
    entrada: '2026-11-07', previsao: '2026-11-09', narrativa: `PREVENTIVA mecânica ordem ${index}`,
    ativo: index !== 0, primeira_vista: '2026-11-07T08:00:00-03:00',
    ultima_vista: '2026-11-07T20:00:00-03:00', ausente_desde: null,
    classe: 'PREVENTIVA MECANICA', motivo: 'PREVENTIVA MECANICA',
  });
  const data = {
    groups: [{ id: 'g', nome: 'Carretas Canavieiras', cor: '#1f6b45' }],
    fleets: [{ frota: '23677', grupo_id: 'g', nome: 'Carreta canavieira' }],
    orders: Array.from({ length: 26 }, (_, index) => order(index)),
    sync: { id: 1, fonte_atualizada: '2026-11-07T20:00:00-03:00', sincronizado_em: '2026-11-07T20:01:00-03:00', consultado_em: null, total: 26, erro: null }, role: 'viewer',
  };
  try {
    await build({
      entryPoints: [path.join(root, 'src/pages/AcompanhamentoManutencao.tsx')],
      outfile: output, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
      loader: { '.css': 'empty' },
      plugins: [{ name: 'isolated-fixtures', setup(builder) {
        builder.onResolve({ filter: /^react$/ }, () => ({ path: require.resolve('react'), external: true }));
        builder.onLoad({ filter: /useMaintenanceTracking\.ts$/ }, () => ({ loader: 'ts', contents: `export function useMaintenanceTracking(){ return {data:${JSON.stringify(data)},loading:false,refreshing:false,error:'',refresh:async()=>{},clock:new Date('2026-11-07T20:02:00-03:00')}; }` }));
      } }],
    });
    const Component = require(output).default;
    const html = renderToStaticMarkup(React.createElement(Component, { module: 'preventivas' }));
    assert.ok(html.includes('26 ordens selecionadas'), 'Resumo considera todas as ordens');
    assert.equal((html.match(/<article class="mt-order/g) || []).length, 24, 'Página limita 24 cards');
    assert.ok(html.includes('Página 1 de 2'), 'Paginação da seleção completa');
    assert.ok(html.includes('Relatório PDF') && html.includes('Excel'), 'Ambos os relatórios disponíveis');
    assert.ok(html.includes('Filtros de acompanhamento') && html.includes('Buscar ordens'), 'Filtros e busca conectados');
    assert.ok(html.includes('Encerrado') && html.includes('Programado'), 'Status explícitos renderizados');
    assert.ok(html.includes('Oficina Interna') && html.includes('Oficina Teste'), 'Origem e prestador preservados');
    assert.ok(!html.includes('Dashboard Carretas') && !html.includes('Importar Carretas'));
    const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(root, 'src/components/Layout.tsx'), 'utf8');
    for (const route of ['preventivas-canavieiras', 'lubrificacao-canavieiras', 'reformas-apoio']) {
      assert.ok(app.includes(route) && layout.includes(route), `Rota ${route} conectada ao menu`);
    }
    for (const route of ['dashboard-carretas', 'programacoes-carretas', 'importar-carretas', 'exportar-carretas', 'manutencao-equipamentos']) {
      assert.ok(!app.includes(route) && !layout.includes(route), `Rota antiga ${route} removida`);
    }
    assert.ok(!app.includes('useCarretas'), 'Não consulta mais planilha legada');
    assert.ok(app.includes('MAINTENANCE_REFRESH_EVENT'), 'Sincronizar do cabeçalho ligado ao acompanhamento');
    console.log('OK: interface SSR com 26 ordens — 24 cards, paginação, relatórios, filtros, status, origem e novas rotas; sem rede/banco.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
