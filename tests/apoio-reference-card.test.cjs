const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { build } = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

(async () => {
  const root = path.resolve(__dirname, "..");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-apoio-reference-card-"));
  const output = path.join(dir, "card.cjs");
  const narrative =
    "NARRATIVA COMPLETA: inspeção do conjunto hidráulico, troca do componente e teste operacional final.";
  const base = {
    frota: "AP-101",
    modelo: "Equipamento de apoio",
    grupo_fonte: "Grupo Apoio",
    setor: "Manutenção",
    ponto: "Pátio principal",
    origem: "Oficina",
    prestador: "Oficina de teste",
    entrada: "2026-11-01",
    primeira_vista: "2026-11-01T08:00:00-03:00",
    ultima_vista: "2026-11-08T08:00:00-03:00",
    ausente_desde: null,
    classe: "MANUTENÇÃO",
    motivo: "CORRETIVA",
    apoio: "Grupo Apoio",
    equipamento: "Equipamento de apoio",
  };
  const closed = {
    ...base,
    chave: "apoio-closed",
    os: "OS-CLOSED",
    status: "Encerrada",
    ativo: true,
    previsao: "2026-11-07",
    narrativa: narrative,
  };
  const late = {
    ...base,
    chave: "apoio-late",
    os: "OS-LATE",
    status: "Em andamento",
    ativo: true,
    previsao: "2026-11-07",
    narrativa: `${narrative} Ordem ainda em acompanhamento e com previsão vencida.`,
  };
  const clock = new Date("2026-11-08T12:00:00-03:00");
  const groups = [{ id: "grupo-1", nome: "Grupo Apoio", cor: "#1f6b45" }];

  try {
    await build({
      entryPoints: [path.join(root, "src/components/ApoioOrderCard.tsx")],
      outfile: output,
      bundle: true,
      platform: "node",
      format: "cjs",
      logLevel: "silent",
      external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime"],
      loader: { ".ts": "ts", ".tsx": "tsx" },
      plugins: [{
        name: "resolve-react-from-project",
        setup(builder) {
          for (const dependency of ["react", "react/jsx-runtime", "react/jsx-dev-runtime"]) {
            builder.onResolve({ filter: new RegExp(`^${dependency.replace("/", "\\/")}$`) }, () => ({
              path: require.resolve(dependency),
              external: true,
            }));
          }
        },
      }],
    });

    const Card = require(output).default;
    const props = {
      groups,
      groupId: "",
      busy: false,
      clock,
      onToggle: () => {},
      onAssign: () => {},
    };
    const closedHtml = renderToStaticMarkup(
      React.createElement(Card, { ...props, order: closed, expanded: false }),
    );
    const lateHtml = renderToStaticMarkup(
      React.createElement(Card, { ...props, order: late, expanded: true }),
    );

    assert.match(closedHtml, /class="mt-order[^" ]*\s+mt-order--closed/);
    assert.doesNotMatch(closedHtml, /mt-order--late/);
    assert.match(closedHtml, /ENCERRADA/);
    assert.match(closedHtml, /Status fonte/);
    assert.match(lateHtml, /class="mt-order[^" ]*\s+mt-order--late/);
    assert.match(lateHtml, /Previsão vencida/);
    assert.match(lateHtml, /mt-quadrants/);
    assert.match(lateHtml, /mt-status/);
    assert.match(lateHtml, /mt-days/);

    const observationsStart = lateHtml.indexOf('class="mt-observations"');
    const selectStart = lateHtml.indexOf('aria-label="Grupo Apoio da frota AP-101"');
    const footerStart = lateHtml.indexOf('class="mt-order-bottom"');
    assert.ok(observationsStart >= 0 && selectStart > observationsStart, "Grupo Apoio fica dentro dos detalhes");
    assert.ok(footerStart >= 0 && selectStart > footerStart, "Grupo Apoio não aumenta o footer do card");
    assert.match(lateHtml, /<select[^>]*aria-label="Grupo Apoio da frota AP-101"/);
    assert.match(lateHtml, />Grupo Apoio<\/option>/);
    assert.doesNotMatch(lateHtml, /apoio-order|apoio-card-|apoio-narrative/);

    assert.ok((lateHtml.match(new RegExp(narrative, "g")) || []).length >= 2, "Narrativa completa aparece no resumo e no histórico");
    assert.match(closedHtml, /Narrativa completa/);
    assert.match(closedHtml, new RegExp(narrative));

    const source = fs.readFileSync(path.join(root, "src/components/ApoioOrderCard.tsx"), "utf8");
    for (const token of ["onAssign", "onToggle", "groups", "busy", "expanded", "clock", "extraDetails"]) {
      assert.ok(source.includes(token), `Prop/callback preservado: ${token}`);
    }
    assert.match(source, /classificationReason:\s*registered\s*\?\s*["']Frota no controle Apoio["']/);
    assert.match(source, /getMaintenanceOrderClosure/);
    assert.match(source, /apoioForecastOverdue/);

    console.log("OK: cartão Apoio SSR usa a estrutura mt compartilhada; grupo em detalhes; encerrada/atrasada, callbacks e narrativas completas validados.");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
