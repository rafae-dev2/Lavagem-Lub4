// src/lib/maintenanceTrackingReport.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// src/lib/frotaCategorias.ts
var CATEGORIAS_PADRAO = [
  {
    id: "carretas_canavieiras",
    categoria: "CARRETAS CANAVIEIRAS",
    imagem: "/equipamentos/carretas_canavieiras.png",
    subtitulo: "TRANSPORTE DE CANA",
    frotas: [
      "23677",
      "23676",
      "23675",
      "23674",
      "23673",
      "23672",
      "23671",
      "23670",
      "23669",
      "23668",
      "23667",
      "23666",
      "23665",
      "23664",
      "23663",
      "23662",
      "23661",
      "23660",
      "23659",
      "23658",
      "23657",
      "23656",
      "23655",
      "23654",
      "23653",
      "23652",
      "23651",
      "23650",
      "23649",
      "23648",
      "23647",
      "23646",
      "23645",
      "23644",
      "23643",
      "23642",
      "23641",
      "23637",
      "23636",
      "23635",
      "23634",
      "23633",
      "23632",
      "23631",
      "23630",
      "23629",
      "23628",
      "23627",
      "23626",
      "23616",
      "23610",
      "23607",
      "23604",
      "23603",
      "23602",
      "23601",
      "23600",
      "22067",
      "22066",
      "22065",
      "22064",
      "22063",
      "22062",
      "22061",
      "22060",
      "22059",
      "22058",
      "22057",
      "22056",
      "22055",
      "22054",
      "22053",
      "22052",
      "22051",
      "22050",
      "22049",
      "22048",
      "22047",
      "22046",
      "22045",
      "22044",
      "22043",
      "22042",
      "22041",
      "22040",
      "22039",
      "22038",
      "22037",
      "22036",
      "22035",
      "22034",
      "22033",
      "22032",
      "22031",
      "22030",
      "22029",
      "22028",
      "22027",
      "22026",
      "22025",
      "22024",
      "22023",
      "22022",
      "22021",
      "22020",
      "22019",
      "22017",
      "22012",
      "22011",
      "22003",
      "22001"
    ],
    cor: "#F97316",
    icone: "\u{1F69C}"
  },
  {
    id: "colhedoras_cana",
    categoria: "COLHEDORAS DE CANA",
    imagem: "/equipamentos/colhedoras_cana.png",
    subtitulo: "COLHEITA MECANIZADA",
    frotas: [
      "57839",
      "57838",
      "57837",
      "57836",
      "57835",
      "57834",
      "57833",
      "57832",
      "57831",
      "57830",
      "57829",
      "57827"
    ],
    cor: "#10B981",
    icone: "\u{1F33E}"
  },
  {
    id: "trator_geral",
    categoria: "TRATOR GERAL",
    imagem: "/equipamentos/trator_geral.png",
    subtitulo: "TERRAPLANAGEM E APOIO",
    frotas: [
      "32308",
      "32307",
      "32306",
      "32305",
      "32304",
      "32303",
      "32302",
      "32299",
      "32298",
      "32297",
      "32296",
      "32295",
      "32294",
      "32293",
      "32292",
      "32291",
      "32290",
      "32289",
      "32288",
      "32287",
      "32286",
      "32285",
      "32284",
      "32283",
      "32282",
      "32280",
      "32279",
      "32278",
      "32277",
      "32276",
      "32275",
      "32274",
      "32273",
      "32272",
      "32271",
      "32270",
      "32269",
      "32268",
      "32267",
      "32263",
      "32262",
      "32256",
      "32255",
      "32254",
      "32253",
      "32251",
      "32250",
      "32249",
      "32248",
      "32246",
      "32245",
      "32244",
      "32243",
      "32242",
      "32240",
      "32239",
      "32238",
      "32237",
      "32236",
      "32234",
      "32233",
      "32232",
      "32231",
      "32230",
      "32229",
      "32228",
      "32227",
      "32225",
      "32224",
      "32210",
      "32209"
    ],
    cor: "#3B82F6",
    icone: "\u{1F69C}"
  },
  {
    id: "carretas_rodomuda",
    categoria: "CARRETAS RODOMUDA",
    imagem: "/equipamentos/carretas_rodomuda.png",
    subtitulo: "TRANSPORTE RODOVIARIO",
    frotas: [
      "30953",
      "30952",
      "30951",
      "30950",
      "30949",
      "30948",
      "30947",
      "30946",
      "30945",
      "30944",
      "30943",
      "30942",
      "30941",
      "30940",
      "30939",
      "30938",
      "30937",
      "30936",
      "30935",
      "30934",
      "30933",
      "30932"
    ],
    cor: "#8B5CF6",
    icone: "\u{1F69B}"
  },
  {
    id: "munck",
    categoria: "CAMINH\xC3O MUNCK",
    imagem: "/equipamentos/munck.png",
    subtitulo: "ICAMENTO E CARGAS",
    frotas: ["4568", "4569", "4582", "4585", "4614", "4583", "4588", "4508", "4509"],
    cor: "#FF6B6B",
    icone: "\u{1F3D7}\uFE0F"
  },
  {
    id: "pipa",
    categoria: "CAMINH\xC3O PIPA",
    imagem: "/equipamentos/pipa.png",
    subtitulo: "AGUA E TRANSPORTE",
    frotas: ["4581", "4574", "4627", "4624", "4575", "4628", "4625", "4576", "4594", "4626", "4579", "4584", "4580", "4570"],
    cor: "#4ECDC4",
    icone: "\u{1F4A7}"
  },
  {
    id: "cacambas",
    categoria: "CAMINH\xC3O CA\xC7AMBAS",
    imagem: "/equipamentos/cacambas.png",
    subtitulo: "MOVIMENTACAO DE TERRA",
    frotas: ["4571", "4587", "4566", "4620", "4567", "4621"],
    cor: "#FFE66D",
    icone: "\u{1F69A}"
  },
  {
    id: "cavalo",
    categoria: "CAMINH\xC3O CAVALO",
    imagem: "/equipamentos/cavalo.png",
    subtitulo: "TRACAO E REBOQUE",
    frotas: ["4605", "4601", "4611", "4615", "4619", "4608", "4616", "4609", "4617", "4610", "4618"],
    cor: "#95E1D3",
    icone: "\u{1F69B}"
  },
  {
    id: "coleta",
    categoria: "CAMINH\xC3O COLETA",
    imagem: "/equipamentos/coleta.png",
    subtitulo: "COLETA E RESIDUOS",
    frotas: ["4591", "4597", "4604", "6597", "6598", "6607"],
    cor: "#F38181",
    icone: "\u{1F5D1}\uFE0F"
  },
  {
    id: "veiculos",
    categoria: "VE\xCDCULOS",
    imagem: "/equipamentos/veiculos.png",
    subtitulo: "APOIO E LOGISTICA",
    frotas: ["8825", "8826", "8827", "8828", "8829", "8830", "8831", "8832", "8833", "6595", "6596", "6592", "6601", "8846", "8847", "8848", "8849", "8800", "8801", "8775", "8803", "8802", "6603"],
    cor: "#AA96DA",
    icone: "\u{1F697}"
  },
  {
    id: "pranchas",
    categoria: "PRANCHAS IMPLEMENTO",
    imagem: "/equipamentos/pranchas.png",
    subtitulo: "TRANSPORTE PESADO",
    frotas: ["93155", "93156", "93157"],
    cor: "#FCBAD3",
    icone: "\u{1F4E6}"
  },
  {
    id: "vivencia",
    categoria: "\xC1REA DE VIV\xCANCIA",
    imagem: "/equipamentos/vivencia.png",
    subtitulo: "ALOJAMENTO E APOIO",
    frotas: ["15101", "15102", "15103", "15104", "15105", "15106", "15107", "15108", "15109", "15110", "15111", "15112", "15114", "15115", "15116", "15117", "15118", "15119"],
    cor: "#A8D8EA",
    icone: "\u{1F3E0}"
  }
];

