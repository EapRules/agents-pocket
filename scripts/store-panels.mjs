#!/usr/bin/env node
// Renders the App Store panels: each store screen inside an iPhone, with a caption, over one
// gradient that runs across the whole set.
//   node scripts/store-panels.mjs [--locale en] [--size 1206x2622] [--png] [--safe]
// Reads docs/store/panels/panels.json (order, layout and captions per locale) and the raw screens in
// docs/store/screenshots/<locale>/<name>.jpg; writes docs/store/panels/<locale>/<name>.jpg.
// The same file lists the wide art (`art`: the product page header and the search results image),
// rendered at its own size with the same look; --safe outlines Apple's art safe area on it.
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

/**
 * The CSS background for a strip `width` px wide: the motif, repeated every `motifWidth`.
 * `scaleY` shrinks the blobs' height for art shorter than a panel.
 */
export function gradient(width, height, motifWidth = DESIGN_W * 3, scaleY = 1) {
  const layers = [];
  for (let start = 0; start < width; start += motifWidth) {
    for (const [x, y, rx, ry, color, solid] of MOTIF) {
      const at = `${Math.round(start + x * motifWidth)}px ${Math.round(y * height)}px`;
      layers.push(
        `radial-gradient(ellipse ${rx}px ${Math.round(ry * scaleY)}px at ${at}, ${color} 0 ${solid}%, transparent 100%)`,
      );
    }
  }
  return `${layers.join(', ')}, #12061f`;
}

const FONT_FILES = [
  [
    'Instrument Serif',
    'normal',
    400,
    'instrument-serif/files/instrument-serif-latin-400-normal.woff2',
  ],
  [
    'Instrument Serif',
    'italic',
    400,
    'instrument-serif/files/instrument-serif-latin-400-italic.woff2',
  ],
  [
    'Instrument Sans',
    'normal',
    500,
    'instrument-sans/files/instrument-sans-latin-500-normal.woff2',
  ],
];

/** store-panels.css with its custom properties set and the @font-face rules in front. */
function stylesheet({ outW, outH, stageW, stageH, zoom, stripW, background }) {
  const fonts = pathToFileURL(join(root, 'apps/site/node_modules/@fontsource')).href;
  const faces = FONT_FILES.map(
    ([family, style, weight, file]) =>
      `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: ${weight}; src: url("${fonts}/${file}") format("woff2"); }`,
  );
  return [
    ...faces,
    `:root { --out-w: ${outW}px; --out-h: ${outH}px; --stage-w: ${stageW}px; --stage-h: ${stageH}px; --zoom: ${zoom}; --strip-w: ${stripW}px; --gradient: ${background}; }`,
    readFileSync(join(import.meta.dirname, 'store-panels.css'), 'utf8'),
  ].join('\n');
}

const screenFile = (locale, name) => {
  const file = join(storeDir, 'screenshots', locale, `${name}.jpg`);
  if (!existsSync(file)) throw new Error(`missing screen ${file}`);
  return file;
};

const SLANT = 9; // how far each cut leans, in % of the screen's width
const CUT = 0.4; // the line between two slices, same unit

/** The screen's images: one, or several cut into slanted slices of the same screen (one per theme). */
function screenImages(screens) {
  const img = (file, style = '') =>
    `<img src="${pathToFileURL(file).href}" alt=""${style ? ` style="${style}"` : ''}>`;
  if (screens.length === 1) return img(screens[0]);
  return screens
    .map((file, index) => {
      const from = index === 0 ? -50 : (index / screens.length) * 100 + CUT / 2;
      const to =
        index === screens.length - 1 ? 150 : ((index + 1) / screens.length) * 100 - CUT / 2;
      const cut = `polygon(${from + SLANT}% 0, ${to + SLANT}% 0, ${to - SLANT}% 100%, ${from - SLANT}% 100%)`;
      return img(file, `clip-path:${cut}`);
    })
    .join('');
}

/** One iPhone showing `screens`; `left` is its centre (the middle of the stage when absent). */
function phoneHtml(screens, { width = 1000, top = 880, tilt = 0, left }) {
  const place = left === undefined ? '' : `--left:${left}px;`;
  return `<div class="phone" style="${place}--w:${width}px;--top:${top}px;--tilt:${tilt}deg">
<i class="key l k1"></i><i class="key l k2"></i><i class="key l k3"></i><i class="key r k4"></i><i class="key r k5"></i>
<div class="bezel"><div class="screen${screens.length > 1 ? ' split' : ''}">${screenImages(screens)}<div class="island"></div></div></div>
</div>`;
}

