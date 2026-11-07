import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  buildCssArgs,
  checkAdrs,
  checkAppShell,
  checkCacheName,
  checkDexie,
  checkMarkdownLinks,
  extractHeadingSlugs,
  extractLinks,
  findIpv4,
  forbiddenTrackedPaths,
  parseAppShell,
  parseArgs,
  parseCacheName,
  scanAbsolutePaths,
  scanForbiddenPatterns,
  scanHexColors,
  scanSecrets,
  slugifyHeading,
  stripJsComments,
  stripSourceMapLine,
} from '../scripts/check-repo.js';

// Testwerte werden zur Laufzeit zusammengesetzt, damit weder der Secret-Scan des
// Repo-Checks noch ein externer Scanner diese Datei selbst als Fund wertet.
// Es kommen nur erfundene Werte vor (Dokumentations-Adressbereiche, .invalid).
const ip = (...octets) => octets.join('.');
const levels = (findings) => findings.map((f) => f.level);

const sw = (name, files) =>
  `const CACHE_NAME = '${name}';\n\nconst APP_SHELL = [\n  './',\n${files.map((f) => `  './${f}',`).join('\n')}\n];\n`;

// --- Prüfung 1 -------------------------------------------------------------

test('parseAppShell: liest Pfade samt Zeile, lässt die Wurzel "./" aus', () => {
  const entries = parseAppShell(sw('fitlog-v1', ['index.html', 'js/app.js']));
  assert.deepEqual(entries, [
    { path: 'index.html', line: 5 },
    { path: 'js/app.js', line: 6 },
  ]);
});

test('checkAppShell: meldet fehlende und überzählige Einträge, respektiert Ausnahmen', () => {
  const entries = [{ path: 'js/a.js', line: 5 }, { path: 'js/weg.js', line: 6 }];
  const out = checkAppShell({
    present: ['js/a.js', 'js/neu.js', 'css/tailwind.input.css'],
    entries,
    exists: (p) => p !== 'js/weg.js',
    ignored: ['css/tailwind.input.css'],
  });
  assert.equal(out.length, 2);
  assert.match(out[0].message, /fehlt in APP_SHELL/);
  assert.equal(out[0].file, 'js/neu.js');
  assert.equal(out[1].line, 6);
  assert.deepEqual(levels(out), ['FEHLER', 'FEHLER']);
});

test('checkAppShell: vollständige Shell ergibt keine Befunde', () => {
  assert.deepEqual(checkAppShell({ present: ['js/a.js'], entries: [{ path: 'js/a.js', line: 1 }], exists: () => true }), []);
});

// --- Prüfung 2 -------------------------------------------------------------

test('parseCacheName: erkennt Zahl, Zeile und falsches Format', () => {
  assert.deepEqual(parseCacheName(sw('fitlog-v259', [])), { name: 'fitlog-v259', num: 259, line: 1 });
  assert.equal(parseCacheName(sw('fitlog-259', [])).num, null);
  assert.equal(parseCacheName('const x = 1;'), null);
});

test('checkCacheName: geänderte Shell-Datei ohne Hochzählen ist ein Fehler', () => {
  const files = ['js/a.js'];
  const out = checkCacheName({ baseSw: sw('fitlog-v10', files), currentSw: sw('fitlog-v10', files), changedFiles: ['js/a.js'] });
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'FEHLER');
  assert.match(out[0].message, /js\/a\.js/);
});

test('checkCacheName: Hochzählen genügt, ebenso keine Shell-Änderung', () => {
  const files = ['js/a.js'];
  assert.deepEqual(checkCacheName({ baseSw: sw('fitlog-v10', files), currentSw: sw('fitlog-v11', files), changedFiles: ['js/a.js'] }), []);
  assert.deepEqual(checkCacheName({ baseSw: sw('fitlog-v10', files), currentSw: sw('fitlog-v10', files), changedFiles: ['README.md', 'docs/x.md'] }), []);
});

test('checkCacheName: kleinere Zahl und geänderte Datei-Liste werden erkannt', () => {
  const out = checkCacheName({ baseSw: sw('fitlog-v10', ['js/a.js']), currentSw: sw('fitlog-v9', ['js/a.js']), changedFiles: ['js/a.js'] });
  assert.equal(out[0].level, 'FEHLER');
  const list = checkCacheName({ baseSw: sw('fitlog-v10', ['js/a.js']), currentSw: sw('fitlog-v10', ['js/a.js', 'js/b.js']), changedFiles: [] });
  assert.equal(list[0].level, 'FEHLER');
  assert.match(list[0].message, /APP_SHELL-Liste/);
});