// src/types/apoio.ts
function oficinaLabel(origem) {
  const value = origem.trim().toLocaleLowerCase("pt-BR");
  if (["oficina", "interno", "interna", "oficina interna"].includes(value)) return "Oficina Interna";
  if (["terceiro", "externo", "externa", "oficina externa"].includes(value)) return "Oficina Externa";
  if (value === "campo") return "Campo";
  return origem || "Origem n\xE3o informada";
}

// src/lib/maintenanceTracking.ts
var TRACKING_TITLES = {
  preventivas: "Preventivas Carretas Canavieiras",
  lubrificacao: "Lubrifica\xE7\xE3o Carretas Canavieiras",
  reformas: "Reformas Equipamentos Apoio"
};
var CANAVIEIRA_CATEGORY_ID = "carretas_canavieiras";
var CANAVIEIRA_FLEETS = new Set(
  (CATEGORIAS_PADRAO.find((category) => category.id === CANAVIEIRA_CATEGORY_ID)?.frotas || []).map((fleet) => fleet.trim()).filter(Boolean)
);
function text(value, fallback = "") {
  if (value === null || value === void 0) return fallback;
  const result = String(value).trim();
  return result || fallback;
}
function fold(value) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
var EXPLICIT_CLOSED_STATUSES = /* @__PURE__ */ new Set([
  "encerrado",
  "encerrada",
  "concluido",
  "concluida",
  "realizado",
  "realizada",
  "fechado",
  "fechada"
]);
var PROGRAMMED_STATUSES = /* @__PURE__ */ new Set([
  "programado",
  "programada",
  "agendado",
  "agendada"
]);
function isExplicitClosedStatus(value) {
  return EXPLICIT_CLOSED_STATUSES.has(fold(value));
}
function isProgrammedStatus(value) {
  return PROGRAMMED_STATUSES.has(fold(value));
}
var OPERATIONAL_TIME_ZONE = "America/Sao_Paulo";
var OPERATIONAL_OFFSET_MS = 3 * 60 * 60 * 1e3;
function validCalendarDate(year, month, day) {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function dateKey(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function brazilDateKey(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(timestamp));
  const values = {};
  for (const part of parts)
    if (part.type !== "literal") values[part.type] = part.value;
  if (!values.year || !values.month || !values.day) return null;
  return `${values.year}-${values.month}-${values.day}`;
}
function operationalTimestamp(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  return Date.UTC(year, month - 1, day, hour, minute, second, millisecond) + OPERATIONAL_OFFSET_MS;
}
function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    raw
  );
  if (dmy) {
    const day2 = Number(dmy[1]);
    const month2 = Number(dmy[2]);
    const year2 = Number(dmy[3]);
    const hour2 = Number(dmy[4] || 0);
    const minute2 = Number(dmy[5] || 0);
    const second2 = Number(dmy[6] || 0);
    if (!validCalendarDate(year2, month2, day2) || hour2 > 23 || minute2 > 59 || second2 > 59)
      return null;
    const timestamp2 = operationalTimestamp(
      year2,
      month2,
      day2,
      hour2,
      minute2,
      second2
    );
    return {
      timestamp: timestamp2,
      dateOnly: !dmy[4],
      dateKey: brazilDateKey(timestamp2) || dateKey(year2, month2, day2)
    };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(
    raw
  );
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  const hasTime = iso[4] !== void 0;
  const hour = Number(iso[4] || 0);
  const minute = Number(iso[5] || 0);
  const second = Number(iso[6] || 0);
  if (!validCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59)
    return null;
  if (iso[8] && iso[8] !== "Z") {
    const zone = /[+-](\d{2}):?(\d{2})$/.exec(iso[8]);
    if (!zone || Number(zone[1]) > 23 || Number(zone[2]) > 59) return null;
  }
  const fraction = iso[7] ? Number((iso[7] + "000").slice(0, 3)) : 0;
  const timestamp = iso[8] ? Date.parse(
    raw.includes(" ") && !raw.includes("T") ? raw.replace(" ", "T") : raw
  ) : operationalTimestamp(year, month, day, hour, minute, second, fraction);
  if (!Number.isFinite(timestamp)) return null;
  const operationalKey = brazilDateKey(timestamp);
  if (!operationalKey) return null;
  return {
    timestamp,
    dateOnly: !hasTime,
    dateKey: operationalKey
  };
}
function absenceProof(order) {
  if (order.ativo !== false) return null;
  const firstSeen = parseDate(order.primeira_vista);
  const lastSeen = parseDate(order.ultima_vista);
  const detected = parseDate(order.ausente_desde);
  if (!firstSeen || !lastSeen || !detected) return null;
  return detected;
}
function statusLabel(status) {
  switch (status) {
    case "programado":
      return "Programado";
    case "andamento":
      return "Em andamento";
    case "encerrado":
      return "Encerrado";
    case "ausente":
      return "Ausente da fonte";
    case "outros":
      return "Outros";
  }
}
function trackingClosureOrigin(row) {
  if (isExplicitClosedStatus(row.status)) return "fonte";
  if (row.ativo === true && isProgrammedStatus(row.status)) return null;
  if (row.trackingStatus === "encerrado" && (row.closureOrigin === "fonte" || row.closureOrigin === "ausencia"))
    return row.closureOrigin;
  return absenceProof(row) ? "ausencia" : null;
}
function trackingClosedAt(row) {
  const origin = trackingClosureOrigin(row);
  if (!origin) return null;
  const explicit = text(row.closedDetectedAt);
  if (explicit && parseDate(explicit)) return explicit;
  if (!absenceProof(row)) return null;
  const detected = text(row.ausente_desde);
  return detected && parseDate(detected) ? detected : null;
}
function trackingClosureLabel(row) {
  const origin = trackingClosureOrigin(row);
  if (origin === "ausencia") return "Encerrado (por sa\xEDda da fonte)";
  if (origin === "fonte") return "Encerrado (status da fonte)";
  return statusLabel(row.trackingStatus);
}
function getTrackingCounts(rows) {
  const counts = {
    total: Array.isArray(rows) ? rows.length : 0,
    programado: 0,
    andamento: 0,
    encerrado: 0,
    ausente: 0,
    outros: 0,
    atrasado: 0,
    frotas: 0
  };
  const fleets = /* @__PURE__ */ new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.trackingStatus in counts) {
      counts[row.trackingStatus] += 1;
    } else {
      counts.outros += 1;
    }
    if (row.overdue) counts.atrasado += 1;
    const fleet = fold(row.frota);
    if (fleet && fleet !== "sem frota") fleets.add(fleet);
  }
  counts.frotas = fleets.size;
  return counts;
}

