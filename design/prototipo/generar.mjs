// Genera los artboards del prototipo que llevan gráficos calculados: curva de carga,
// mapa de calor, barras, unifilar, matriz del PGEE y páginas del informe Word.
// Uso: node design/prototipo/generar.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const escribir = (nombre, html) => {
  writeFileSync(join(DIR, nombre), html, 'utf8');
  console.log('escrito', nombre);
};

// Número con punto de miles y coma decimal (formato colombiano)
const fmt = (v, d = 0) => {
  const [ent, dec] = Math.abs(v).toFixed(d).split('.');
  return (v < 0 ? '−' : '') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (dec ? ',' + dec : '');
};
const r1 = (v) => Math.round(v * 10) / 10;

// ---------- Datos de ejemplo del Bloque 6 ----------
const MESES = ['oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep'];
const ACTUAL = [17200, 16800, 11900, 10800, 16400, 17900, 17600, 18300, 13200, 12600, 17100, 16600];
const ANTERIOR = [17900, 17600, 12500, 11200, 17100, 18600, 18400, 19100, 13800, 13100, 17900, 17400];
const LABORABLE = [6.7, 6.6, 6.4, 6.4, 6.6, 7.8, 17.8, 32.2, 41.1, 45.6, 48.9, 50.0, 43.4, 44.5, 47.8, 48.9, 46.7, 41.1, 36.7, 33.4, 28.9, 22.2, 12.2, 7.8];
const FIN_SEMANA = [6.7, 6.6, 6.4, 6.4, 6.4, 6.6, 7.2, 8.9, 12.2, 14.5, 15.6, 16.1, 15.6, 15.0, 14.5, 13.9, 13.3, 12.2, 11.1, 10.0, 8.9, 7.8, 7.2, 6.9];
const USOS = [
  { n: 'Climatización', c: '#2a78d6', kwh: 95064, p: 51, eq: '38 mini-split, 2 centrales' },
  { n: 'Iluminación', c: '#eda100', kwh: 33552, p: 18, eq: '412 tubos T8, 36 paneles LED' },
  { n: 'TI y oficina', c: '#008300', kwh: 24232, p: 13, eq: '96 computadores, 14 proyectores' },
  { n: 'Refrigeración', c: '#1baf7a', kwh: 11184, p: 6, eq: '9 neveras, 3 dispensadores' },
  { n: 'Motores y bombas', c: '#eb6834', kwh: 9320, p: 5, eq: '2 bombas de agua de 3 HP' },
  { n: 'Cocina', c: '#e87ba4', kwh: 5592, p: 3, eq: 'Cafetería: hornos y greca' },
  { n: 'Otros', c: '#898781', kwh: 7456, p: 4, eq: 'Cargadores y equipos menores' },
];
const MEDIDAS = [
  { c: 'M1', n: 'Ajuste de horarios de climatización', col: '#2a78d6', kwh: 7200, ah: 6.1, inv: 0.8, ret: 0.1, vpn: 33.7, pr: 'Alta', sel: true },
  { c: 'M2', n: 'Apagado nocturno de equipos de TI', col: '#008300', kwh: 2350, ah: 2.0, inv: 0.3, ret: 0.2, vpn: 11.0, pr: 'Alta', sel: true },
  { c: 'M3', n: 'Iluminación LED en aulas', col: '#eda100', kwh: 8700, ah: 7.4, inv: 18.5, ret: 2.5, vpn: 23.3, pr: 'Alta', sel: true },
  { c: 'M4', n: 'Sensores de ocupación', col: '#eda100', kwh: 3050, ah: 2.6, inv: 6.2, ret: 2.4, vpn: 8.5, pr: 'Media', sel: true },
  { c: 'M5', n: 'Aires inverter en el tablero TC-1', col: '#2a78d6', kwh: 10000, ah: 8.5, inv: 38.0, ret: 4.5, vpn: 10.0, pr: 'Media', sel: true },
  { c: 'M6', n: 'Banco de condensadores de 15 kvar', col: '#898781', kwh: null, ah: 1.4, inv: 4.5, ret: 3.2, vpn: 3.4, pr: 'Media', sel: true },
  { c: 'M7', n: 'Solar fotovoltaica de 20 kWp', col: '#898781', kwh: 32100, ah: 27.3, inv: 90.0, ret: 3.3, vpn: 64.3, pr: 'En evaluación', sel: false },
];

// ---------- Íconos (trazo, cuadrícula de 24 px) ----------
const P = {
  building: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"></rect><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M9 15.5h2M13 15.5h2"></path>',
  area: '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 9.5h3M4 14.5h3M9.5 4v3M14.5 4v3"></path>',
  plug: '<path d="M9 3.5V8M15 3.5V8"></path><path d="M7 8h10v2.5a5 5 0 0 1-10 0z"></path><path d="M12 15.5V21"></path>',
  bolt: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z"></path>',
  gauge: '<path d="M4.5 16a8 8 0 1 1 15 0"></path><path d="M12 13l3.5-4"></path><circle cx="12" cy="13" r="1.2"></circle>',
  receipt: '<path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z"></path><path d="M9 8h6M9 11.5h6M9 15h4"></path>',
  chartLine: '<path d="M4 20h16"></path><path d="M4.5 15.5l4-4.5 3.5 3 6.5-7"></path>',
  pie: '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12z"></path><path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15z"></path>',
  ruler: '<path d="M4.5 15.5 15.5 4.5l4 4-11 11z"></path><path d="M8 12l1.5 1.5M10.5 9.5 12 11M13 7l1.5 1.5"></path>',
  searchCheck: '<circle cx="11" cy="11" r="6.5"></circle><path d="M20 20l-4.2-4.2"></path><path d="M8.5 11l1.8 1.8 3.2-3.4"></path>',
  target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><path d="M12 12h.01"></path>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"></rect><path d="M9 4.5V3h6v1.5"></path><path d="M9 10h6M9 13.5h6M9 17h3.5"></path>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"></rect><path d="M4 10h16M8.5 3v4M15.5 3v4"></path><path d="M8 14h3M8 17h6"></path>',
  file: '<path d="M6.5 3h8l4 4v14h-12z"></path><path d="M14.5 3v4h4"></path><path d="M9.5 12h6M9.5 15.5h6"></path>',
  chevronDown: '<path d="M6 9l6 6 6-6"></path>',
  cloudCheck: '<path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.5 4.25 4.25 0 0 0 7 18z"></path><path d="M9.5 13.5l2 2 3.5-3.5"></path>',
  download: '<path d="M12 4v11"></path><path d="M7.5 10.5 12 15l4.5-4.5"></path><path d="M5 15v4h14v-4"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"></rect><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"></path>',
  arrowDown: '<path d="M12 5v14"></path><path d="M6 13l6 6 6-6"></path>',
  transformer: '<circle cx="12" cy="8.5" r="5"></circle><circle cx="12" cy="15.5" r="5"></circle>',
  send: '<path d="M4 12h12"></path><path d="M12 6l6 6-6 6"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2.2h5.6L16.3 7h2.2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"></path><circle cx="12" cy="13" r="3.5"></circle>',
};
const icon = (nombre, tam = 18, estilo = '') =>
  `<svg class="i" width="${tam}" height="${tam}" viewBox="0 0 24 24"${estilo ? ` style="${estilo}"` : ''}>${P[nombre]}</svg>`;