test('checkCacheName: falsches Format ist immer ein Fehler', () => {
  const out = checkCacheName({ baseSw: sw('fitlog-v10', []), currentSw: sw('fitlog-neu', []), changedFiles: [] });
  assert.match(out[0].message, /Format/);
});

// --- Prüfung 3 und 4 -------------------------------------------------------

test('buildCssArgs: ersetzt nur die Ausgabedatei', () => {
  const args = buildCssArgs('tailwindcss -c a.js -i in.css -o css/tailwind.css --minify', '/tmp/x.css');
  assert.deepEqual(args, ['-c', 'a.js', '-i', 'in.css', '-o', '/tmp/x.css', '--minify']);
  assert.equal(buildCssArgs('echo hallo', '/tmp/x.css'), null);
  assert.equal(buildCssArgs('tailwindcss -i in.css', '/tmp/x.css'), null);
});

test('stripSourceMapLine: gleicht die npm-Datei mit der eingecheckten ab', () => {
  const vendor = 'code();\n';
  const npm = 'code();\n//# sourceMappingURL=dexie.min.js.map';
  assert.equal(stripSourceMapLine(npm), stripSourceMapLine(vendor));
});

test('checkDexie: erkennt Abweichung und Versionsdrift', () => {
  const ok = checkDexie({ vendorText: 'v4.4.7;\n', npmText: 'v4.4.7;\n//# sourceMappingURL=x.map', specVersion: '4.4.7', installedVersion: '4.4.7' });
  assert.deepEqual(ok, []);
  const bad = checkDexie({ vendorText: 'alt;\n', npmText: 'neu;\n', specVersion: '4.5.0', installedVersion: '4.4.7' });
  assert.equal(bad.filter((f) => f.level === 'FEHLER').length, 2);
});

// --- Prüfung 5 -------------------------------------------------------------

test('findIpv4: erfasst fremde Adressen, ignoriert lokale und Versionsnummern', () => {
  assert.deepEqual(findIpv4(`Server ${ip(10, 0, 0, 1)}:8420`), [ip(10, 0, 0, 1)]);
  assert.deepEqual(findIpv4(`${ip(127, 0, 0, 1)} und ${ip(0, 0, 0, 0)}`), []);
  assert.deepEqual(findIpv4(`Wert ${ip(999, 1, 1, 1)}`), []);
  assert.deepEqual(findIpv4('Version 1.2.3 und v1.2.3.4.5'), []);
});