// src/lib/maintenanceTrackingReport.ts
var COLORS = {
  darkGreen: [20, 72, 47],
  green: [31, 107, 69],
  gold: [193, 145, 47],
  goldLight: [250, 244, 224],
  greenLight: [232, 244, 236],
  glass: [248, 252, 249],
  border: [196, 220, 202],
  line: [201, 218, 205],
  ink: [24, 52, 37],
  muted: [72, 101, 84],
  white: [255, 255, 255],
  warning: [126, 76, 0],
  warningFill: [255, 248, 225],
  absence: [126, 42, 42],
  absenceFill: [252, 237, 237]
};
var MARGIN_X = 6;
var FOOTER_H = 13;
var COMPACT_HEADER_H = 20;
var CONTENT_W = 285;
var TABLE_WIDTHS = [42, 45, 31, 34, 25, 25, 83];
var REPORT_TIME_ZONE = "America/Sao_Paulo";
function text2(value, fallback = "") {
  if (value === null || value === void 0) return fallback;
  const result = String(value).trim();
  return result || fallback;
}
function localIsoDate(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = {};
  for (const part of parts)
    if (part.type !== "literal") values[part.type] = part.value;
  return `${values.year || "1970"}-${values.month || "01"}-${values.day || "01"}`;
}
function safeFilenamePart(value, fallback) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLocaleLowerCase("en-US");
  return normalized.slice(0, 70) || fallback;
}
function filename(extension, options, now = /* @__PURE__ */ new Date()) {
  const module = safeFilenamePart(
    TRACKING_TITLES[options.module] || options.module,
    "manutencao"
  );
  return `gestao-ordens-manutencao-${module}-${localIsoDate(now)}.${extension}`;
}
function setText(doc, color, size, style = "normal") {
  doc.setTextColor(...color);
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
}
function formatDate(value, withTime = true) {
  const raw = text2(value);
  if (!raw) return "\u2014";
  const parsed = parseDate(raw);
  if (!parsed) return `Data inconsistente (${raw})`;
  const date = new Date(parsed.timestamp);
  const options = parsed.dateOnly || !withTime ? {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  } : {
    timeZone: REPORT_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  };
  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}
