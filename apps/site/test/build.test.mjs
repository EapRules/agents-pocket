import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { build, ORIGIN, PRIVACY_URL, THREE_FILE, themeVariables } from '../scripts/build.mjs';

const temp = () => mkdtempSync(join(tmpdir(), 'site-'));

function installer(script) {
  const dir = temp();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'install.sh'), script);
  writeFileSync(join(dir, 'install.ps1'), script);
  return dir;
}

test('theme colors become kebab-case custom properties', () => {
  assert.equal(
    themeVariables({ colors: { textPrimary: '#FFF', canvas: '#000' } }),
    '--text-primary: #FFF; --canvas: #000;',
  );
});

test('pages are filled from the tokens and link the relay policy', () => {
  const out = join(temp(), 'dist');
  build({ out, installerDir: temp() });
  for (const page of ['index.html', '404.html']) {
    const html = readFileSync(join(out, page), 'utf8');
    assert.doesNotMatch(
      html,
      /\{\{\w+\}\}|\/\* (DARK|LIGHT) \*\//,
      `${page} has an unfilled placeholder`,
    );
    assert.match(html, /--accent: #[0-9A-F]{6};/);
  }
  assert.match(readFileSync(join(out, 'index.html'), 'utf8'), new RegExp(PRIVACY_URL));
  assert.equal(readFileSync(join(out, '_redirects'), 'utf8'), `/privacy ${PRIVACY_URL} 302\n`);
});

test('the installer stays unpublished while it names the placeholder repository', () => {
  const out = join(temp(), 'dist');
  assert.deepEqual(build({ out, installerDir: installer('REPO=OWNER/agentico-app\n') }), {
    installer: false,
  });
  assert.doesNotMatch(readFileSync(join(out, 'index.html'), 'utf8'), /install\.sh/);
});

test('a real installer is published as plain text and shown on the page', () => {
  const out = join(temp(), 'dist');
  assert.deepEqual(
    build({ out, installerDir: installer('REPO=openagentspocket/agentico-app\n') }),
    {
      installer: true,
    },
  );
  assert.equal(
    readFileSync(join(out, 'install.sh'), 'utf8'),
    'REPO=openagentspocket/agentico-app\n',
  );
  assert.match(
    readFileSync(join(out, '_headers'), 'utf8'),
    /\/install\.sh\n {2}Content-Type: text\/plain/,
  );
  assert.match(
    readFileSync(join(out, 'index.html'), 'utf8'),
    /curl -fsSL https:\/\/openagentspocket\.com\/install\.sh \| sh/,
  );
});

test('dist carries the hero scene, its field and the vendored three, with long-lived caching', () => {
  const out = join(temp(), 'dist');
  build({ out, installerDir: temp() });
  for (const file of ['hero/main.js', 'hero/field.png', 'og.jpg', THREE_FILE]) {
    assert.ok(existsSync(join(out, file)), `${file} is missing from dist`);
  }
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /<script type="module" src="\/hero\/main\.js">/);
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/openagentspocket\.com\/og\.jpg">/,
  );
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="apple-itunes-app" content="app-id=6834077869">/);
  assert.ok(
    html.includes(`"three":"/${THREE_FILE}"`),
    'the import map points at the vendored three',
  );
  assert.ok(readdirSync(join(out, 'fonts')).every((name) => name.endsWith('.woff2')));
  const headers = readFileSync(join(out, '_headers'), 'utf8');
  for (const path of ['/vendor/\\*', '/fonts/\\*']) {
    assert.match(headers, new RegExp(`${path}\\n {2}Cache-Control: .*immutable`));
  }
});

test('the page and the scene call no origin but the site, the relay policy, the App Store and GitHub', () => {
  const out = join(temp(), 'dist');
  build({ out, installerDir: installer('REPO=openagentspocket/agentico-app\n') });
  const allowed = new Set([
    new URL(ORIGIN).host,
    new URL(PRIVACY_URL).host,
    'apps.apple.com',
    'github.com',
  ]);
  const sources = [
    readFileSync(join(out, 'index.html'), 'utf8'),
    ...readdirSync(join(out, 'hero'))
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(join(out, 'hero', name), 'utf8')),
  ];
  const hosts = sources.flatMap((text) => [...text.matchAll(/(?:https?:)?\/\/([\w.-]+)/g)]);
  assert.ok(hosts.length > 0);
  for (const [match, host] of hosts) {
    assert.ok(allowed.has(host), `${match} is not an allowed origin`);
  }
  assert.doesNotMatch(sources[0], /fonts\.googleapis|cdn\.jsdelivr|data:image/);
});
