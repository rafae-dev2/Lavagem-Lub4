'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lavagem-equipment-scope-'));

function loadHelper() {
  const outfile = path.join(TMP, 'lavagemEquipmentScope.cjs');
  buildSync({
    entryPoints: [path.join(ROOT, 'src/lib/lavagemEquipmentScope.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile,
    logLevel: 'silent',
  });
  delete require.cache[require.resolve(outfile)];
  return require(outfile);
}

function schedule(overrides = {}) {
  return {
    id: 'scope-1',
    frota: '99999',
    descricaoPonto: 'LAVADOR',
    tipoPreventiva: 'Lavagem / Lubrificação',
    dataProgramada: '2026-11-04',
    dataRealizada: '',
    situacao: 'PROGRAMADO',
    horarioAgendado: '08:00',
    observacao: '',
    origemRegistro: 'MANUAL',
    ...overrides,
  };
}

function assertHidden(helper, row, message) {
  assert.equal(helper.isHiddenLavagemEquipment(row), true, message);
}

function assertVisible(helper, row, message) {
  assert.equal(helper.isHiddenLavagemEquipment(row), false, message);
}

function main() {
  const helper = loadHelper();
  const {
    isHiddenLavagemEquipment,
    filterLavagemEquipmentSchedules,
    HIDDEN_LAVAGEM_GROUPS,
  } = helper;

  assert.equal(typeof isHiddenLavagemEquipment, 'function');
  assert.equal(typeof filterLavagemEquipmentSchedules, 'function');

  // O aviso de escopo da tela lista todos os grupos ocultos, inclusive a
  // Carreta Tanque Vinhaça.
  assert.ok(
    Array.isArray(HIDDEN_LAVAGEM_GROUPS) && HIDDEN_LAVAGEM_GROUPS.includes('Carreta Tanque Vinhaça'),
    'aviso de grupos ocultos deve listar Carreta Tanque Vinhaça',
  );

  // Os seis grupos ocultos aceitam plural/singular, caixa, acentuação da
  // fonte e os nomes compactos usados no Apoio. Cada combinação vale para
  // uma ordem PCM/manual, aberta/encerrada: o escopo é do equipamento, não
  // do estado ou da origem da ordem.
  const hiddenGroupVariants = [
    {
      label: 'carretas canavieiras',
      names: ['Carretas Canavieiras', 'carreta canavieira', 'CARRETAS CANAVIEIRAS', 'CarretaCanavieira'],
    },
    {
      label: 'tratores de transbordo',
      names: ['Trator Transbordo', 'Tratores de Transbordo', 'TRATORES DE TRANSBORDO', 'TratorTransbordo'],
    },
    {
      label: 'colhedoras de cana safra',
      names: ['Colhedoras', 'Colhedora de Cana Safra', 'COLHEDORAS DE CANA SAFRA', 'Colhedoras de Cana Safra'],
    },
    {
      label: 'carretas rodomuda',
      names: ['Carretas Rodomuda', 'carreta rodomuda', 'CARRETAS RODOMUDA', 'CarretasRodomuda'],
    },
    {
      label: 'dolly canavieiros',
      names: ['Dolly Canavieiros', 'Dolly Canavieiro', 'DOLLY CANAVIEIROS', 'DollyCanavieiros'],
    },
    {
      label: 'carreta tanque vinhaça',
      names: [
        'Carreta Tanque Vinhaça',
        'Carreta tanque Vinhaça',
        'Carretas Tanque Vinhaça',
        'CARRETA TANQUE VINHAÇA',
        'Carreta Tanque de Vinhaça',
        'CarretaTanqueVinhaça',
        'Tanque Vinhaça',
      ],
    },
  ];

  for (const group of hiddenGroupVariants) {
    for (const apoioNome of group.names) {
      for (const origemRegistro of ['PCM', 'MANUAL']) {
        for (const situacao of ['PROGRAMADO', 'ENCERRADO']) {
          assertHidden(
            helper,
            schedule({ apoioNome, origemRegistro, situacao }),
            `${group.label}: ${apoioNome} deve ocultar ${origemRegistro}/${situacao}`,
          );
        }
      }
    }
  }

  // Grupos permitidos não são classificados por semelhança textual nem por
  // status/origem; nomes futuros não conhecidos também permanecem visíveis.
  for (const apoioNome of ['Munck', 'TratorReboque', 'TratoresPesados', 'Cavalo', 'ÁreaVivência', 'Grupo Operacional Novo', 'Caminhão Pipa', 'Tanque Água', 'Carreta Carga Seca']) {
    for (const origemRegistro of ['PCM', 'MANUAL']) {
      for (const situacao of ['PROGRAMADO', 'ENCERRADO']) {
        assertVisible(
          helper,
          schedule({ apoioNome, origemRegistro, situacao }),
          `${apoioNome} deve permanecer visível em ${origemRegistro}/${situacao}`,
        );
      }
    }
  }

  // Sem grupo, somente os três frotas legados exatos do fallback são ocultos:
  // prefixos parecidos não podem virar classificação implícita.
  for (const frota of ['23677', '57839', '30953']) {
    assertHidden(helper, schedule({ frota, apoioNome: undefined }), `frota legada exata ${frota} deve ocultar sem grupo`);
  }
  for (const frota of ['236770', '309530', '578390']) {
    assertVisible(helper, schedule({ frota, apoioNome: undefined }), `prefixo parecido ${frota} deve permanecer visível sem grupo`);
  }

  // O grupo compartilhado é autoridade: uma frota legada de canavieira
  // cadastrada como TratorReboque não deve ser escondida pelo mapa antigo.
  assertVisible(
    helper,
    schedule({ frota: '23677', apoioNome: 'TratorReboque' }),
    'grupo registrado TratorReboque deve vencer o fallback de 23677',
  );

  // Trator Geral não é sinônimo de Transbordo, inclusive para o frota legado
  // 32308 que aparece no mapa estático de trator geral.
  assertVisible(helper, schedule({ frota: '32308', apoioNome: undefined }), '32308 não deve ser convertido em Transbordo');
  assertVisible(helper, schedule({ frota: '32308', apoioNome: 'Trator Geral' }), 'Trator Geral não deve ser convertido em Transbordo');
  assertVisible(helper, schedule({ frota: '32308', apoioNome: 'Trator Pesado' }), 'Trator Pesado não deve ser convertido em Transbordo');

  // Narrativa/observação não definem identidade do equipamento. Menções a uma
  // máquina escondida em texto operacional não devem alterar a visibilidade.
  assertVisible(
    helper,
    schedule({
      frota: 'NARRATIVA-1',
      narrativaPCM: 'OS anterior: Carretas Canavieiras / TratorTransbordo',
      observacao: 'Apoio: Colhedoras de Cana Safra; conferir outra máquina',
      apoioNome: undefined,
    }),
    'narrativa contendo outra máquina não deve classificar a frota',
  );

  // O filtro é puro, mantém a ordem original dos visíveis e deixa o raw intacto
  // (inclusive as ordens ocultadas, que só deixam de aparecer na projeção).
  const rows = [
    schedule({ id: 'raw-1', frota: '23677', apoioNome: undefined, situacao: 'PROGRAMADO' }),
    schedule({ id: 'raw-2', frota: 'keep-1', apoioNome: 'Munck', situacao: 'ENCERRADO' }),
    schedule({ id: 'raw-3', frota: '309530', apoioNome: undefined, situacao: 'PROGRAMADO' }),
    schedule({ id: 'raw-4', frota: '23677', apoioNome: 'TratorReboque', situacao: 'ENCERRADO' }),
    schedule({ id: 'raw-5', frota: 'keep-2', apoioNome: 'ÁreaVivência', situacao: 'PROGRAMADO' }),
    schedule({ id: 'raw-6', frota: '57839', apoioNome: undefined, situacao: 'ENCERRADO' }),
  ];
  const before = structuredClone(rows);
  const filtered = filterLavagemEquipmentSchedules(rows);

  assert.deepEqual(filtered.map(row => row.id), ['raw-2', 'raw-3', 'raw-4', 'raw-5'], 'filtro deve manter somente visíveis na ordem raw');
  assert.deepEqual(rows, before, 'filtro não deve mutar a lista raw nem seus registros');
  assert.equal(rows.length, 6, 'registros ocultos continuam presentes na fonte raw');
  assert.strictEqual(filtered[0], rows[1], 'filtro deve preservar as referências dos registros');
  assert.strictEqual(filtered[2], rows[3], 'filtro deve preservar a referência do override de grupo');

  console.log('OK: escopo de equipamentos — matriz de grupos/origens/status, fallback exato, autoridade Apoio, narrativa inerte, Trator Geral, ordem e não mutação verificados.');
}

try {
  main();
} catch (error) {
  console.error(`FAIL: ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(TMP, { recursive: true, force: true });
}