function sourceTime(value) {
  return text2(value) ? formatDate(value, true) : "N\xE3o informado";
}
function displayStatus(row) {
  const parts = [trackingClosureLabel(row)];
  if (row.overdue) parts.push("Atrasado");
  const closureOrigin = trackingClosureOrigin(row);
  const closedAt = trackingClosedAt(row);
  if (closureOrigin === "ausencia") {
    parts.push("origem: ausencia");
    if (closedAt) parts.push(`detec\xE7\xE3o: ${formatDate(closedAt, true)}`);
  } else if (closureOrigin === "fonte") {
    parts.push("origem: fonte");
    if (!row.ativo && closedAt)
      parts.push(`sa\xEDda detectada: ${formatDate(closedAt, true)}`);
  } else if (!row.ativo) {
    parts.push("Ausente da fonte; status n\xE3o conclusivo");
  }
  if (text2(row.status) && text2(row.status).toLocaleLowerCase("pt-BR") !== trackingClosureLabel(row).toLocaleLowerCase("pt-BR")) {
    parts.push(`Fonte: ${text2(row.status)}`);
  }
  return parts.join(" \xB7 ");
}
function providerAndLocation(row) {
  const location = oficinaLabel(text2(row.origem));
  const provider = text2(row.prestador);
  return provider ? `${location} / ${provider}` : location;
}
function warningLines(options, logoWarning) {
  const warnings = [
    "Encerramento operacional por sa\xEDda da fonte; data detectada n\xE3o confirma execu\xE7\xE3o real."
  ];
  if (text2(options.sourceError)) {
    const sourceError = text2(options.sourceError);
    warnings.push(
      `Atualiza\xE7\xE3o da fonte pendente: ${sourceError.slice(0, 420)}${sourceError.length > 420 ? "\u2026" : ""}. Consulte o aplicativo antes de decidir.`
    );
  }
  if (logoWarning) warnings.push(`Logotipo n\xE3o carregado: ${logoWarning}`);
  return warnings;
}
function compactFilterSummary(filters) {
  if (!filters.length) return "Sem filtros informados";
  const visible = filters.slice(0, 8).map((filter) => {
    const value = text2(filter, "Filtro sem r\xF3tulo");
    return value.length > 150 ? `${value.slice(0, 150)}\u2026` : value;
  });
  if (filters.length > visible.length)
    visible.push(`+${filters.length - visible.length} filtro(s) no Excel`);
  return visible.join(" \xB7 ");
}
function drawFooter(doc, page, total) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...COLORS.white);
  doc.rect(0, pageH - FOOTER_H, pageW, FOOTER_H, "F");
  doc.setDrawColor(...COLORS.green);
  doc.setLineWidth(0.35);
  doc.line(MARGIN_X, pageH - FOOTER_H, pageW - MARGIN_X, pageH - FOOTER_H);
  setText(doc, COLORS.green, 7.1, "bold");
  doc.text("BRANCO PERES AGRO", MARGIN_X, pageH - 4.3);
  setText(doc, COLORS.muted, 6.9);
  doc.text("Gest\xE3o de Ordens de Manuten\xE7\xE3o", pageW / 2, pageH - 4.3, {
    align: "center"
  });
  doc.text(`P\xE1gina ${page}/${total}`, pageW - MARGIN_X, pageH - 4.3, {
    align: "right"
  });
}
function drawCompactHeader(doc, moduleTitle) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageW, COMPACT_HEADER_H, "F");
  doc.setFillColor(...COLORS.green);
  doc.rect(0, 0, 2.2, COMPACT_HEADER_H, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(2.2, COMPACT_HEADER_H - 1.1, pageW - 2.2, 1.1, "F");
  setText(doc, COLORS.white, 9.1, "bold");
  doc.text("BRANCO PERES AGRO", 7, 8.1);
  setText(doc, [218, 239, 225], 8.1);
  doc.text(moduleTitle, 7, 15.2);
  setText(doc, [210, 247, 220], 6.8, "bold");
  doc.text("CONTINUA\xC7\xC3O", pageW - MARGIN_X, 8.1, { align: "right" });
}
async function loadLogo() {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof Image === "undefined") {
    return {
      dataUrl: null,
      warning: "ambiente do navegador indispon\xEDvel para /logo.png"
    };
  }
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const timer = window.setTimeout(
      () => finish({
        dataUrl: null,
        warning: "tempo limite ao carregar /logo.png"
      }),
      5e3
    );
    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) {
          finish({
            dataUrl: null,
            warning: "canvas indispon\xEDvel para converter /logo.png"
          });
          return;
        }
        context.drawImage(image, 0, 0);
        finish({ dataUrl: canvas.toDataURL("image/png"), warning: null });
      } catch {
        finish({
          dataUrl: null,
          warning: "n\xE3o foi poss\xEDvel converter /logo.png para o PDF"
        });
      }
    };
    image.onerror = () => finish({
      dataUrl: null,
      warning: "arquivo /logo.png n\xE3o p\xF4de ser carregado"
    });
    image.src = "/logo.png";
  });
}
function drawMetricBoxes(doc, counts, y) {
  const entries = [
    ["Total", counts.total],
    ["Programado", counts.programado],
    ["Andamento", counts.andamento],
    ["Encerrado", counts.encerrado],
    ["Ausente", counts.ausente],
    ["Outros", counts.outros],
    ["Atrasado", counts.atrasado],
    ["Frotas", counts.frotas]
  ];
  const gap = 1.8;
  const boxW = (CONTENT_W - gap * (entries.length - 1)) / entries.length;
  const boxH = 16;
  entries.forEach(([label, value], index) => {
    const x = MARGIN_X + index * (boxW + gap);
    doc.setFillColor(...index === 0 ? COLORS.greenLight : COLORS.glass);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, boxW, boxH, 1.2, 1.2, "FD");
    setText(doc, COLORS.green, 10.4, "bold");
    doc.text(String(value), x + boxW / 2, y + 7, { align: "center" });
    setText(doc, COLORS.muted, 5.3, "bold");
    doc.text(label, x + boxW / 2, y + 12.5, { align: "center" });
  });
  return y + boxH;
}
function drawFirstPageHeader(doc, options, rows, counts, logo, generatedAt) {
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN_X * 2;
  doc.setFillColor(...COLORS.darkGreen);
  doc.rect(0, 0, pageW, 38, "F");
  doc.setFillColor(...COLORS.green);
  doc.rect(0, 0, 2.2, 38, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(2.2, 36.6, pageW - 2.2, 1.4, "F");
  let left = 8;
  if (logo.dataUrl) {
    doc.addImage(logo.dataUrl, "PNG", 8, 5, 19, 19);
    left = 31;
  }
  setText(doc, COLORS.white, 11.3, "bold");
  doc.text("BRANCO PERES AGRO", left, 12);
  setText(doc, [224, 241, 229], 7.3);
  doc.text("Gest\xE3o de Ordens de Manuten\xE7\xE3o", left, 19);
  setText(doc, [211, 255, 224], 13.1, "bold");
  doc.text(TRACKING_TITLES[options.module], left, 32);
  setText(doc, COLORS.white, 7.6, "bold");
  doc.text("RELAT\xD3RIO", pageW - MARGIN_X, 11, { align: "right" });
  setText(doc, [228, 239, 233], 6.8);
  doc.text(
    `Gerado em ${formatDate(generatedAt.toISOString(), true)}`,
    pageW - MARGIN_X,
    18,
    { align: "right" }
  );
  doc.text(
    `${rows.length} ${rows.length === 1 ? "ordem" : "ordens"}`,
    pageW - MARGIN_X,
    25,
    { align: "right" }
  );
  let y = 44;
  setText(doc, COLORS.green, 8.8, "bold");
  doc.text("Resumo operacional", MARGIN_X, y);
  y += 4.5;
  setText(doc, COLORS.muted, 6.9);
  doc.text(
    `Fonte atualizada: ${sourceTime(options.sourceUpdated)}`,
    MARGIN_X,
    y
  );
  doc.text(
    `\xDAltima sincroniza\xE7\xE3o: ${sourceTime(options.lastSynced)}`,
    pageW - MARGIN_X,
    y,
    { align: "right" }
  );
  y += 5;
  setText(doc, COLORS.muted, 6.6);
  const filterText = `Filtros: ${compactFilterSummary(options.filters)}`;
  const filterLines = doc.splitTextToSize(filterText, contentW);
  doc.text(filterLines, MARGIN_X, y);
  y += Math.max(5, filterLines.length * 3.1) + 2;
  const warnings = warningLines(options, logo.warning);
  const warningText = warnings.join(" ");
  const warningLinesWrapped = doc.splitTextToSize(warningText, contentW - 7);
  const warningH = Math.max(10, warningLinesWrapped.length * 3.1 + 5);
  doc.setFillColor(...COLORS.warningFill);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_X, y, contentW, warningH, 1.2, 1.2, "FD");
  setText(doc, COLORS.warning, 6.7, "bold");
  doc.text(warningLinesWrapped, MARGIN_X + 3, y + 4.1);
  y += warningH + 4;
  y = drawMetricBoxes(doc, counts, y);
  return y + 5;
}
function pdfRow(row) {
  const equipmentGroup = [
    text2(row.equipamento, "Equipamento n\xE3o informado"),
    text2(row.apoio, "Apoio n\xE3o informado"),
    text2(row.grupo_fonte) && text2(row.grupo_fonte) !== text2(row.apoio) ? `Fonte: ${text2(row.grupo_fonte)}` : ""
  ].filter(Boolean).join("\n");
  const service = [
    `Narrativa: ${text2(row.narrativa, "N\xE3o informada")}`,
    `Motivo: ${text2(row.motivo, "N\xE3o informado")}`,
    `Classe: ${text2(row.classe, "N\xE3o informada")}`,
    `Crit\xE9rio: ${text2(row.classificationReason, "N\xE3o informado")}`
  ].join("\n");
  return [
    `${text2(row.frota, "Sem frota informada")}
OS ${text2(row.os, "\u2014")}`,
    equipmentGroup,
    displayStatus(row),
    providerAndLocation(row),
    formatDate(row.entrada, true),
    formatDate(row.previsao, true),
    service
  ];
}
function drawFinalFooters(doc) {
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawFooter(doc, page, total);
  }
}
async function buildTrackingPdf(options) {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const counts = getTrackingCounts(rows);
  const generatedAt = /* @__PURE__ */ new Date();
  const logo = await loadLogo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  let startY = drawFirstPageHeader(
    doc,
    options,
    rows,
    counts,
    logo,
    generatedAt
  );
  if (startY > pageH - FOOTER_H - 27) {
    doc.addPage();
    drawCompactHeader(doc, TRACKING_TITLES[options.module]);
    startY = COMPACT_HEADER_H + 4;
  }
  autoTable(doc, {
    startY,
    margin: {
      left: MARGIN_X,
      right: MARGIN_X,
      top: COMPACT_HEADER_H + 3,
      bottom: FOOTER_H + 1
    },
    tableWidth: CONTENT_W,
    theme: "grid",
    pageBreak: "auto",
    rowPageBreak: "avoid",
    showHead: "everyPage",
    head: [
      [
        "Frota / OS",
        "Equipamento / grupo",
        "Situa\xE7\xE3o",
        "Local / prestador",
        "Entrada",
        "Previs\xE3o",
        "Servi\xE7o \u2014 narrativa, motivo, classe e crit\xE9rio"
      ]
    ],
    body: rows.map(pdfRow),
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      cellPadding: { top: 1.45, right: 1.25, bottom: 1.45, left: 1.25 },
      overflow: "linebreak",
      valign: "top",
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.18
    },
    headStyles: {
      fillColor: COLORS.darkGreen,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 7.3,
      minCellHeight: 7.5,
      valign: "middle"
    },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles: {
      0: { cellWidth: TABLE_WIDTHS[0] },
      1: { cellWidth: TABLE_WIDTHS[1] },
      2: { cellWidth: TABLE_WIDTHS[2] },
      3: { cellWidth: TABLE_WIDTHS[3] },
      4: { cellWidth: TABLE_WIDTHS[4] },
      5: { cellWidth: TABLE_WIDTHS[5] },
      6: { cellWidth: TABLE_WIDTHS[6] }
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 2) {
        const raw = String(data.cell.raw || "");
        if (raw.includes("Ausente") || raw.includes("sa\xEDda da fonte")) {
          data.cell.styles.textColor = COLORS.absence;
          data.cell.styles.fillColor = COLORS.absenceFill;
          data.cell.styles.fontStyle = "bold";
        } else if (raw.includes("Atrasado")) {
          data.cell.styles.textColor = COLORS.warning;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    willDrawPage: (pageData) => {
      if (pageData.pageNumber > 1)
        drawCompactHeader(doc, TRACKING_TITLES[options.module]);
    }
  });
  if (!rows.length) {
    setText(doc, COLORS.muted, 8.5);
    doc.text(
      "Nenhuma ordem classificada para este m\xF3dulo.",
      MARGIN_X,
      startY + 7
    );
  }
  drawFinalFooters(doc);
  return doc;
}
function sanitizeExcelCell(value) {
  if (typeof value !== "string") return value ?? "";
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}
function excelRow(row) {
  const raw = {
    Chave: row.chave,
    OS: row.os,
    Frota: row.frota,
    Equipamento: row.equipamento,
    Modelo: row.modelo,
    Apoio: row.apoio,
    "Grupo fonte": row.grupo_fonte,
    Setor: row.setor,
    Ponto: row.ponto,
    Origem: row.origem,
    Prestador: row.prestador,
    "Status fonte": row.status,
    "Status rastreamento": row.trackingStatus,
    "Status exibido": displayStatus(row),
    "Origem encerramento": trackingClosureOrigin(row) || "",
    "Data detec\xE7\xE3o encerramento": trackingClosedAt(row) || "",
    Atrasado: row.overdue ? "SIM" : "N\xC3O",
    Entrada: row.entrada,
    Previs\u00E3o: row.previsao,
    Narrativa: row.narrativa,
    Motivo: row.motivo,
    Classe: row.classe,
    "C\xF3digo ponto": row.cd_ponto,
    "Raz\xE3o da classifica\xE7\xE3o": row.classificationReason,
    Ativo: row.ativo ? "SIM" : "N\xC3O",
    "Primeira vista": row.primeira_vista,
    "\xDAltima vista": row.ultima_vista,
    "Ausente desde": row.ausente_desde
  };
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, sanitizeExcelCell(value)])
  );
}
function summaryRows(options, counts, generatedAt) {
  const rows = [
    ["Relat\xF3rio", "Gest\xE3o de Ordens de Manuten\xE7\xE3o"],
    ["M\xF3dulo", TRACKING_TITLES[options.module]],
    ["Gerado em (Bras\xEDlia)", formatDate(generatedAt.toISOString(), true)],
    ["Gerado em (ISO UTC)", generatedAt.toISOString()],
    ["Fonte atualizada (Bras\xEDlia)", sourceTime(options.sourceUpdated)],
    ["\xDAltima sincroniza\xE7\xE3o (Bras\xEDlia)", sourceTime(options.lastSynced)],
    [
      "Fonte atualizada (ISO original)",
      options.sourceUpdated || "N\xE3o informado"
    ],
    [
      "\xDAltima sincroniza\xE7\xE3o (ISO original)",
      options.lastSynced || "N\xE3o informado"
    ],
    ["Total", counts.total],
    ["Programado", counts.programado],
    ["Andamento", counts.andamento],
    ["Encerrado", counts.encerrado],
    ["Ausente", counts.ausente],
    ["Outros", counts.outros],
    ["Atrasado", counts.atrasado],
    ["Frotas distintas", counts.frotas]
  ];
  const filters = options.filters.length ? options.filters : ["Sem filtros informados"];
  filters.forEach(
    (filter, index) => rows.push([`Filtro ${index + 1}`, filter])
  );
  rows.push([
    "Advert\xEAncia",
    "Encerramento operacional por sa\xEDda da fonte; data detectada n\xE3o confirma execu\xE7\xE3o real."
  ]);
  if (text2(options.sourceError))
    rows.push(["Erro da fonte", options.sourceError]);
  return rows;
}
function configureWidths(sheet, max = 42) {
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  const widths = [];
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    let width = 12;
    for (let row = range.s.r; row <= Math.min(range.e.r, 100); row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ c: column, r: row })];
      width = Math.max(width, Math.min(max, String(cell?.v ?? "").length + 2));
    }
    widths.push({ wch: width });
  }
  sheet["!cols"] = widths;
}
function styleExcelBranding(sheet, rows) {
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : { s: { c: 0, r: 0 }, e: { c: 1, r: 0 } };
  rows.forEach(({ row, fill, color }) => {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ c: column, r: row - 1 });
      if (!sheet[address]) sheet[address] = { t: "s", v: "" };
      sheet[address].s = {
        fill: { patternType: "solid", fgColor: { rgb: fill } },
        font: { bold: true, color: { rgb: color } }
      };
    }
  });
}
function styleExcelDetailHeader(sheet) {
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const address = XLSX.utils.encode_cell({ c: column, r: range.s.r });
    if (!sheet[address]) continue;
    sheet[address].s = {
      fill: { patternType: "solid", fgColor: { rgb: "146B45" } },
      font: { bold: true, color: { rgb: "FFFFFF" } }
    };
  }
}
async function exportTrackingPDF(options) {
  const doc = await buildTrackingPdf({
    ...options,
    rows: Array.isArray(options.rows) ? options.rows : [],
    filters: Array.isArray(options.filters) ? options.filters : []
  });
  await doc.save(filename("pdf", options), { returnPromise: true });
}
async function exportTrackingExcel(options) {
  const rows = Array.isArray(options.rows) ? options.rows : [];
  const counts = getTrackingCounts(rows);
  const generatedAt = /* @__PURE__ */ new Date();
  const workbook = XLSX.utils.book_new();
  const summaryValues = [
    ["BRANCO PERES AGRO", ""],
    ["Gest\xE3o de Ordens de Manuten\xE7\xE3o", TRACKING_TITLES[options.module]],
    ["", ""],
    ["Campo", "Valor"],
    ...summaryRows(options, counts, generatedAt)
  ];
  const summary = XLSX.utils.aoa_to_sheet(
    summaryValues.map((row) => row.map((value) => sanitizeExcelCell(value)))
  );
  configureWidths(summary, 110);
  styleExcelBranding(summary, [
    { row: 1, fill: "14482F", color: "FFFFFF" },
    { row: 2, fill: "C1912F", color: "14382F" },
    { row: 4, fill: "1F6B45", color: "FFFFFF" }
  ]);
  XLSX.utils.book_append_sheet(workbook, summary, "Resumo");
  const detailHeaders = Object.keys(
    excelRow(
      rows[0] || {
        chave: "",
        os: "",
        frota: "",
        modelo: "",
        grupo_fonte: "",
        setor: "",
        ponto: "",
        origem: "",
        prestador: "",
        status: "",
        entrada: "",
        previsao: "",
        narrativa: "",
        ativo: true,
        primeira_vista: "",
        ultima_vista: "",
        ausente_desde: null,
        classe: "",
        motivo: "",
        cd_ponto: "",
        apoio: "",
        equipamento: "",
        trackingStatus: "outros",
        classificationReason: "",
        overdue: false,
        closureOrigin: null,
        closedDetectedAt: null
      }
    )
  );
  const details = XLSX.utils.json_to_sheet(
    rows.length ? rows.map(excelRow) : [],
    { header: detailHeaders }
  );
  configureWidths(details);
  styleExcelDetailHeader(details);
  if (details["!ref"]) details["!autofilter"] = { ref: details["!ref"] };
  XLSX.utils.book_append_sheet(workbook, details, "Ordens");
  XLSX.writeFile(workbook, filename("xlsx", options, generatedAt), {
    bookType: "xlsx",
    cellStyles: true
  });
}
export {
  buildTrackingPdf as buildTrackingPDF,
  exportTrackingExcel,
  exportTrackingPDF
};
