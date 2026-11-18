import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const dir = await mkdtemp(path.join(tmpdir(), 'equipment-images-'));
try {
  const out = path.join(dir, 'equipmentImages.cjs');
  await build({
    entryPoints: ['src/lib/equipmentImages.ts'],
    outfile: out,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });
  const require = createRequire(import.meta.url);
  const {
    EQUIPMENT_IMAGES,
    resolveEquipmentImage,
    loadEquipmentImageData,
    preloadEquipmentImages,
  } = require(out);

  const expectedKeys = [
    'leve', 'caminhonete', 'cacamba', 'carga-seca', 'cavalo', 'munck', 'pipa',
    'canavieira', 'rodomuda', 'colhedora', 'prancha', 'trator', 'vivencia',
  ];
  assert.deepEqual(EQUIPMENT_IMAGES.map(({ key }) => key), expectedKeys);
  assert.equal(new Set(EQUIPMENT_IMAGES.map(({ src }) => src)).size, 13);
  for (const image of EQUIPMENT_IMAGES) {
    assert.equal(image.src, `/equipment-types/${image.key}.png`);
    assert.equal(typeof image.label, 'string');
    assert.ok(image.label.length > 0);
  }
  assert.equal(EQUIPMENT_IMAGES.find(({ key }) => key === 'leve').label, 'Veículo leve');

  const key = (input) => resolveEquipmentImage(input)?.key ?? null;

  // Identidades explícitas das 13 imagens, incluindo separadores, acentos e
  // o trator compartilhado por geral/transbordo/reboque.
  const explicitCases = [
    [{ apoio: 'Veículos Leves' }, 'leve'],
    [{ apoio: 'Caminhonetes Geral' }, 'caminhonete'],
    [{ categoria: 'CAMINHÃO CAÇAMBA' }, 'cacamba'],
    [{ categoria: 'CaminhãoCargaSeca' }, 'carga-seca'],
    [{ grupo_fonte: 'Caminhão Cavalo' }, 'cavalo'],
    [{ grupo_fonte: 'Caminhão Munck' }, 'munck'],
    [{ grupo_fonte: 'Caminhão Pipa' }, 'pipa'],
    [{ grupo_fonte: 'Carretas Canavieiras' }, 'canavieira'],
    [{ grupo_fonte: 'Carreta Rodomuda' }, 'rodomuda'],
    [{ grupo_fonte: 'Colhedoras de Cana' }, 'colhedora'],
    [{ group: { nome: 'ReboquePrancha' } }, 'prancha'],
    [{ grupo_fonte: 'Trator Geral' }, 'trator'],
    [{ grupo_fonte: 'Área de Vivência' }, 'vivencia'],
  ];
  for (const [input, expected] of explicitCases) assert.equal(key(input), expected);
  assert.equal(key('Orochi'), 'leve');
  assert.equal(key('pickup'), 'caminhonete');
  assert.equal(key('Trator Transbordo'), 'trator');
  assert.equal(key('Trator Reboque'), 'trator');

  // O mapa padrão é apenas o último recurso e só casa frota exata.
  const fleetCases = [
    ['23677', 'canavieira'], ['57839', 'colhedora'], ['32308', 'trator'],
    ['30953', 'rodomuda'], ['4508', 'munck'], ['4581', 'pipa'],
    ['4571', 'cacamba'], ['4605', 'cavalo'], ['93155', 'prancha'], ['15101', 'vivencia'],
  ];
  for (const [frota, expected] of fleetCases) assert.equal(key({ frota }), expected, frota);
  assert.equal(key({ frota: '309530' }), null, 'mapa não usa prefixo');
  assert.equal(key({ frota: '4591' }), null, 'coleta não tem asset');
  assert.equal(key({ frota: '8825' }), null, 'veículos genérico não tem asset');

  // Cadastro próprio explícito prevalece sobre a fonte; equipamento cadastrado
  // prevalece sobre grupo/modelo da fonte.
  assert.equal(key({ apoio: 'Veículos Leves', grupo_fonte: 'Caminhão Munck', modelo: 'Caminhão Pipa' }), 'leve');
  assert.equal(key({ apoio: 'Apoio Geral', equipamento: 'Caminhão Pipa', grupo_fonte: 'Caminhão Munck' }), 'pipa');
  assert.equal(key({ apoioNome: 'Apoio Geral', nome: 'Caminhonete', grupo_fonte: 'Caminhão Munck' }), 'caminhonete');

  // Genéricos não escolhem subtipo e identidades conflitantes não recebem
  // imagem arbitrária. Coleta também não pode ser substituída pelo mapa.
  for (const value of ['Apoio', 'Caminhão', 'Veículos', 'Caminhão Coleta']) assert.equal(key(value), null, value);
  assert.equal(key('Caminhão Munck e Caminhão Pipa'), null);
  assert.equal(key({ frota: '4508', grupo_fonte: 'Caminhão Coleta' }), null);
  assert.equal(key({frota:'4508',apoio:'Coleta',grupo_fonte:'Caminhão Munck'}),null,'grupo Coleta bloqueia modelo/frota divergentes');
  assert.equal(key({equipamento:'Coleta',modelo:'Caminhão Pipa'}),null,'identidade sem imagem não é substituída pela fonte');
  assert.equal(key({grupo_fonte:'Coleta',modelo:'Caminhão Munck'}),null,'fonte sem imagem não mistura outra ilustração');
  assert.equal(key({ frota: '30953', grupo_fonte: 'Caminhão Cavalo' }), null, 'fonte contradiz frota conhecida');

  // Campos operacionais nunca viram identidade; a narrativa sozinha não cria
  // imagem e não altera o resultado conservador.
  assert.equal(key({ narrativa: 'Caminhão Munck', motivo: 'Pipa', ponto: 'Colhedora', setor: 'Trator' }), null);
  assert.equal(key({ frota: '4508', narrativa: 'Caminhão Pipa', motivo: 'Colhedora' }), 'munck');
  assert.equal(key({ modelo: 'Equipamento', narrativa: 'Caminhão Pipa' }), null);

  // Import e helpers são seguros em Node, sem DOM nem renderer.
  assert.equal(await loadEquipmentImageData('Caminhão Munck'), null);
  const preloaded = await preloadEquipmentImages([{ grupo_fonte: 'Caminhão Munck' }, { frota: '4508' }]);
  assert.ok(preloaded instanceof Map);
  assert.equal(preloaded.size, 0);

  console.log('OK: catálogo, 13 identidades, precedência, conflitos, mapa conservador e guardas browser-only.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
