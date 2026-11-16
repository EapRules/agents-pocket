#!/usr/bin/env node
// Renders the App Store panels: each store screen inside an iPhone, with a caption, over one
// gradient that runs across the whole set.
//   node scripts/store-panels.mjs [--locale en] [--size 1206x2622] [--png]
// Reads docs/store/panels/panels.json (order, layout and captions per locale) and the raw screens in
// docs/store/screenshots/<locale>/<name>.jpg; writes docs/store/panels/<locale>/<name>.jpg.
// JPEG because App Store Connect does not process a screenshot with an alpha channel.
// Needs macOS (sips) and a Chromium-family browser; BROWSER_PATH overrides the default Chrome.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, root } from './atlas-lib.mjs';

const DESIGN_W = 1290; // the width store-panels.css is authored at
const storeDir = join(root, 'docs/store');
const browser =
  process.env.BROWSER_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// One motif of color, three panels wide, as [x, y, radius x, radius y, color, solid stop %].
// x is a fraction of the motif's width, y of the panel's height; the rest is pixels.
const MOTIF = [
  [0.04, 0.52, 620, 900, '#050307', 55],
  [0.21, 0.58, 760, 520, '#f08a2c', 0],
  [0.17, 0.36, 1100, 1500, '#e83fd8', 0],
  [0.06, 0.06, 1300, 1100, '#6a2be0', 0],
  [0.37, 0.12, 700, 900, '#050307', 40],
  [0.47, 0.66, 900, 620, '#f2772e', 0],
  [0.5, 0.78, 1400, 1300, '#ee4d9f', 0],
  [0.6, 0.24, 1200, 1200, '#7a35e6', 0],
  [0.71, 0.46, 640, 820, '#050307', 45],
  [0.84, 0.6, 800, 560, '#f08a2c', 0],
  [0.88, 0.38, 1200, 1500, '#e83fd8', 0],
  [0.98, 0.92, 1300, 1100, '#6a2be0', 0],
];

/** The CSS background for a strip of `count` panels: the motif, repeated every three panels. */
export function gradient(count, stageHeight) {
  const motifWidth = DESIGN_W * 3;
  const layers = [];
  for (let start = 0; start < count * DESIGN_W; start += motifWidth) {
    for (const [x, y, rx, ry, color, solid] of MOTIF) {
      const at = `${Math.round(start + x * motifWidth)}px ${Math.round(y * stageHeight)}px`;
      layers.push(
        `radial-gradient(ellipse ${rx}px ${ry}px at ${at}, ${color} 0 ${solid}%, transparent 100%)`,
      );
    }
  }
  return `${layers.join(', ')}, #12061f`;
}

function panelHtml({ css, index, panel, text, screen, locale }) {
  const { center = false, width = 1000, top = 880, tilt = 0 } = panel.layout ?? {};
  const subline = text.subline ? `<p>${text.subline}</p>` : '';
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="stage" style="--index:${index}">
<div class="canvas"></div><div class="shade"></div><div class="grain"></div>
<div class="caption${center ? ' center' : ''}"><h1>${text.headline}</h1>${subline}</div>
<div class="phone" style="--w:${width}px;--top:${top}px;--tilt:${tilt}deg">
<i class="key l k1"></i><i class="key l k2"></i><i class="key l k3"></i><i class="key r k4"></i><i class="key r k5"></i>
<div class="bezel"><div class="screen"><img src="${pathToFileURL(screen).href}" alt=""><div class="island"></div></div></div>
</div>
</div></body></html>`;
}

function render({ config, locale, size, keepPng }) {
  const [outW, outH] = size;
  const zoom = outW / DESIGN_W;
  const stageH = Math.ceil(outH / zoom);
  const fonts = pathToFileURL(join(root, 'apps/site/node_modules/@fontsource')).href;
  const face = (family, style, weight, file) =>
    `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: ${weight}; src: url("${fonts}/${file}") format("woff2"); }`;
  const css = [
    face(
      'Instrument Serif',
      'normal',
      400,
      'instrument-serif/files/instrument-serif-latin-400-normal.woff2',
    ),
    face(
      'Instrument Serif',
      'italic',
      400,
      'instrument-serif/files/instrument-serif-latin-400-italic.woff2',
    ),
    face(
      'Instrument Sans',
      'normal',
      500,
      'instrument-sans/files/instrument-sans-latin-500-normal.woff2',
    ),
    `:root { --out-w: ${outW}px; --out-h: ${outH}px; --stage-h: ${stageH}px; --zoom: ${zoom}; --strip-w: ${DESIGN_W * config.panels.length}px; --gradient: ${gradient(config.panels.length, stageH)}; }`,
    readFileSync(join(import.meta.dirname, 'store-panels.css'), 'utf8'),
  ].join('\n');
  const outDir = join(storeDir, 'panels', locale);
  mkdirSync(outDir, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'store-panels-'));
  try {
    for (const [index, panel] of config.panels.entries()) {
      const screen = join(storeDir, 'screenshots', locale, `${panel.name}.jpg`);
      if (!existsSync(screen)) throw new Error(`missing screen ${screen}`);
      const text = panel[locale];
      if (!text?.headline) throw new Error(`${panel.name} has no "${locale}" headline`);
      const html = join(work, `${panel.name}.html`);
      const png = join(keepPng ? outDir : work, `${panel.name}.png`);
      writeFileSync(html, panelHtml({ css, index, panel, text, screen, locale }));
      execFileSync(
        browser,
        [
          '--headless=new',
          '--disable-gpu',
          '--hide-scrollbars',
          '--allow-file-access-from-files',
          '--force-device-scale-factor=1',
          `--window-size=${outW},${outH}`,
          `--screenshot=${png}`,
          pathToFileURL(html).href,
        ],
        { stdio: 'ignore' },
      );
      const jpg = join(outDir, `${panel.name}.jpg`);
      execFileSync(
        'sips',
        ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', png, '--out', jpg],
        {
          stdio: 'ignore',
        },
      );
      console.log(`ok ${locale}/${panel.name}.jpg ${outW}x${outH}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const { options } = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(join(storeDir, 'panels/panels.json'), 'utf8'));
  const size = (typeof options.size === 'string' ? options.size.split('x') : config.size).map(
    Number,
  );
  const locales = typeof options.locale === 'string' ? [options.locale] : config.locales;
  if (!existsSync(browser)) {
    console.error(`ERROR no browser at ${browser}; set BROWSER_PATH`);
    process.exit(2);
  }
  try {
    for (const locale of locales) render({ config, locale, size, keepPng: options.png === true });
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exit(1);
  }
}