// Glifos de estado (siempre junto a una etiqueta de texto)
const GLIFO = {
  good: '<circle cx="12" cy="12" r="9" fill="#0ca30c"></circle><path d="M8 12.3l2.6 2.6L16 9.6" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>',
  warning: '<path d="M10.4 3.9 2.6 17.6A1.9 1.9 0 0 0 4.2 20.5h15.6a1.9 1.9 0 0 0 1.6-2.9L13.6 3.9a1.9 1.9 0 0 0-3.2 0z" fill="#fab219"></path><path d="M12 9v5" stroke="#0f1b33" stroke-width="2" stroke-linecap="round"></path><circle cx="12" cy="17" r="1.1" fill="#0f1b33"></circle>',
  serious: '<path d="M10.4 3.9 2.6 17.6A1.9 1.9 0 0 0 4.2 20.5h15.6a1.9 1.9 0 0 0 1.6-2.9L13.6 3.9a1.9 1.9 0 0 0-3.2 0z" fill="#ec835a"></path><path d="M12 9v5" stroke="#ffffff" stroke-width="2" stroke-linecap="round"></path><circle cx="12" cy="17" r="1.1" fill="#ffffff"></circle>',
  critical: '<circle cx="12" cy="12" r="9" fill="#d03b3b"></circle><path d="M12 7.5v5.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"></path><circle cx="12" cy="16.3" r="1.2" fill="#ffffff"></circle>',
};
const glifo = (nivel, tam = 16) => `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" style="flex-shrink: 0;">${GLIFO[nivel]}</svg>`;
const glifoSvg = (nivel, x, y, tam = 16) =>
  `<svg x="${r1(x - tam / 2)}" y="${r1(y - tam / 2)}" width="${tam}" height="${tam}" viewBox="0 0 24 24">${GLIFO[nivel]}</svg>`;

// ---------- Documento base ----------
const FUENTES_A = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&amp;family=IBM+Plex+Sans:wght@400;500;600;700&amp;display=swap';
const FUENTES_C = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&amp;family=Public+Sans:wght@400;500;600;700&amp;display=swap';