test('scanSecrets: erkennt die allgemeinen Muster mit Zeilennummer', () => {
  const text = [
    'harmlos',
    `Adresse ${ip(192, 0, 2, 7)}`,
    `host: pi.beispiel.invalid`,
    `https://knoten.beispiel.ts` + `.net/`,
    'ssh:' + '//nutzer@beispiel.invalid',
    'ssh ' + 'nutzer@beispiel.invalid',
    '-----BEGIN ' + 'OPENSSH PRIVATE KEY-----',
    'token ghp_' + 'a'.repeat(30),
    'github_pat_' + 'b'.repeat(30),
    'pass' + 'word: geheim',
  ].join('\n');
  const out = scanSecrets(text, 'x.md');
  assert.deepEqual(out.map((f) => f.line), [2, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(out.every((f) => f.level === 'FEHLER' && f.file === 'x.md'));
});

test('scanSecrets: Platzhalter-Muster und Begriffe ohne Konkretisierung sind erlaubt', () => {
  const text = 'Tailscale auf dem Raspberry Pi, Zertifikat für die *.ts' + '.net-Adresse, Ping an 127.0.0.1';
  assert.deepEqual(scanSecrets(text, 'docs/x.md'), []);
});

test('scanSecrets: Allowlist greift nur für Datei und Muster', () => {
  const text = `Adresse ${ip(192, 0, 2, 7)}`;
  assert.equal(scanSecrets(text, 'a.md', [{ file: 'a.md', id: 'ipv4', reason: 'Test' }]).length, 0);
  assert.equal(scanSecrets(text, 'b.md', [{ file: 'a.md', id: 'ipv4', reason: 'Test' }]).length, 1);
});

// --- Prüfung 6 -------------------------------------------------------------

test('forbiddenTrackedPaths: meldet Dateien, die nicht ins Repo gehören', () => {
  const out = forbiddenTrackedPaths(['js/app.js', '.DS_Store', 'icons/.DS_Store', '.claude/settings.json', 'drafts/media/a.png', 'clip.MP4', 'node_modules/x/y.js']);
  assert.deepEqual(out.map((f) => f.file), ['.DS_Store', 'icons/.DS_Store', '.claude/settings.json', 'drafts/media/a.png', 'clip.MP4', 'node_modules/x/y.js']);
});

test('scanAbsolutePaths: erkennt lokale Benutzerpfade, nicht Platzhalter', () => {
  assert.equal(scanAbsolutePaths('Pfad: /Users/' + 'beispiel/Projekt/x', 'a.md').length, 1);
  assert.equal(scanAbsolutePaths('C:\\Users\\' + 'beispiel\\x', 'a.md').length, 1);
  assert.equal(scanAbsolutePaths('Pfad: /Users/<name>/Projekt', 'a.md').length, 0);
});

// --- Prüfung 7 -------------------------------------------------------------

test('slugifyHeading und extractHeadingSlugs: GitHub-Regeln inklusive Duplikaten', () => {
  assert.equal(slugifyHeading('View-Pattern'), 'view-pattern');
  assert.equal(slugifyHeading('Löschen & `Kaskaden` (ADR)'), 'löschen--kaskaden-adr');
  const slugs = extractHeadingSlugs('# Titel\n\n## Abschnitt\n\n```\n# kein Heading\n```\n\n## Abschnitt\n');
  assert.deepEqual([...slugs], ['titel', 'abschnitt', 'abschnitt-1']);
});

test('extractLinks: ignoriert Codeblöcke und Inline-Code, erfasst Titel und Bilder', () => {
  const md = ['[a](x.md)', '`[b](y.md)`', '```', '[c](z.md)', '```', '![d](bild.png "Titel")', '[e](<mit leer.md>)'].join('\n');
  assert.deepEqual(extractLinks(md), [
    { target: 'x.md', line: 1 },
    { target: 'bild.png', line: 6 },
    { target: 'mit leer.md', line: 7 },
  ]);
});

test('checkMarkdownLinks: fehlende Datei ist Fehler, fehlender Anker Warnung, Extern wird übersprungen', () => {
  const files = new Set(['docs/a.md', 'docs/b.md', 'README.md']);
  const slugs = { 'docs/b.md': new Set(['da']), 'docs/a.md': new Set(['oben']) };
  const text = [
    '[ok](b.md#da)',
    '[extern](https://beispiel.invalid/x)',
    '[fehlt](weg.md)',
    '[anker](b.md#nein)',
    '[eigener](#oben)',
    '[eigener kaputt](#unten)',
    '[hoch](../README.md)',
  ].join('\n');
  const out = checkMarkdownLinks({ file: 'docs/a.md', text, exists: (p) => files.has(p), headingSlugs: (p) => slugs[p] ?? null });
  assert.deepEqual(out.map((f) => [f.line, f.level]), [[3, 'FEHLER'], [4, 'WARNUNG'], [6, 'WARNUNG']]);
});

// --- Prüfung 8 -------------------------------------------------------------

const adr = (n, status, name = 'x') => ({ file: `docs/decisions/${String(n).padStart(4, '0')}-${name}.md`, text: `# ADR\n\n**Status:** ${status}\n` });

test('checkAdrs: saubere Reihe ist ohne Befund', () => {
  const out = checkAdrs([adr(1, 'Überholt durch [ADR 0002](0002-x.md)'), adr(2, 'Gültig'), adr(3, 'Teilweise überholt durch [ADR 0002](0002-x.md) (Detail)')]);
  assert.deepEqual(out, []);
});

test('checkAdrs: Lücke, Dublette, fehlende Statuszeile und tote Verweise', () => {
  const out = checkAdrs([
    adr(1, 'Gültig'),
    adr(3, 'Gültig'),
    adr(3, 'Gültig', 'zweites'),
    { file: 'docs/decisions/0004-ohne.md', text: '# ADR ohne Status\n' },
    adr(5, 'Überholt durch [ADR 0099](0099-x.md)'),
    adr(6, 'Irgendwas'),
    adr(7, 'Überholt durch [ADR 0007](0007-x.md)'),
  ]);
  const msgs = out.map((f) => f.message).join('\n');
  assert.match(msgs, /0002 fehlt/);
  assert.match(msgs, /doppelt/);
  assert.match(msgs, /Statuszeile .* fehlt/);
  assert.match(msgs, /nicht vorhandenes ADR 0099/);
  assert.match(msgs, /Schlüsselwörter/);
  assert.match(msgs, /sich selbst/);
});

test('checkAdrs: ohne jede Statuszeile nur eine Warnung (Konvention noch nicht eingeführt)', () => {
  const out = checkAdrs([{ file: 'docs/decisions/0001-a.md', text: '# A\n' }, { file: 'docs/decisions/0002-b.md', text: '# B\n' }]);
  assert.deepEqual(levels(out), ['WARNUNG']);
});

// --- Prüfungen 9 und 10 ----------------------------------------------------

test('stripJsComments: Zeilen/Spalten bleiben, Kommentare weg, Strings/Templates/Regex unberührt', () => {
  const src = [
    "const a = 'http://beispiel.invalid'; // alert(1)",
    '/* confirm(x)',
    '   mehrzeilig */ const b = `x ${f(`// kein Kommentar`)} y`;',
    'const c = s.replace(/["\']/g, "") + 1 / 2; // Ende',
  ].join('\n');
  const out = stripJsComments(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split('\n').length, 4);
  assert.ok(out.includes("'http://beispiel.invalid'"));
  assert.ok(out.includes('`// kein Kommentar`'));
  assert.ok(out.includes('/["\']/g'));
  assert.ok(!out.includes('alert'));
  assert.ok(!out.includes('confirm'));
  assert.ok(!out.includes('Ende'));
});

test('stripJsComments: alle echten App-Dateien bleiben längen- und zeilentreu', () => {
  const dirs = ['js', 'js/views'];
  for (const dir of dirs) {
    for (const f of readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((n) => n.endsWith('.js'))) {
      const src = readFileSync(new URL(`../${dir}/${f}`, import.meta.url), 'utf8');
      const out = stripJsComments(src);
      assert.equal(out.length, src.length, `${dir}/${f}: Länge`);
      assert.equal(out.split('\n').length, src.split('\n').length, `${dir}/${f}: Zeilen`);
    }
  }
});

test('scanForbiddenPatterns: Dialoge/debugger sind Fehler, Rest Warnung, Kommentare zählen nicht', () => {
  const code = [
    "if (confirm('Sicher?')) go();",
    'window.alert(1);',
    "const t = 'Bestätigung'; // confirm('x') ist hier nur ein Kommentar",
    'const ok = await confirmDelete(1);',
    'debugger;',
    'console.log(1); console.error(2); console.warn(3);',
    '// TODO: später',
    'obj.prompt(1);',
  ].join('\n');
  const out = scanForbiddenPatterns(code, 'js/x.js');
  assert.deepEqual(out.map((f) => [f.line, f.level]), [[1, 'FEHLER'], [2, 'FEHLER'], [5, 'FEHLER'], [6, 'WARNUNG'], [7, 'WARNUNG']]);
});

test('scanHexColors: JS-Strings zählen, Kommentare, Entities und CSS-Selektoren nicht', () => {
  const js = ["const bg = '#363636';", "// Mirror: '#404040'", "const e = '&#39;'; const id = '#add-btn';"].join('\n');
  assert.deepEqual(scanHexColors(js, 'js/x.js').map((f) => f.line), [1]);

  const css = ['#add { margin: 0; }', 'a { color: #B5EB98; /* #fff */ }', '.x { background: #123; }'].join('\n');
  assert.deepEqual(scanHexColors(css, 'css/styles.css').map((f) => f.line), [2, 3]);
});

test('scanHexColors: rgb()/rgba() mit festen Zahlen zählen, Weiß/Schwarz und Variablen nicht', () => {
  const css = [
    '.a { background: rgba(37, 37, 37, 0.55); }',
    '.b { background: rgb(var(--rgb-surface) / 0.55); }',
    '.c { border: 1px solid rgba(255, 255, 255, 0.12); }',
    '.d { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); }',
    '.e { color: rgb(181 235 152 / 0.7); }',
  ].join('\n');
  assert.deepEqual(scanHexColors(css, 'css/styles.css').map((f) => f.line), [1, 5]);
});

test('scanHexColors: Allowlist nimmt einen Wert aus (Groß-/Kleinschreibung egal)', () => {
  const css = '.x { color: #B5EB98; }';
  assert.equal(scanHexColors(css, 'css/styles.css', { allowlist: [{ value: '#b5eb98', reason: 'Test' }] }).length, 0);
});

// --- Optionen --------------------------------------------------------------

test('parseArgs: Schalter, Basis-Stand und unbekannte Optionen', () => {
  assert.deepEqual(parseArgs([]), { base: 'origin/main', fast: false, withTests: false, help: false, unknown: [] });
  const o = parseArgs(['--schnell', '--mit-tests', '--basis=HEAD~3', '--quatsch']);
  assert.equal(o.fast, true);
  assert.equal(o.withTests, true);
  assert.equal(o.base, 'HEAD~3');
  assert.deepEqual(o.unknown, ['--quatsch']);
});