const captionHtml = (text, className, style = '') =>
  `<div class="${className}"${style ? ` style="${style}"` : ''}><h1>${text.headline}</h1>${text.subline ? `<p>${text.subline}</p>` : ''}</div>`;

const page = (locale, css, stage) =>
  `<!doctype html>\n<html lang="${locale}"><head><meta charset="utf-8"><style>${css}</style></head>\n<body>${stage}</body></html>`;

/** Writes `html` to a file, captures it at the output size and saves the JPEG. */
function shoot({ work, name, html, size, outDir, keepPng }) {
  const [outW, outH] = size;
  const file = join(work, `${name}.html`);
  const png = join(keepPng ? outDir : work, `${name}.png`);
  writeFileSync(file, html);
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
      pathToFileURL(file).href,
    ],
    { stdio: 'ignore' },
  );
  const jpg = join(outDir, `${name}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', png, '--out', jpg], {
    stdio: 'ignore',
  });
}

const textFor = (item, locale) => {
  if (!item[locale]?.headline) throw new Error(`${item.name} has no "${locale}" headline`);
  return item[locale];
};

function renderPanels({ config, locale, size, work, outDir, keepPng }) {
  const [outW, outH] = size;
  const zoom = outW / DESIGN_W;
  const stageH = Math.ceil(outH / zoom);
  const stripW = DESIGN_W * config.panels.length;
  const css = stylesheet({
    outW,
    outH,
    stageW: DESIGN_W,
    stageH,
    zoom,
    stripW,
    background: gradient(stripW, stageH),
  });
  for (const [index, panel] of config.panels.entries()) {
    const layout = panel.layout ?? {};
    const stage = `<div class="stage" style="--index:${index}">
<div class="canvas"></div><div class="shade"></div><div class="grain"></div>
${captionHtml(textFor(panel, locale), layout.center ? 'caption center' : 'caption')}
${phoneHtml(
  (panel.screens ?? [panel.name]).map((name) => screenFile(locale, name)),
  layout,
)}
</div>`;
    shoot({ work, name: panel.name, html: page(locale, css, stage), size, outDir, keepPng });
    console.log(`ok ${locale}/${panel.name}.jpg ${outW}x${outH}`);
  }
}

/** The wide art: its own size, a caption placed by hand and any number of phones. */
function renderArt({ config, locale, work, outDir, keepPng, showSafe }) {
  for (const art of config.art ?? []) {
    const [outW, outH] = art.size;
    const css = stylesheet({
      outW,
      outH,
      stageW: outW,
      stageH: outH,
      zoom: 1,
      stripW: outW,
      background: gradient(outW, outH, outW, outH / 2796),
    });
    const { x, y, width, center = false, h1, p = 52 } = art.caption;
    const place = `--x:${x}px;--y:${y}px;--cw:${width}px;--h1:${h1}px;--p:${p}px`;
    const [sx, sy, sw, sh] = art.safe;
    const safe = showSafe
      ? `<div class="safe" style="left:${sx}px;top:${sy}px;width:${sw}px;height:${sh}px"></div>`
      : '';
    const stage = `<div class="stage" style="--index:0">
<div class="canvas"></div><div class="grain"></div>
<div class="spot" style="left:${x - width * 0.25}px;top:${sy - sh * 0.4}px;width:${width * 1.5}px;height:${sh * 1.8}px"></div>
${art.phones.map((phone) => phoneHtml([screenFile(locale, phone.screen)], phone)).join('\n')}
${captionHtml(textFor(art, locale), center ? 'caption free center' : 'caption free', place)}
${safe}
</div>`;
    shoot({
      work,
      name: art.name,
      html: page(locale, css, stage),
      size: art.size,
      outDir,
      keepPng,
    });
    console.log(`ok ${locale}/${art.name}.jpg ${outW}x${outH}`);
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
  const work = mkdtempSync(join(tmpdir(), 'store-panels-'));
  try {
    for (const locale of locales) {
      const outDir = join(storeDir, 'panels', locale);
      mkdirSync(outDir, { recursive: true });
      const shared = { config, locale, work, outDir, keepPng: options.png === true };
      renderPanels({ ...shared, size });
      renderArt({ ...shared, showSafe: options.safe === true });
    }
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