const documento = (fuentes, fondo, cuerpo, cssExtra = '') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${fuentes}">
  <style>
    body { margin: 0; background: ${fondo}; }
    a { color: #187f44; }
    a:hover { color: #10234b; }
    .i { fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
    .mono { font-family: "IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace; }
    .serif { font-family: "Newsreader", Georgia, "Times New Roman", serif; }
    .num { font-variant-numeric: tabular-nums; }${cssExtra}
  </style>
</helmet>
${cuerpo}
</x-dc>
</body>
</html>
`;

// ---------- Piezas de la app (dirección A) ----------
const FONDO_REJILLA = 'background-color: #10234b; background-image: linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px); background-size: 22px 22px;';
const LOGO = '<svg width="30" height="30" viewBox="0 0 28 28"><rect width="28" height="28" rx="7" fill="#22a056"></rect><path d="M7.5 20.5c0-7.2 4.6-11.8 13-12.3 0 8.2-4.6 12.8-11.8 12.8" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><path d="M15 10.6l-3.4 4.6h2.7l-1 3.3 3.5-4.6h-2.7z" fill="#ffffff"></path></svg>';

const NAV = [
  ['LEVANTAMIENTO', [['datos', 'Datos generales', 'building'], ['areas', 'Áreas y dimensiones', 'area'], ['inventario', 'Inventario', 'plug'], ['electrico', 'Sistema eléctrico', 'bolt'], ['mediciones', 'Mediciones', 'gauge'], ['facturacion', 'Facturación', 'receipt']]],
  ['ANÁLISIS', [['comportamiento', 'Comportamiento', 'chartLine'], ['balance', 'Balance e indicadores', 'pie'], ['dimensionamiento', 'Dimensionamiento', 'ruler']]],
  ['PLAN', [['diagnostico', 'Diagnóstico', 'searchCheck'], ['oportunidades', 'Oportunidades', 'target'], ['pgee', 'PGEE', 'clipboard'], ['implementacion', 'Implementación', 'calendar']]],
  ['INFORMES', [['informes', 'Informes y exportación', 'file']]],
];

function menuLateral(activo) {
  const grupos = NAV.map(([titulo, items]) => {
    const filas = items.map(([id, texto, ic]) => {
      const on = id === activo;
      return `
          <div style="display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: 8px; font-size: 13px;${on ? ' background: rgba(255,255,255,0.1); color: #ffffff; font-weight: 600;' : ' color: #d7deea;'}">${icon(ic, 18, on ? 'color: #22a056;' : 'color: #9fb0cc;')}<span>${texto}</span></div>`;
    }).join('');
    return `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="mono" style="padding: 0 10px 4px; font-size: 10px; letter-spacing: 0.1em; color: #8a9bb8;">${titulo}</span>${filas}
        </div>`;
  }).join('');
  return `
  <aside style="display: flex; flex-direction: column; gap: 18px; width: 240px; flex-shrink: 0; box-sizing: border-box; padding: 18px 14px 16px; color: #ffffff; ${FONDO_REJILLA}">
    <div style="display: flex; align-items: center; gap: 10px; padding: 0 6px;">${LOGO}<span style="font-size: 17px; font-weight: 600; letter-spacing: 0.04em;">PONTIA</span></div>
    <div style="display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);">
      <span class="mono" style="font-size: 10px; letter-spacing: 0.1em; color: #9fb0cc;">PROYECTO · BL-06</span>
      <span style="display: flex; align-items: center; justify-content: space-between; gap: 6px; font-size: 14px; font-weight: 600;">Bloque 6 · Aulas y lab.${icon('chevronDown', 16, 'color: #9fb0cc;')}</span>
    </div>
    <nav style="display: flex; flex-direction: column; gap: 14px;">${grupos}
    </nav>
    <div style="display: flex; align-items: center; gap: 8px; margin-top: auto; padding: 8px 10px; border-radius: 8px; background: rgba(255,255,255,0.06); font-size: 12px; color: #d7deea;">${icon('cloudCheck', 16, 'color: #22a056;')}<span>Guardado en el equipo · 84 MB</span></div>
  </aside>`;
}

const barraSuperior = (ruta, titulo, acciones) => `
    <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span class="mono" style="font-size: 11px; letter-spacing: 0.08em; color: #5c6a80;">${ruta}</span>
        <span style="font-size: 24px; font-weight: 600; line-height: 1.2;">${titulo}</span>
      </div>
      <div style="display: flex; gap: 8px;">${acciones}</div>
    </div>`;
const botonClaro = (ic, texto) => `<span style="display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; box-sizing: border-box; border-radius: 8px; background: #ffffff; border: 1px solid #c9d3df; color: #10234b; font-size: 13px; font-weight: 600;">${icon(ic, 16)}${texto}</span>`;
const botonPrimario = (ic, texto) => `<span style="display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 8px; background: #187f44; color: #ffffff; font-size: 13px; font-weight: 600;">${icon(ic, 16, 'stroke-width: 2.2;')}${texto}</span>`;
const tarjeta = (contenido, extra = '') => `
      <section style="display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 14px 16px; box-sizing: border-box; background: #ffffff; border: 1px solid #dbe1ea; border-radius: 10px;${extra}">${contenido}
      </section>`;
const encabezadoTarjeta = (titulo, sub = '', derecha = '') => `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px;">
          <div style="display: flex; align-items: baseline; gap: 10px;"><span style="font-size: 15px; font-weight: 600;">${titulo}</span>${sub ? `<span class="mono" style="font-size: 10px; letter-spacing: 0.08em; color: #5c6a80;">${sub}</span>` : ''}</div>
          <div style="display: flex; align-items: center; gap: 14px;">${derecha}</div>
        </div>`;
const verTabla = `<span style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; box-sizing: border-box; border-radius: 8px; border: 1px solid #dbe1ea; color: #4c5a70;">${icon('table', 16)}</span>`;
const claveLinea = (color, texto) => `<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4c5a70;"><span style="width: 16px; height: 2px; border-radius: 1px; background: ${color};"></span>${texto}</span>`;
const claveBarra = (color, texto) => `<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4c5a70;"><span style="width: 10px; height: 10px; border-radius: 2px; background: ${color};"></span>${texto}</span>`;
const clavePunto = (color, texto) => `<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4c5a70;"><span style="width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>${texto}</span>`;
const segmentado = (items, activo) => `<div style="display: flex; padding: 3px; border-radius: 9px; background: #ffffff; border: 1px solid #dbe1ea;">${items.map((t, i) => `<span style="display: flex; align-items: center; height: 30px; padding: 0 12px; border-radius: 6px; font-size: 13px;${i === activo ? ' background: #10234b; color: #ffffff; font-weight: 600;' : ' color: #4c5a70;'}">${t}</span>`).join('')}</div>`;
const selector = (etiqueta, valor) => `<span style="display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px; box-sizing: border-box; border-radius: 9px; background: #ffffff; border: 1px solid #dbe1ea; font-size: 13px;"><span style="color: #5c6a80;">${etiqueta}</span><span style="font-weight: 600;">${valor}</span>${icon('chevronDown', 16, 'color: #5c6a80;')}</span>`;
const indicador = (etiqueta, valor, sub, primero = false) => `
        <div style="display: flex; flex-direction: column; gap: 6px; padding: 14px 16px;${primero ? '' : ' border-left: 1px solid #e3e8ef;'}">
          <span class="mono" style="font-size: 10px; letter-spacing: 0.08em; color: #5c6a80;">${etiqueta}</span>
          <span style="font-size: 24px; font-weight: 600; line-height: 1.1;">${valor}</span>
          <span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #5c6a80;">${sub}</span>
        </div>`;
const unidad = (u) => `<span style="font-size: 14px; font-weight: 500; color: #5c6a80;"> ${u}</span>`;
const pantalla = (activo, contenido) => `
<div style="display: flex; width: 1440px; height: 900px; overflow: hidden; background: #eef1f5; color: #0f1b33; font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif;">${menuLateral(activo)}
  <main style="display: flex; flex-direction: column; gap: 12px; flex-grow: 1; min-width: 0; padding: 20px 28px 24px;">${contenido}
  </main>
</div>`;
const trazoBarra = (x, y, w, base, r = 4) =>
  `M${r1(x)} ${r1(base)}V${r1(y + r)}A${r} ${r} 0 0 1 ${r1(x + r)} ${r1(y)}H${r1(x + w - r)}A${r} ${r} 0 0 1 ${r1(x + w)} ${r1(y + r)}V${r1(base)}Z`;

// ---------- Comportamiento del consumo (PC) ----------
function curvaCarga() {
  const W = 532, H = 220, L = 40, R = 12, T = 16, B = 28, pw = W - L - R, ph = H - T - B, base = T + ph;
  const xs = (h) => L + (h * pw) / 23;
  const ys = (v) => T + ph * (1 - v / 60);
  const puntos = (serie) => serie.map((v, h) => `${r1(xs(h))},${r1(ys(v))}`).join(' ');
  const rejilla = [20, 40, 60].map((v) => `<line x1="${L}" y1="${r1(ys(v))}" x2="${W - R}" y2="${r1(ys(v))}" stroke="#e3e8ef" stroke-width="1"></line><text x="${L - 6}" y="${r1(ys(v) + 3.5)}" text-anchor="end" font-size="10" fill="#7a879b">${v}</text>`).join('');
  const horas = [0, 3, 6, 9, 12, 15, 18, 21].map((h) => `<text x="${r1(xs(h))}" y="${base + 18}" text-anchor="middle" font-size="10" fill="#7a879b">${h === 0 ? '0 h' : h}</text>`).join('');
  const yb = ys(6.4);
  return `
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display: block; overflow: visible; font-family: 'IBM Plex Mono', ui-monospace, monospace;">
          <rect x="${L}" y="${r1(yb)}" width="${pw}" height="${r1(base - yb)}" fill="#eef1f5"></rect>
          <text x="${L + 8}" y="${base - 5}" font-size="10" fill="#4c5a70">Carga base 6,4 kW</text>
          ${rejilla}
          <text x="${L - 6}" y="${base + 3.5}" text-anchor="end" font-size="10" fill="#7a879b">0</text>
          <line x1="${L}" y1="${base}" x2="${W - R}" y2="${base}" stroke="#c5cfdc" stroke-width="1"></line>
          <polyline points="${puntos(FIN_SEMANA)}" fill="none" stroke="#eb6834" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
          <polyline points="${puntos(LABORABLE)}" fill="none" stroke="#2a78d6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
          <circle cx="${r1(xs(11))}" cy="${r1(ys(50))}" r="4.5" fill="#2a78d6" stroke="#ffffff" stroke-width="2"></circle>
          <text x="${r1(xs(11) + 10)}" y="${r1(ys(50) - 6)}" font-size="10" font-weight="600" fill="#0f1b33">50,0 kW · 11:00</text>
          <circle cx="${r1(xs(11))}" cy="${r1(ys(16.1))}" r="4.5" fill="#eb6834" stroke="#ffffff" stroke-width="2"></circle>
          <text x="${r1(xs(11))}" y="${r1(ys(16.1) - 10)}" text-anchor="middle" font-size="10" font-weight="600" fill="#0f1b33">16,1 kW</text>
          ${horas}
        </svg>`;
}

function barrasMensuales() {
  const W = 532, H = 220, L = 44, R = 8, T = 16, B = 28, pw = W - L - R, ph = H - T - B, base = T + ph, slot = pw / 12;
  const ys = (v) => T + ph * (1 - v / 20000);
  let previo = '', actual = '', meses = '';
  ACTUAL.forEach((v, i) => {
    const x0 = L + i * slot + (slot - 30) / 2;
    previo += `<path d="${trazoBarra(x0, ys(ANTERIOR[i]), 14, base)}"></path>`;
    actual += `<path d="${trazoBarra(x0 + 16, ys(v), 14, base)}"></path>`;
    meses += `<text x="${r1(L + i * slot + slot / 2)}" y="${base + 18}" text-anchor="middle" font-size="10" fill="#7a879b">${MESES[i]}</text>`;
  });
  const rejilla = [10000, 20000].map((v) => `<line x1="${L}" y1="${r1(ys(v))}" x2="${W - R}" y2="${r1(ys(v))}" stroke="#e3e8ef" stroke-width="1"></line><text x="${L - 6}" y="${r1(ys(v) + 3.5)}" text-anchor="end" font-size="10" fill="#7a879b">${fmt(v)}</text>`).join('');
  return `
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display: block; overflow: visible; font-family: 'IBM Plex Mono', ui-monospace, monospace;">
          ${rejilla}
          <text x="${L - 6}" y="${base + 3.5}" text-anchor="end" font-size="10" fill="#7a879b">0</text>
          <line x1="${L}" y1="${base}" x2="${W - R}" y2="${base}" stroke="#c5cfdc" stroke-width="1"></line>
          <g fill="#c3c2b7">${previo}</g>
          <g fill="#2a78d6">${actual}</g>
          ${meses}
        </svg>`;
}

const RAMPA = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const RANGOS = ['< 8', '8–16', '16–24', '24–32', '32–40', '40–48', '≥ 48'];
function mapaCalor() {
  const W = 1112, L = 44, sep = 2, alto = 26, ancho = (W - L - 23 * sep) / 24;
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const factor = [1.0, 1.03, 1.05, 1.02];
  const valor = (d, h) => {
    if (d < 4) return LABORABLE[h] * factor[d];
    if (d === 4) return LABORABLE[h] * (h >= 13 ? 0.8 : 1.0);
    if (d === 5) return h >= 7 && h <= 12 ? LABORABLE[h] * 0.55 : FIN_SEMANA[h];
    return FIN_SEMANA[h];
  };
  const tono = (v) => RAMPA[Math.min(6, Math.floor(v / 8))];
  let celdas = '', filas = '';
  for (let d = 0; d < 7; d++) {
    const y = d * (alto + sep);
    filas += `<text x="0" y="${r1(y + alto / 2 + 4)}" font-size="11" fill="#4c5a70">${DIAS[d]}</text>`;
    for (let h = 0; h < 24; h++) {
      celdas += `<rect x="${r1(L + h * (ancho + sep))}" y="${y}" width="${r1(ancho)}" height="${alto}" rx="3" fill="${tono(valor(d, h))}"></rect>`;
    }
  }
  const H = 7 * alto + 6 * sep + 22;
  const horas = Array.from({ length: 12 }, (_, k) => k * 2).map((h) => `<text x="${r1(L + h * (ancho + sep) + ancho / 2)}" y="${H - 5}" text-anchor="middle" font-size="10" fill="#7a879b">${h === 0 ? '0 h' : h}</text>`).join('');
  return `
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display: block; font-family: 'IBM Plex Mono', ui-monospace, monospace;">${filas}${celdas}${horas}</svg>`;
}
const leyendaCalor = `<div style="display: flex; align-items: center; gap: 10px; font-size: 11px; color: #4c5a70;"><span>kW</span>${RAMPA.map((c, i) => `<span style="display: flex; align-items: center; gap: 4px;"><span style="width: 18px; height: 10px; border-radius: 2px; background: ${c};"></span><span class="mono num">${RANGOS[i]}</span></span>`).join('')}</div>`;

function paginaConsumo() {
  const indicadores = [
    indicador('CONSUMO ANUAL', `186.400${unidad('kWh')}`, `${icon('arrowDown', 14, 'color: #0ca30c; stroke-width: 2.2;')}4,2 % menos que 2024–25`, true),
    indicador('PROMEDIO MENSUAL', `15.533${unidad('kWh')}`, 'Pico en mayo: 18.300 kWh'),
    indicador('DEMANDA MÁXIMA', `53,8${unidad('kW')}`, '12 mar 2026 · 10:45'),
    indicador('FACTOR DE CARGA', '0,58', 'Día laborable típico'),
    indicador('CARGA BASE NOCTURNA', `6,4${unidad('kW')}`, `${glifo('warning', 14)}13 % del pico · revisar`),
  ].join('');
  return pantalla('comportamiento', `
    ${barraSuperior('BLOQUE 6 / ANÁLISIS', 'Comportamiento del consumo', botonClaro('download', 'Exportar') + botonPrimario('plus', 'Agregar datos'))}
    <div style="display: flex; align-items: center; gap: 10px;">
      ${segmentado(['12 meses', '2025', '2024', 'Personalizado'], 0)}
      ${selector('Fuente:', 'Facturas y analizador')}
      ${selector('Día:', 'Todos')}
      <span class="mono" style="margin-left: auto; font-size: 11px; letter-spacing: 0.08em; color: #5c6a80;">OCT 2025 – SEP 2026</span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); background: #ffffff; border: 1px solid #dbe1ea; border-radius: 10px;">${indicadores}
    </div>
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;">${tarjeta(`${encabezadoTarjeta('Curva de carga típica', 'kW POR HORA', verTabla)}
        <div style="display: flex; gap: 16px;">${claveLinea('#2a78d6', 'Laborable · 690 kWh/día')}${claveLinea('#eb6834', 'Fin de semana · 250 kWh/día')}</div>${curvaCarga()}`)}${tarjeta(`${encabezadoTarjeta('Consumo mensual', 'kWh · FACTURAS', verTabla)}
        <div style="display: flex; gap: 16px;">${claveBarra('#c3c2b7', 'oct 2024 – sep 2025')}${claveBarra('#2a78d6', 'oct 2025 – sep 2026')}<span style="font-size: 12px; font-weight: 600; color: #0f1b33;">−4,2 %</span></div>${barrasMensuales()}`)}
    </div>${tarjeta(`${encabezadoTarjeta('Mapa de calor semanal', 'kW PROMEDIO POR HORA', leyendaCalor + verTabla)}${mapaCalor()}`)}`);
}

// ---------- Unifilar: carga instalada vs capacidad (PC) ----------
function diagramaUnifilar() {
  const X = 378;
  const nivel = (p) => (p > 80 ? 'serious' : p >= 60 ? 'warning' : 'good');
  const COLOR = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a' };
  const TABLEROS = [
    { x: 138, cod: 'TA-1', nom: 'Aulas', kw: 9.2, a: 27, cap: 60, circ: 14 },
    { x: 258, cod: 'TA-2', nom: 'Laboratorios', kw: 8.4, a: 26, cap: 40, circ: 11, nota: 'Desbalance 12 %' },
    { x: 378, cod: 'TC-1', nom: 'Climatización', kw: 30.5, a: 96, cap: 110, circ: 8 },
    { x: 498, cod: 'TB-1', nom: 'Bombas', kw: 3.1, a: 10, cap: 30, circ: 3 },
    { x: 618, cod: 'TE', nom: 'Servidores', kw: 2.6, a: 8, cap: 20, circ: 4 },
  ];
  const interruptor = (x, y) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="#ffffff" stroke="#10234b" stroke-width="1.5"></rect><path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="#10234b" stroke-width="1.3"></path>`;
  let alimentadores = '';
  let flujos = `<path class="flujo" d="M${X} 50V91"></path><path class="flujo" d="M${X} 137V170"></path><path class="flujo" d="M${X} 190V207"></path><path class="flujo" d="M${X} 221V252"></path>`;
  for (const t of TABLEROS) {
    const pct = Math.round((t.a / t.cap) * 100);
    const n = nivel(pct);
    alimentadores += `
          <path d="M${t.x} 252V279M${t.x} 293V326" fill="none" stroke="#10234b" stroke-width="2"></path>
          ${interruptor(t.x, 286)}
          <text x="${t.x + 12}" y="290" font-size="10" fill="#4c5a70">${t.cap} A</text>
          <rect x="${t.x - 54}" y="326" width="108" height="98" rx="8" fill="#ffffff" stroke="${n === 'good' ? '#c9d3df' : COLOR[n]}" stroke-width="${n === 'good' ? 1 : 1.5}"></rect>
          <text x="${t.x - 44}" y="347" font-size="11" font-weight="600" fill="#0f1b33">${t.cod}</text>
          ${glifoSvg(n, t.x + 38, 342, 16)}
          <text x="${t.x - 44}" y="364" font-size="12" fill="#4c5a70" style="font-family: 'IBM Plex Sans', sans-serif;">${t.nom}</text>
          <text x="${t.x - 44}" y="387" font-size="16" font-weight="600" fill="#0f1b33" style="font-family: 'IBM Plex Sans', sans-serif;">${fmt(t.kw, 1)} kW</text>
          <rect x="${t.x - 44}" y="396" width="88" height="6" rx="3" fill="#e3e8ef"></rect>
          <rect x="${t.x - 44}" y="396" width="${r1((88 * pct) / 100)}" height="6" rx="3" fill="${COLOR[n]}"></rect>
          <text x="${t.x - 44}" y="416" font-size="10" fill="#4c5a70">${pct} % · ${t.a} A</text>
          <text x="${t.x}" y="444" text-anchor="middle" font-size="10" fill="#5c6a80">${t.circ} circuitos</text>`;
    if (t.nota) alimentadores += `${glifoSvg('warning', t.x - 38, 462, 14)}<text x="${t.x - 28}" y="466" font-size="10" fill="#0f1b33">${t.nota}</text>`;
    flujos += `<path class="flujo" d="M${X} 252H${t.x}V279"></path><path class="flujo" d="M${t.x} 293V326"></path>`;
  }
  return `
        <svg width="756" height="480" viewBox="0 0 756 480" style="display: block; font-family: 'IBM Plex Mono', ui-monospace, monospace;">
          <circle cx="${X}" cy="34" r="16" fill="#ffffff" stroke="#10234b" stroke-width="2"></circle>
          <path d="M368 34c2.5-6 7.5-6 10 0s7.5 6 10 0" fill="none" stroke="#10234b" stroke-width="1.6"></path>
          <text x="402" y="30" font-size="12" font-weight="600" fill="#0f1b33" style="font-family: 'IBM Plex Sans', sans-serif;">Red del operador</text>
          <text x="402" y="45" font-size="10" fill="#4c5a70">13,2 kV</text>
          <path d="M${X} 50V91M${X} 137V170M${X} 190V207M${X} 221V252" fill="none" stroke="#10234b" stroke-width="2"></path>
          <circle cx="${X}" cy="104" r="13" fill="#ffffff" stroke="#10234b" stroke-width="2"></circle>
          <circle cx="${X}" cy="124" r="13" fill="none" stroke="#10234b" stroke-width="2"></circle>
          <text x="402" y="104" font-size="12" font-weight="600" fill="#0f1b33" style="font-family: 'IBM Plex Sans', sans-serif;">T1 · 75 kVA</text>
          <text x="402" y="119" font-size="10" fill="#4c5a70">13,2 kV / 208-120 V</text>
          <rect x="402" y="127" width="124" height="22" rx="4" fill="#fff4d6" stroke="#fab219" stroke-width="1"></rect>
          ${glifoSvg('warning', 415, 138, 14)}
          <text x="427" y="142" font-size="10.5" font-weight="600" fill="#0f1b33" style="font-family: 'IBM Plex Sans', sans-serif;">78 % · Carga alta</text>
          <rect x="364" y="170" width="28" height="20" rx="3" fill="#ffffff" stroke="#10234b" stroke-width="1.5"></rect>
          <text x="${X}" y="183.5" text-anchor="middle" font-size="8.5" fill="#10234b">kWh</text>
          <text x="402" y="184" font-size="11" fill="#4c5a70" style="font-family: 'IBM Plex Sans', sans-serif;">Medidor principal</text>
          ${interruptor(X, 214)}
          <text x="392" y="218" font-size="10" fill="#4c5a70">225 A</text>
          <path d="M78 252H678" stroke="#10234b" stroke-width="6" stroke-linecap="round"></path>
          <text x="78" y="222" font-size="12" font-weight="600" fill="#0f1b33" style="font-family: 'IBM Plex Sans', sans-serif;">TG · Tablero general</text>
          <text x="78" y="238" font-size="10" fill="#4c5a70">3F · 208/120 V</text>
          <rect x="530" y="222" width="148" height="22" rx="4" fill="#fff4d6" stroke="#fab219" stroke-width="1"></rect>
          ${glifoSvg('warning', 543, 233, 14)}
          <text x="555" y="237" font-size="10.5" font-weight="600" fill="#0f1b33" style="font-family: 'IBM Plex Sans', sans-serif;">162 A de 225 A · 72 %</text>
          ${alimentadores}
          ${flujos}
        </svg>`;
}

function paginaUnifilar() {
  const pestanas = ['Unifilar', 'Tableros', 'Desbalance de fases', 'Espacios'].map((t, i) => `<span style="padding: 10px 14px; font-size: 14px;${i === 0 ? ' margin-bottom: -1px; border-bottom: 2px solid #10234b; font-weight: 600;' : ' color: #5c6a80;'}">${t}</span>`).join('');
  const dato = (k, v) => `<div style="display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid #e3e8ef; font-size: 13px;"><span style="color: #4c5a70;">${k}</span><span class="num" style="font-weight: 600; text-align: right;">${v}</span></div>`;
  const hallazgo = (nivel, titulo, texto) => `<div style="display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid #e3e8ef;">${glifo(nivel, 18)}<div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 13px; font-weight: 600;">${titulo}</span><span style="font-size: 12px; line-height: 1.4; color: #4c5a70;">${texto}</span></div></div>`;
  const leyenda = `
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; padding-top: 10px; border-top: 1px solid #e3e8ef; font-size: 12px; color: #4c5a70;">
          <span style="font-weight: 600; color: #0f1b33;">Carga frente a la capacidad</span>
          <span style="display: flex; align-items: center; gap: 6px;">${glifo('good', 14)}Menos de 60 %: normal</span>
          <span style="display: flex; align-items: center; gap: 6px;">${glifo('warning', 14)}60 a 80 %: alta</span>
          <span style="display: flex; align-items: center; gap: 6px;">${glifo('serious', 14)}Más de 80 %: crítica</span>
          <span style="display: flex; align-items: center; gap: 6px; margin-left: auto;"><span style="width: 22px; height: 0; border-top: 2px dashed #22a056;"></span>Flujo de energía</span>
        </div>`;
  const detalle = `
      <section style="display: flex; flex-direction: column; gap: 12px; width: 348px; flex-shrink: 0; padding: 16px; box-sizing: border-box; background: #ffffff; border: 1px solid #dbe1ea; border-radius: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: #eef1f5; color: #10234b;">${icon('transformer', 20)}</div>
          <div style="display: flex; flex-direction: column; gap: 1px;"><span style="font-size: 15px; font-weight: 600;">Transformador T1</span><span class="mono" style="font-size: 10px; letter-spacing: 0.08em; color: #5c6a80;">SELECCIONADO EN EL UNIFILAR</span></div>
        </div>
        <svg width="240" height="136" viewBox="0 0 240 136" style="display: block; align-self: center;">
          <path d="M30 116A90 90 0 0 1 210 116" fill="none" stroke="#fdebb8" stroke-width="14" stroke-linecap="round"></path>
          <path d="M30 116A90 90 0 0 1 189.3 58.6" fill="none" stroke="#fab219" stroke-width="14" stroke-linecap="round"></path>
          <text x="120" y="102" text-anchor="middle" font-size="34" font-weight="600" fill="#0f1b33" style="font-family: 'IBM Plex Sans', sans-serif;">78 %</text>
          <text x="120" y="126" text-anchor="middle" font-size="12" fill="#5c6a80" style="font-family: 'IBM Plex Sans', sans-serif;">de 75 kVA en hora pico</text>
        </svg>
        <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;">${glifo('warning', 16)}Carga alta: poco margen para nuevas cargas</span>
        <div style="display: flex; flex-direction: column;">
          ${dato('Demanda máxima', '58,5 kVA')}
          ${dato('Potencia activa', '53,8 kW · FP 0,92')}
          ${dato('Hora pico', '12 mar 2026 · 10:45')}
          ${dato('Tensiones', '13,2 kV / 208-120 V')}
          ${dato('Año de fabricación', '2009')}
        </div>
        <span class="mono" style="padding-top: 4px; font-size: 10px; letter-spacing: 0.08em; color: #5c6a80;">HALLAZGOS DEL SISTEMA ELÉCTRICO</span>
        <div style="display: flex; flex-direction: column;">
          ${hallazgo('serious', 'TC-1 al 87 % de su protección', 'Redistribuir cargas o ampliar el alimentador de climatización.')}
          ${hallazgo('warning', 'Transformador al 78 % en hora pico', 'Revisar antes de agregar equipos nuevos.')}
          ${hallazgo('warning', 'Desbalance de 12 % en TA-2', 'Reubicar circuitos monofásicos entre fases.')}
        </div>
        <span style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 40px; margin-top: auto; border-radius: 8px; background: #eef1f5; color: #10234b; font-size: 13px; font-weight: 600;">${icon('send', 16)}Enviar al diagnóstico</span>
      </section>`;
  return pantalla('dimensionamiento', `
    ${barraSuperior('BLOQUE 6 / ANÁLISIS / DIMENSIONAMIENTO', 'Carga instalada frente a la capacidad', botonClaro('download', 'Exportar diagrama'))}
    <div style="display: flex; gap: 4px; border-bottom: 1px solid #dbe1ea;">${pestanas}</div>
    <div style="display: flex; gap: 16px; min-height: 0;">
      <section style="display: flex; flex-direction: column; gap: 10px; flex-grow: 1; min-width: 0; padding: 12px; box-sizing: border-box; background: #ffffff; border: 1px solid #dbe1ea; border-radius: 10px;">${diagramaUnifilar()}${leyenda}
      </section>${detalle}
    </div>`);
}

// ---------- PGEE: oportunidades y matriz de priorización (PC) ----------
function matriz() {
  const W = 416, H = 380, L = 56, R = 12, T = 16, B = 48, pw = W - L - R, ph = H - T - B, base = T + ph;
  const xs = (v) => L + (pw * v) / 40;
  const ys = (v) => T + ph * (1 - v / 10);
  let rejilla = '';
  for (const v of [2, 4, 6, 8, 10]) rejilla += `<line x1="${L}" y1="${r1(ys(v))}" x2="${W - R}" y2="${r1(ys(v))}" stroke="#eef1f5" stroke-width="1"></line><text x="${L - 8}" y="${r1(ys(v) + 3.5)}" text-anchor="end" font-size="10" fill="#7a879b">${v}</text>`;
  rejilla += `<text x="${L - 8}" y="${base + 3.5}" text-anchor="end" font-size="10" fill="#7a879b">0</text>`;
  let marcasX = '';
  for (const v of [0, 10, 20, 30, 40]) marcasX += `<text x="${r1(xs(v))}" y="${base + 16}" text-anchor="middle" font-size="10" fill="#7a879b">${v}</text>`;
  const qx = xs(12), qy = ys(4);
  const puntos = MEDIDAS.filter((m) => m.sel).map((m) => `<circle cx="${r1(xs(m.inv))}" cy="${r1(ys(m.ah))}" r="7" fill="${m.col}" stroke="#ffffff" stroke-width="2"></circle><text x="${r1(xs(m.inv) + 11)}" y="${r1(ys(m.ah) + 4)}" font-size="11" font-weight="600" fill="#0f1b33">${m.c}</text>`).join('');
  return `
        <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display: block; overflow: visible; font-family: 'IBM Plex Mono', ui-monospace, monospace;">
          ${rejilla}
          <line x1="${L}" y1="${base}" x2="${W - R}" y2="${base}" stroke="#c5cfdc" stroke-width="1"></line>
          <line x1="${L}" y1="${T}" x2="${L}" y2="${base}" stroke="#c5cfdc" stroke-width="1"></line>
          <line x1="${r1(qx)}" y1="${T}" x2="${r1(qx)}" y2="${base}" stroke="#c5cfdc" stroke-width="1"></line>
          <line x1="${L}" y1="${r1(qy)}" x2="${W - R}" y2="${r1(qy)}" stroke="#c5cfdc" stroke-width="1"></line>
          <g font-size="10" font-weight="600" fill="#7a879b" style="font-family: 'IBM Plex Sans', sans-serif;">
            <text x="${L + 6}" y="${T + 14}">Rápidas</text>
            <text x="${r1(qx + 6)}" y="${T + 14}">Estratégicas</text>
            <text x="${L + 6}" y="${base - 8}">Complementarias</text>
            <text x="${r1(qx + 6)}" y="${base - 8}">Por revisar</text>
          </g>
          ${puntos}
          ${marcasX}
          <text x="${r1(L + pw / 2)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#4c5a70" style="font-family: 'IBM Plex Sans', sans-serif;">Inversión (millones de COP)</text>
          <text x="14" y="${r1(T + ph / 2)}" text-anchor="middle" font-size="11" fill="#4c5a70" transform="rotate(-90 14 ${r1(T + ph / 2)})" style="font-family: 'IBM Plex Sans', sans-serif;">Ahorro anual (millones de COP)</text>
        </svg>`;
}

function paginaPgee() {
  const COLS = '24px minmax(0, 1fr) 96px 72px 68px 72px 100px';
  const prioridad = {
    Alta: 'background: #10234b; color: #ffffff;',
    Media: 'background: #e8eef8; color: #10234b;',
    'En evaluación': 'background: #ffffff; color: #4c5a70; box-shadow: inset 0 0 0 1px #c9d3df;',
  };
  const fila = (m) => {
    const marca = m.sel
      ? `<span style="display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 4px; background: #187f44; color: #ffffff;">${icon('check', 14, 'stroke-width: 2.4;')}</span>`
      : '<span style="width: 18px; height: 18px; box-sizing: border-box; border-radius: 4px; border: 1.5px solid #c9d3df;"></span>';
    return `
          <div style="display: grid; grid-template-columns: ${COLS}; align-items: center; gap: 8px; padding: 9px 0; border-top: 1px solid #e3e8ef; color: ${m.sel ? '#0f1b33' : '#5c6a80'};">
            ${marca}
            <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
              <span class="mono" style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #5c6a80;"><span style="width: 8px; height: 8px; border-radius: 50%; background: ${m.col};"></span>${m.c}</span>
              <span style="font-size: 13px; font-weight: 500; line-height: 1.3;">${m.n}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 1px; text-align: right;"><span class="num" style="font-size: 13px; font-weight: 600;">${m.kwh ? fmt(m.kwh) + ' kWh' : 'Reactiva'}</span><span class="num" style="font-size: 11px; color: #5c6a80;">$${fmt(m.ah, 1)} M/año</span></div>
            <span class="num" style="font-size: 13px; text-align: right;">$${fmt(m.inv, 1)} M</span>
            <span class="num" style="font-size: 13px; text-align: right;">${fmt(m.ret, 1)} años</span>
            <span class="num" style="font-size: 13px; text-align: right;">$${fmt(m.vpn, 1)} M</span>
            <span style="justify-self: end; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; ${prioridad[m.pr]}">${m.pr}</span>
          </div>`;
  };
  const sel = MEDIDAS.filter((m) => m.sel);
  const tot = {
    kwh: sel.reduce((s, m) => s + (m.kwh || 0), 0),
    ah: sel.reduce((s, m) => s + m.ah, 0),
    inv: sel.reduce((s, m) => s + m.inv, 0),
    vpn: sel.reduce((s, m) => s + m.vpn, 0),
  };
  const encabezado = ['', 'MEDIDA', 'AHORRO', 'INVERSIÓN', 'RETORNO', 'VPN', 'PRIORIDAD']
    .map((t, i) => `<span class="mono" style="font-size: 10px; letter-spacing: 0.06em; color: #5c6a80;${i >= 2 ? ' text-align: right;' : ''}">${t}</span>`).join('');
  const resumen = `
    <div style="display: grid; grid-template-columns: 360px repeat(5, minmax(0, 1fr)); background: #ffffff; border: 1px solid #dbe1ea; border-radius: 10px;">
      <div style="display: flex; flex-direction: column; gap: 8px; padding: 14px 18px;">
        <span class="mono" style="font-size: 10px; letter-spacing: 0.08em; color: #5c6a80;">META DEL PGEE</span>
        <div style="display: flex; align-items: baseline; gap: 8px;"><span style="font-size: 26px; font-weight: 600; line-height: 1;">16,8 %</span><span style="font-size: 13px; color: #4c5a70;">de ahorro sobre la línea base</span></div>
        <div style="position: relative; height: 30px;">
          <span class="mono" style="position: absolute; left: 60%; top: 0; transform: translateX(-50%); font-size: 10px; color: #0f1b33;">META 15 %</span>
          <div style="position: absolute; left: 0; right: 0; top: 17px; height: 10px; border-radius: 5px; background: #d9eee1;"></div>
          <div style="position: absolute; left: 0; width: 67.2%; top: 17px; height: 10px; border-radius: 5px; background: #22a056;"></div>
          <div style="position: absolute; left: calc(60% - 1px); top: 13px; width: 2px; height: 18px; background: #10234b;"></div>
        </div>
        <span style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;">${glifo('good', 14)}Meta alcanzada con 6 medidas</span>
      </div>${[
        ['AHORRO DE ENERGÍA', `${fmt(tot.kwh)}${unidad('kWh/año')}`],
        ['AHORRO ANUAL', `$${fmt(tot.ah, 1)} M`],
        ['INVERSIÓN', `$${fmt(tot.inv, 1)} M`],
        ['RETORNO SIMPLE', `${fmt(tot.inv / tot.ah, 1)}${unidad('años')}`],
        ['CO₂ EVITADO', `3,9${unidad('t/año')}`],
      ].map(([k, v]) => `
      <div style="display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 14px 16px; border-left: 1px solid #e3e8ef;"><span class="mono" style="font-size: 10px; letter-spacing: 0.08em; color: #5c6a80;">${k}</span><span style="font-size: 22px; font-weight: 600; line-height: 1.1;">${v}</span></div>`).join('')}
    </div>`;
  const leyenda = `<div style="display: flex; flex-wrap: wrap; gap: 8px 14px;">${clavePunto('#2a78d6', 'Climatización')}${clavePunto('#eda100', 'Iluminación')}${clavePunto('#008300', 'TI y oficina')}${clavePunto('#898781', 'Otros')}</div>`;
  return pantalla('oportunidades', `
    ${barraSuperior('BLOQUE 6 / PLAN', 'Oportunidades de ahorro', botonClaro('download', 'Exportar') + botonPrimario('plus', 'Nueva medida'))}
    ${resumen}
    <div style="display: grid; grid-template-columns: 448px minmax(0, 1fr); gap: 16px;">${tarjeta(`${encabezadoTarjeta('Matriz de priorización', 'MEDIDAS SELECCIONADAS', verTabla)}${leyenda}${matriz()}`)}${tarjeta(`${encabezadoTarjeta('Medidas evaluadas', '7 MEDIDAS', verTabla)}
        <div style="display: flex; flex-direction: column;">
          <div style="display: grid; grid-template-columns: ${COLS}; gap: 8px; padding-bottom: 8px;">${encabezado}</div>${MEDIDAS.map(fila).join('')}
          <div style="display: grid; grid-template-columns: ${COLS}; align-items: center; gap: 8px; padding-top: 10px; border-top: 1px solid #0f1b33; font-weight: 600;">
            <span></span><span style="font-size: 13px;">6 medidas seleccionadas</span>
            <div style="display: flex; flex-direction: column; gap: 1px; text-align: right;"><span class="num" style="font-size: 13px;">${fmt(tot.kwh)} kWh</span><span class="num" style="font-size: 11px; font-weight: 500; color: #5c6a80;">$${fmt(tot.ah, 1)} M/año</span></div>
            <span class="num" style="font-size: 13px; text-align: right;">$${fmt(tot.inv, 1)} M</span>
            <span class="num" style="font-size: 13px; text-align: right;">${fmt(tot.inv / tot.ah, 1)} años</span>
            <span class="num" style="font-size: 13px; text-align: right;">$${fmt(tot.vpn, 1)} M</span>
            <span></span>
          </div>
        </div>`)}
    </div>
    <span style="font-size: 12px; color: #5c6a80;">VPN a 10 años con tasa de descuento del 12 % y tarifa de 850 COP/kWh. El factor de emisión es configurable en el proyecto.</span>`);
}

// ---------- Informe Word (dirección C) ----------
const MARCA_C = '<svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="#10234b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 22.5c0-8.8 5.6-14.4 16-15 0 10-5.6 15.6-14.4 15.6"></path><path d="M15.2 10.2l-3.8 5.2h3l-1.1 3.7 3.9-5.2h-3z" fill="#22a056" stroke="#22a056" stroke-width="1"></path></svg>';
const hoja = (contenido) => `
<div style="display: flex; flex-direction: column; width: 794px; height: 1123px; box-sizing: border-box; padding: 56px 80px 48px; background: #ffffff; color: #16223b; font-family: 'Public Sans', 'Segoe UI', system-ui, sans-serif;">${contenido}
</div>`;
const encabezadoInforme = `
  <div style="display: flex; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 1px solid #dcd5c6; font-size: 12px; color: #6f6857;">
    <span style="font-weight: 600; letter-spacing: 0.12em;">INFORME DE AUDITORÍA ENERGÉTICA · BLOQUE 6</span>
    <span>Universidad de La Guajira</span>
  </div>`;
const piePagina = (n) => `
  <div style="display: flex; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid #dcd5c6; font-size: 12px; color: #6f6857;">
    <span>PONTIA · Bloque 6 · Versión 1.0</span>
    <span class="num">${n}</span>
  </div>`;
const tituloSeccion = (n, texto) => `
  <div style="display: flex; align-items: baseline; gap: 14px; margin-top: 34px;">
    <span class="serif" style="font-size: 44px; font-weight: 500; line-height: 1; color: #187f44;">${n}</span>
    <span class="serif" style="font-size: 32px; font-weight: 500; line-height: 1.1; color: #10234b;">${texto}</span>
  </div>`;

function curvaPortada() {
  const W = 634, T = 10, ph = 120, base = T + ph;
  const xs = (h) => (h * W) / 23;
  const ys = (v) => T + ph * (1 - v / 55);
  const pares = LABORABLE.map((v, h) => `${r1(xs(h))},${r1(ys(v))}`);
  const area = `M0 ${base} L${pares.join(' L')} L${W} ${base} Z`;
  const finde = FIN_SEMANA.map((v, h) => `${r1(xs(h))},${r1(ys(v))}`).join(' ');
  return `<svg width="${W}" height="${base + 2}" viewBox="0 0 ${W} ${base + 2}" style="display: block;">
      <path d="${area}" fill="#eef2f8"></path>
      <polyline points="${finde}" fill="none" stroke="#c9c0ad" stroke-width="1.5" stroke-linejoin="round"></polyline>
      <polyline points="${pares.join(' ')}" fill="none" stroke="#10234b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
      <line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="#c9c0ad" stroke-width="1"></line>
    </svg>`;
}

function portada() {
  const meta = [
    ['CLIENTE', 'Universidad de La Guajira'],
    ['PERIODO ANALIZADO', 'Octubre 2025 – septiembre 2026'],
    ['NORMA DE REFERENCIA', 'ISO 50002 · ISO 50001'],
    ['ELABORADO POR', '[Nombre del auditor]'],
    ['FECHA DE ENTREGA', '[Fecha de entrega]'],
    ['VERSIÓN', '1.0'],
  ].map(([k, v]) => `
      <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 12px; font-weight: 600; letter-spacing: 0.12em; color: #6f6857;">${k}</span><span style="font-size: 16px;">${v}</span></div>`).join('');
  return `
<div style="display: flex; flex-direction: column; width: 794px; height: 1123px; box-sizing: border-box; padding: 0 80px 48px; background: #ffffff; color: #16223b; font-family: 'Public Sans', 'Segoe UI', system-ui, sans-serif;">
  <div style="height: 8px; margin: 0 -80px; background: #10234b;"></div>
  <div style="display: flex; align-items: flex-start; justify-content: space-between; padding-top: 48px;">
    <div style="display: flex; align-items: center; gap: 10px;">${MARCA_C}
      <div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-size: 13px; font-weight: 700; letter-spacing: 0.16em; color: #10234b;">PONTIA</span><span style="font-size: 12px; color: #6f6857;">Auditoría y eficiencia energética</span></div>
    </div>
    <div style="display: flex; align-items: center; justify-content: center; width: 160px; height: 64px; box-sizing: border-box; border: 1.5px dashed #c9c0ad; border-radius: 6px; font-size: 12px; color: #6f6857;">[Logo del cliente]</div>
  </div>
  <div style="display: flex; flex-direction: column; gap: 18px; margin-top: 190px;">
    <span style="font-size: 13px; font-weight: 600; letter-spacing: 0.16em; color: #187f44;">INFORME DE AUDITORÍA ENERGÉTICA</span>
    <span class="serif" style="font-size: 56px; font-weight: 500; line-height: 1.05; color: #10234b;">Bloque 6 · Aulas y laboratorios</span>
    <span class="serif" style="font-size: 22px; font-style: italic; color: #4f5667;">Universidad de La Guajira — Riohacha, La Guajira</span>
  </div>
  <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 52px;">${curvaPortada()}
    <span class="serif" style="align-self: flex-end; font-size: 14px; font-style: italic; color: #6f6857;">Curva de carga típica de un día laborable</span>
  </div>
  <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 40px; margin-top: auto; padding-top: 28px; border-top: 1px solid #dcd5c6;">${meta}
  </div>
  <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 28px; font-size: 12px; color: #6f6857;">
    <span style="display: flex; align-items: center; gap: 10px;"><span style="width: 40px; height: 2px; background: #22a056;"></span>Documento generado con PONTIA</span>
    <span>Uso exclusivo del cliente</span>
  </div>
</div>`;
}

function barrasInforme() {
  const W = 634, H = 236, L = 50, R = 6, T = 34, B = 34, pw = W - L - R, ph = H - T - B, base = T + ph, slot = pw / 12, ancho = 22;
  const ys = (v) => T + ph * (1 - v / 20000);
  let franjas = '';
  for (const i of [2, 8]) {
    franjas += `<rect x="${r1(L + i * slot)}" y="${T}" width="${r1(2 * slot)}" height="${ph}" fill="#f3efe6"></rect><text x="${r1(L + (i + 1) * slot)}" y="${T - 10}" text-anchor="middle" font-size="12" font-style="italic" fill="#6f6857" style="font-family: 'Newsreader', Georgia, serif;">vacaciones</text>`;
  }
  const rejilla = [5000, 10000, 15000].map((v) => `<line x1="${L}" y1="${r1(ys(v))}" x2="${W - R}" y2="${r1(ys(v))}" stroke="#e7e1d4" stroke-width="1"></line><text x="${L - 8}" y="${r1(ys(v) + 4)}" text-anchor="end" font-size="12" fill="#6f6857">${fmt(v)}</text>`).join('');
  const barras = ACTUAL.map((v, i) => `<path d="${trazoBarra(L + i * slot + (slot - ancho) / 2, ys(v), ancho, base)}"></path>`).join('');
  const meses = MESES.map((m, i) => `<text x="${r1(L + i * slot + slot / 2)}" y="${base + 20}" text-anchor="middle" font-size="12" fill="#6f6857">${m}</text>`).join('');
  const xm = L + 7 * slot + slot / 2;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display: block; overflow: visible; font-family: 'Public Sans', sans-serif;">
      ${franjas}
      ${rejilla}
      <text x="${L - 8}" y="${base + 4}" text-anchor="end" font-size="12" fill="#6f6857">0</text>
      <line x1="${L}" y1="${base}" x2="${W - R}" y2="${base}" stroke="#c9c0ad" stroke-width="1"></line>
      <g fill="#2a78d6">${barras}</g>
      <text x="${r1(xm)}" y="${r1(ys(18300) - 7)}" text-anchor="middle" font-size="12" font-weight="600" fill="#16223b">18.300</text>
      ${meses}
    </svg>`;
}

function paginaInformeConsumo() {
  const cols = 'minmax(0, 1.1fr) 104px 104px minmax(0, 1.5fr)';
  const filas = USOS.map((u) => `
      <div style="display: grid; grid-template-columns: ${cols}; align-items: center; gap: 12px; padding: 7px 0; border-top: 1px solid #e7e1d4; font-size: 16px;">
        <span style="display: flex; align-items: center; gap: 8px;"><span style="width: 10px; height: 10px; flex-shrink: 0; border-radius: 2px; background: ${u.c};"></span>${u.n}</span>
        <span class="num" style="text-align: right;">${fmt(u.kwh)}</span>
        <span class="num" style="text-align: right;">${u.p} %</span>
        <span style="font-size: 14px; color: #4f5667;">${u.eq}</span>
      </div>`).join('');
  return hoja(`${encabezadoInforme}${tituloSeccion('3', 'Comportamiento del consumo')}
  <p style="margin: 20px 0 0; font-size: 16px; line-height: 1.6; color: #2b3242;">Entre octubre de 2025 y septiembre de 2026 el Bloque 6 consumió 186.400 kWh, un 4,2 % menos que en el periodo anterior. El consumo sigue el calendario académico: en vacaciones cae cerca de un 30 % y el pico llega en mayo, con 18.300 kWh. La climatización es el principal uso significativo de energía, con el 51 % del total.</p>
  <figure style="display: flex; flex-direction: column; gap: 10px; margin: 26px 0 0;">
    ${barrasInforme()}
    <figcaption class="serif" style="font-size: 14px; font-style: italic; line-height: 1.45; color: #4f5667;">Figura 3. Consumo mensual facturado entre octubre de 2025 y septiembre de 2026, en kWh. Las franjas marcan los periodos de vacaciones.</figcaption>
  </figure>
  <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 26px;">
    <span class="serif" style="font-size: 14px; font-style: italic; color: #4f5667;">Tabla 4. Consumo estimado por uso final a partir del censo de carga.</span>
    <div style="display: flex; flex-direction: column; border-top: 2px solid #16223b; border-bottom: 2px solid #16223b;">
      <div style="display: grid; grid-template-columns: ${cols}; gap: 12px; padding: 8px 0; font-size: 13px; font-weight: 600; color: #6f6857;"><span>Uso final</span><span style="text-align: right;">kWh/año</span><span style="text-align: right;">Participación</span><span>Equipos principales</span></div>${filas}
      <div style="display: grid; grid-template-columns: ${cols}; align-items: center; gap: 12px; padding: 7px 0; border-top: 1px solid #16223b; font-size: 16px; font-weight: 600;"><span>Total</span><span class="num" style="text-align: right;">186.400</span><span class="num" style="text-align: right;">100 %</span><span></span></div>
    </div>
  </div>${piePagina('12')}`);
}

function paginaInformeHallazgos() {
  const NIVEL_TXT = { critical: 'Crítico', serious: 'Alto', warning: 'Medio' };
  const hallazgos = [
    ['critical', 'Tablero TC-1 al 87 % de su protección', 'El alimentador de climatización opera cerca de su límite; hay riesgo de disparos y sobrecalentamiento.', 'Fotos 10 y 11'],
    ['serious', 'Aires acondicionados subdimensionados en las aulas 601 a 604', 'La carga térmica estimada supera en 15 % la capacidad instalada; los equipos no se detienen en horas pico.', 'Fotos 7 y 8'],
    ['warning', 'Iluminación insuficiente con tecnología T8', 'Se midieron 312 lux frente a 500 lux requeridos en aulas; operan 412 tubos fluorescentes.', 'Foto 9'],
  ].map(([n, t, d, f]) => `
    <div style="display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 16px; padding: 12px 0; border-top: 1px solid #e7e1d4;">
      <span style="display: flex; align-items: center; gap: 6px; align-self: start; padding-top: 2px; font-size: 13px; font-weight: 600;">${glifo(n, 16)}${NIVEL_TXT[n]}</span>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 16px; font-weight: 600;">${t}</span>
        <span style="font-size: 16px; line-height: 1.5; color: #2b3242;">${d}</span>
        <span class="serif" style="font-size: 14px; font-style: italic; color: #6f6857;">${f}</span>
      </div>
    </div>`).join('');
  const fotos = [
    ['7', 'Unidad exterior AC-A601-01 con el filtro obstruido.'],
    ['8', 'Placa del mini-split de 18.000 BTU/h.'],
    ['9', 'Luminaria 2×32 W T8 del aula 603.'],
    ['10', 'Tablero TC-1 con protecciones de 110 A.'],
    ['11', 'Medición de corriente en el alimentador de TC-1.'],
    ['12', 'Bombas de agua de 3 HP del cuarto técnico.'],
  ].map(([n, t]) => `
      <figure style="display: flex; flex-direction: column; gap: 8px; margin: 0;">
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; height: 128px; border-radius: 4px; background: #efeae0; color: #a39a86; font-size: 12px;">${icon('camera', 26)}<span>[Foto ${n}]</span></div>
        <figcaption class="serif" style="font-size: 14px; font-style: italic; line-height: 1.4; color: #4f5667;">Foto ${n}. ${t}</figcaption>
      </figure>`).join('');
  return hoja(`${encabezadoInforme}${tituloSeccion('6', 'Hallazgos y evidencia fotográfica')}
  <p style="margin: 20px 0 0; font-size: 16px; line-height: 1.6; color: #2b3242;">Durante el levantamiento se tomaron 48 fotografías. Estos son los hallazgos de mayor impacto; el registro completo está en el anexo B.</p>
  <div style="display: flex; flex-direction: column; margin-top: 18px; border-bottom: 1px solid #e7e1d4;">${hallazgos}
  </div>
  <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px 16px; margin-top: 26px;">${fotos}
  </div>${piePagina('15')}`);
}

// ---------- Escritura ----------
const CSS_FLUJO = `
    .flujo { fill: none; stroke: #22a056; stroke-width: 2; stroke-dasharray: 3 9; animation: flujo 1.4s linear infinite; }
    @keyframes flujo { to { stroke-dashoffset: -24; } }
    @media (prefers-reduced-motion: reduce) { .flujo { animation: none; } }`;

escribir('Consumo.dc.html', documento(FUENTES_A, '#eef1f5', paginaConsumo()));
escribir('Unifilar.dc.html', documento(FUENTES_A, '#eef1f5', paginaUnifilar(), CSS_FLUJO));
escribir('PGEE.dc.html', documento(FUENTES_A, '#eef1f5', paginaPgee()));
escribir('InformePortada.dc.html', documento(FUENTES_C, '#ffffff', portada()));
escribir('InformeConsumo.dc.html', documento(FUENTES_C, '#ffffff', paginaInformeConsumo()));
escribir('InformeHallazgos.dc.html', documento(FUENTES_C, '#ffffff', paginaInformeHallazgos()));
