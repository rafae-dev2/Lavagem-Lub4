import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const temp = await mkdtemp(path.resolve("tests/.tmp-management-performance-"));
const order = (index) => ({
  chave: `${index}::${index}`,
  os: String(index),
  frota: String(index % 100),
  modelo: "Equipamento sintético",
  grupo_fonte: `Fonte ${index % 20}`,
  setor: "Manutenção",
  ponto: `Ponto ${index % 8}`,
  origem: index % 2 ? "Oficina" : "Externo",
  prestador: `Prestador ${index % 5}`,
  status: ["PROGRAMADA", "AGUARDANDO", "EM EXECUÇÃO"][index % 3],
  entrada: `2026-10-${String((index % 28) + 1).padStart(2, "0")}T12:00:00-03:00`,
  previsao: "2026-11-01",
  narrativa: "Revisão preventiva sintética",
  ativo: true,
  primeira_vista: "2026-10-01T12:00:00-03:00",
  ultima_vista: "2026-11-08T10:00:00-03:00",
  ausente_desde: null,
});
const data = {
  groups: Array.from({ length: 20 }, (_, index) => ({ id: `g${index}`, nome: `Grupo ${index}`, cor: "#174d32" })),
  fleets: Array.from({ length: 100 }, (_, index) => ({ frota: String(index), grupo_id: `g${index % 20}`, nome: `Frota ${index}` })),
  orders: Array.from({ length: 1000 }, (_, index) => order(index)),
  sync: null,
  role: "viewer",
};
const now = new Date("2026-11-08T12:00:00-03:00");

try {
  await build({ entryPoints: ["src/lib/managementAnalytics.ts"], outfile: path.join(temp, "managementAnalytics.mjs"), bundle: true, format: "esm", platform: "node", logLevel: "silent" });
  const analytics = await import(pathToFileURL(path.join(temp, "managementAnalytics.mjs")));
  const measure = () => {
    const start = performance.now();
    const rows = analytics.buildBIRows(data, now);
    const model = analytics.buildBIModel(rows, now);
    return { elapsed: performance.now() - start, rows, model };
  };
  measure();
  const samples = Array.from({ length: 7 }, measure).map(result => result.elapsed).sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const result = measure();
  assert.equal(result.rows.length, 1000, "benchmark mantém todas as ordens sintéticas");
  assert.equal(result.model.summary.total, 1000, "modelo mantém o denominador completo");
  assert.ok(Number.isFinite(median) && median >= 0, "benchmark produz tempo mensurável");
  console.log(`BENCH after: 1000 ordens buildBIRows+buildBIModel mediana=${median.toFixed(2)}ms amostras=${samples.map(value => value.toFixed(2)).join(",")}`);
  console.log("Evidência: comparar esta mediana com a medição baseline registrada na entrega; não representa latência de produção.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
