const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

(async () => {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maintenance-visibility-ui-'));
  const output = path.join(dir, 'interface.cjs');
  const source = fs.readFileSync(path.join(root, 'src/pages/AcompanhamentoManutencao.tsx'), 'utf8');
  const orders = [
    {
      chave: '23677::OLD-ARCHIVE', os: 'OLD-ARCHIVE', frota: '23677', modelo: 'Carreta canavieira',
      grupo_fonte: 'Carretas Canavieiras', setor: 'Mecânica', ponto: 'Preventiva mecânica', origem: 'Oficina',
      prestador: 'Oficina Teste', status: 'PROGRAMADA', entrada: '2026-11-01T08:00:00-03:00', previsao: '2026-11-03',
      narrativa: 'Preventiva antiga', ativo: false, primeira_vista: '2026-11-01T08:00:00-03:00',
      ultima_vista: '2026-11-03T12:00:00-03:00', ausente_desde: '2026-11-03T15:00:00-03:00',
      classe: 'PREVENTIVA', motivo: 'PREVENTIVA MECANICA',
    },
    {
      chave: '23677::EXACT-CUTOFF', os: 'EXACT-CUTOFF', frota: '23677', modelo: 'Carreta canavieira',
      grupo_fonte: 'Carretas Canavieiras', setor: 'Mecânica', ponto: 'Preventiva mecânica', origem: 'Oficina',
      prestador: 'Oficina Teste', status: 'PROGRAMADA', entrada: '2026-11-05T06:00:00-03:00', previsao: '2026-11-06',
      narrativa: 'Preventiva no corte', ativo: false, primeira_vista: '2026-11-05T05:00:00-03:00',
      ultima_vista: '2026-11-05T06:00:00-03:00', ausente_desde: '2026-11-05T07:10:00-03:00',
      classe: 'PREVENTIVA', motivo: 'PREVENTIVA MECANICA',
    },
    {
      chave: '23677::SOURCE-CLOSED', os: 'SOURCE-CLOSED', frota: '23677', modelo: 'Carreta canavieira',
      grupo_fonte: 'Carretas Canavieiras', setor: 'Mecânica', ponto: 'Preventiva mecânica', origem: 'Oficina',
      prestador: 'Oficina Teste', status: 'ENCERRADA', entrada: '2026-11-05T06:00:00-03:00', previsao: '2026-11-06',
      narrativa: 'Status fonte', ativo: true, primeira_vista: '2026-11-05T05:00:00-03:00',
      ultima_vista: '2026-11-05T07:00:00-03:00', ausente_desde: null,
      classe: 'PREVENTIVA', motivo: 'PREVENTIVA MECANICA',
    },
  ];
  const data = {
    groups: [{ id: 'g', nome: 'Carretas Canavieiras', cor: '#1f6b45' }],
    fleets: [{ frota: '23677', grupo_id: 'g', nome: 'Carreta canavieira' }],
    orders,
    sync: { id: 1, fonte_atualizada: '2026-11-05T12:00:00-03:00', sincronizado_em: '2026-11-05T12:01:00-03:00', consultado_em: null, total: orders.length, erro: null },
    role: 'viewer',
  };
  const storage = new Map();
  global.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  try {
    await build({
      entryPoints: [path.join(root, 'src/pages/AcompanhamentoManutencao.tsx')],
      outfile: output,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      logLevel: 'silent',
      loader: { '.css': 'empty' },
      plugins: [{ name: 'isolated-maintenance-hook', setup(builder) {
        builder.onResolve({ filter: /^react$/ }, () => ({ path: require.resolve('react'), external: true }));
        builder.onLoad({ filter: /useMaintenanceTracking\.ts$/ }, () => ({
          loader: 'ts',
          contents: `export function useMaintenanceTracking(){ return {data:${JSON.stringify(data)},loading:false,refreshing:false,error:'',refresh:async()=>{},clock:new Date('2026-11-05T12:00:00-03:00')}; }`,
        }));
      } }],
    });
    const Component = require(output).default;
    const html = renderToStaticMarkup(React.createElement(Component, { module: 'preventivas' }));
    assert.ok(html.includes('1 encerradas anteriores ao corte das 07:10 estão ocultas'), 'aviso informa o recorte arquivado');
    assert.ok(html.includes('Mostrar encerradas'), 'ação explícita para selecionar o histórico');
    assert.ok(html.includes('EXACT-CUTOFF') && html.includes('SOURCE-CLOSED'), 'recentes e status fonte sem data permanecem visíveis');
    assert.ok(!html.includes('OLD-ARCHIVE'), 'encerrada anterior ao corte fica fora do modo operacional');
    assert.ok(html.includes('ENCERRADA') && html.includes('Status fonte'), 'destaque de encerrada informa a origem');
    assert.ok(html.includes('DETECÇÃO') && html.includes('ÚLTIMA PRESENÇA') && html.includes('Sem atraso'), 'card expõe fatos sem inventar realização');
    assert.ok(source.includes('statusRevealsAllClosed') && source.includes('statusRevealsAllClosed ? base : visibleBase'), 'aba Encerrado desarquiva todas sem prender outras abas');
    assert.ok(source.includes('Visibilidade: ${visibilitySummary}'), 'relatório recebe o filtro de visibilidade');
    console.log('OK: UI SSR — arquivo padrão, ação Mostrar encerradas, card factual e estado Encerrado/operacional.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
