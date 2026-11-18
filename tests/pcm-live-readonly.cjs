// Verificação somente leitura do projeto existente; não cadastra dados de teste.
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const source = fs.readFileSync('src/lib/supabaseClient.ts', 'utf8');
const url = source.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)[1];
const key = source.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/)[1];
const client = createClient(url, key, { auth: { persistSession: false } });
(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await client.rpc('carregar_lavagem_programacoes');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Resposta pública inválida.');
    const automatic = data.filter(row => row.pcm_chave);
    const examples = automatic.filter(row => ['159329765','159330811','159331192'].includes(row.pcm_os));
    console.log('Leitura pública:', data.length, 'registros;', automatic.length, 'automáticos;', examples.length, 'OS dos exemplos.',new Date().toISOString());
    if (examples.length === 3) {
      const { data: review, error: reviewError } = await client.rpc('carregar_pcm_revisao');
      if (reviewError) throw reviewError;
      if (!review || !Array.isArray(review.rows)) throw new Error('Revisão incompleta');
      for (const row of examples) {
        if (row.data_realizada !== null) throw new Error('Foi presumida execução');
        if (row.horario !== '07:00') throw new Error('Horário PCM incorreto');
      }
      const wash = examples.find(row => row.pcm_os === '159329765');
      const oil = examples.find(row => row.pcm_os === '159330811');
      if (wash.data_programada !== '2026-11-01' || wash.tipo !== 'Lavagem / Lubrificação') throw new Error('Lavagem 4508 incorreta');
      if (oil.data_programada !== '2026-11-04' || oil.tipo !== 'Troca de Óleo') throw new Error('Troca de óleo 4508 incorreta');
      const info = { total: data.length, manuais: data.filter(row => !row.pcm_chave).length, automaticas: automatic.length, exemplos: examples, candidatos: review.rows.length, revisao: review.rows.filter(row => row.motivo_revisao && !row.regra.startsWith('ignorar_')).length, sync: review.sync };
      fs.writeFileSync('/home/ubuntu/pcm-verificacao-real.json', JSON.stringify(info, null, 2));
      fs.writeFileSync('/home/ubuntu/pcm-programacoes-reais.json', JSON.stringify(data));
      console.log('OK: três ordens reais corretas e leitura pública compartilhada disponível; nenhuma gravação de teste realizada.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error('A importação não apareceu durante a verificação da próxima consulta.');
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
