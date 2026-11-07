// Repo-Prüfskript (reines Dev-Werkzeug, nicht Teil der App-Auslieferung, nicht in APP_SHELL).
//
// Fängt automatisch ab, was kein Datentest bemerkt: vergessenes CACHE_NAME-Hochzählen,
// veraltetes tailwind.css, versehentlich eingecheckte Infrastruktur-Details im
// öffentlichen Repo, tote Doku-Links usw. Nur Node-Bordmittel, kein Netzwerk,
// Schreibzugriffe ausschließlich in ein temporäres Verzeichnis.
//
// Aufruf: npm run check [-- --schnell] [-- --mit-tests] [-- --basis=<git-ref>]
// Die Prüfungen selbst sind kleine, reine Funktionen (Text rein, Befunde raus) und in
// tests/check-repo.test.js getestet; nur die Funktionen unter "Ausführung" fassen
// Dateisystem, git oder Prozesse an.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BASE = 'origin/main';

// ---------------------------------------------------------------------------
// Konfiguration und Allowlists. Jeder Eintrag braucht eine Begründung.
// ---------------------------------------------------------------------------

// Dateien, die absichtlich nicht in der App-Shell stehen.
const APP_SHELL_UNCACHED = [
  // Eingabedatei für den einmaligen Tailwind-Build, wird nie ausgeliefert.
  'css/tailwind.input.css',
];

// Erzeugte bzw. fremde Dateien: nicht auf Secrets/Pfade scannen, nicht auf Stilregeln prüfen.
const GENERATED_FILE = /^(css\/tailwind\.css|js\/vendor\/)/;

// Bekannte Falschtreffer des Secret-Scans: { file, id, reason }.
const SECRET_ALLOWLIST = [];

// Erlaubte Hex-Farben in js/ und css/styles.css: { value (klein), reason }.
const HEX_ALLOWLIST = [];

// Statuszeilen-Schlüsselwörter in ADRs. "Abgeschlossen" steht nicht in der Konvention aus
// CLAUDE.md, wird aber vom bestehenden ADR 0024 (zurückgebauter Testmodus) verwendet.
const ADR_STATUS_WORDS = ['Gültig', 'Überholt', 'Teilweise überholt', 'Abgeschlossen'];

const SECRET_PATTERNS = [
  // Erst ab einem Namensteil vor ".ts.net": das Platzhalter-Muster "*.ts.net" in der Doku ist kein Hostname.
  { id: 'tailnet-host', label: 'Tailscale-Hostname', re: /[A-Za-z0-9-]\.ts\.net\b/ },
  { id: 'ssh-url', label: 'SSH-URL', re: /\bssh:\/\// },
  { id: 'ssh-command', label: 'SSH-Aufruf mit Benutzer@Host', re: /\bssh\s+(?:-\S+\s+)*[\w.-]+@[\w.-]+/ },
  { id: 'private-key', label: 'privater Schlüssel', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'github-token', label: 'GitHub-Token', re: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { id: 'password', label: 'Passwort-Zuweisung', re: /\bpassword\s*[:=]\s*\S+/i },
];

// ---------------------------------------------------------------------------
// Befunde
// ---------------------------------------------------------------------------

const FEHLER = 'FEHLER';
const WARNUNG = 'WARNUNG';

export const finding = (level, file, line, message) => ({ level, file, line, message });

// ---------------------------------------------------------------------------
// Prüfung 1: App-Shell
// ---------------------------------------------------------------------------

const normalizeShellPath = (p) => p.replace(/^\.\//, '');

/** Liest die APP_SHELL-Liste aus sw.js: [{ path, line }]; './' (Wurzel) wird ausgelassen. */
export function parseAppShell(swText) {
  const lines = swText.split('\n');
  const start = lines.findIndex((l) => /const APP_SHELL\s*=\s*\[/.test(l));
  if (start < 0) return [];
  const entries = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*\]/.test(lines[i])) break;
    const m = lines[i].match(/^\s*'([^']+)'/);
    if (m && normalizeShellPath(m[1]) !== '') entries.push({ path: normalizeShellPath(m[1]), line: i + 1 });
  }
  return entries;
}

/** present: Dateien, die in der App-Shell stehen müssten; exists(path): Datei vorhanden? */
export function checkAppShell({ present, entries, exists, ignored = APP_SHELL_UNCACHED }) {
  const out = [];
  const listed = new Set(entries.map((e) => e.path));
  for (const file of present) {
    if (!listed.has(file) && !ignored.includes(file)) {
      out.push(finding(FEHLER, file, null, 'fehlt in APP_SHELL (sw.js), wird offline nicht ausgeliefert'));
    }
  }
  for (const e of entries) {
    if (!exists(e.path)) out.push(finding(FEHLER, 'sw.js', e.line, `APP_SHELL-Eintrag "${e.path}" zeigt auf keine vorhandene Datei`));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prüfung 2: CACHE_NAME
// ---------------------------------------------------------------------------

/** { name, num, line } oder null, wenn keine Zuweisung gefunden wurde; num ist null bei falschem Format. */
export function parseCacheName(swText) {
  const lines = swText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*const CACHE_NAME\s*=\s*'([^']*)'/);
    if (m) {
      const v = m[1].match(/^fitlog-v(\d+)$/);
      return { name: m[1], num: v ? Number(v[1]) : null, line: i + 1 };
    }
  }
  return null;
}

/** Dateien der alten oder neuen App-Shell in der Änderungsliste, plus Kennzeichen für geänderte Liste. */
export function changedShellFiles(baseEntries, currentEntries, changedFiles) {
  const paths = new Set([...baseEntries, ...currentEntries].map((e) => e.path));
  const hit = changedFiles.filter((f) => paths.has(f));
  const a = new Set(baseEntries.map((e) => e.path));
  const b = new Set(currentEntries.map((e) => e.path));
  const listChanged = a.size !== b.size || [...a].some((p) => !b.has(p));
  if (listChanged) hit.push('APP_SHELL-Liste');
  return hit;
}

export function checkCacheName({ baseSw, currentSw, changedFiles }) {
  const cur = parseCacheName(currentSw);
  if (!cur) return [finding(FEHLER, 'sw.js', null, 'CACHE_NAME nicht gefunden')];
  if (cur.num === null) {
    return [finding(FEHLER, 'sw.js', cur.line, `CACHE_NAME "${cur.name}" hat nicht das Format fitlog-v<Zahl>`)];
  }
  const changed = changedShellFiles(parseAppShell(baseSw), parseAppShell(currentSw), changedFiles);
  if (changed.length === 0) return [];
  const base = parseCacheName(baseSw);
  if (!base || base.num === null) {
    return [finding(WARNUNG, 'sw.js', cur.line, 'CACHE_NAME im Basis-Stand nicht lesbar, Vergleich nicht möglich')];
  }
  if (cur.num > base.num) return [];
  const sample = changed.slice(0, 3).join(', ') + (changed.length > 3 ? ` und ${changed.length - 3} weitere` : '');
  return [finding(FEHLER, 'sw.js', cur.line, `gecachte Dateien geändert (${sample}), aber CACHE_NAME ${cur.name} ist nicht größer als im Basis-Stand (fitlog-v${base.num})`)];
}

// ---------------------------------------------------------------------------
// Prüfung 3: Tailwind-Build
// ---------------------------------------------------------------------------

/** Argumente für tailwindcss aus dem build:css-Skript, Ausgabedatei ersetzt. null, wenn das Skript unbekannt aussieht. */
export function buildCssArgs(script, outPath) {
  const parts = script.trim().split(/\s+/);
  if (parts[0] !== 'tailwindcss') return null;
  const args = parts.slice(1);
  const o = args.indexOf('-o');
  if (o < 0 || !args[o + 1]) return null;
  args[o + 1] = outPath;
  return args;
}

// ---------------------------------------------------------------------------
// Prüfung 4: Dexie-Vendor-Datei
// ---------------------------------------------------------------------------

/**
 * Entfernt die abschließende sourceMappingURL-Zeile, in der sich die npm-Datei von der eingecheckten unterscheidet,
 * und abschließende Leerzeichen/Zeilenumbrüche (die eingecheckte Datei behält den Umbruch vor der entfernten Zeile).
 */
export function stripSourceMapLine(text) {
  return text.replace(/\/\/# sourceMappingURL=[^\n]*\s*$/, '').trimEnd();
}

export function versionMatches(spec, installed) {
  return spec.replace(/^[\^~]/, '') === installed;
}

export function checkDexie({ vendorText, npmText, specVersion, installedVersion }) {
  const out = [];
  if (npmText !== null && stripSourceMapLine(vendorText) !== stripSourceMapLine(npmText)) {
    out.push(finding(FEHLER, 'js/vendor/dexie.min.js', null, 'weicht von node_modules/dexie/dist/dexie.min.js ab (nach Dexie-Update von Hand ersetzen)'));
  }
  if (installedVersion !== null && !versionMatches(specVersion, installedVersion)) {
    out.push(finding(FEHLER, 'package.json', null, `dexie ${specVersion} gefordert, aber ${installedVersion} installiert (npm install ausführen)`));
  }
  if (installedVersion !== null && !vendorText.includes(installedVersion)) {
    out.push(finding(WARNUNG, 'js/vendor/dexie.min.js', null, `enthält die installierte Version ${installedVersion} nicht`));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prüfung 5: Secrets und Infrastruktur-Details
// ---------------------------------------------------------------------------

/** Treffer für IPv4-Adressen außer 127.0.0.1/0.0.0.0, mit Spalte. */
export function findIpv4(line) {
  const hits = [];
  for (const m of line.matchAll(/(?<![\w.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\w|\.\d)/g)) {
    if (m.slice(1).some((o) => Number(o) > 255)) continue;
    if (m[0] === '127.0.0.1' || m[0] === '0.0.0.0') continue;
    hits.push(m[0]);
  }
  return hits;
}

export function scanSecrets(text, file, allowlist = SECRET_ALLOWLIST) {
  const out = [];
  const allowed = (id) => allowlist.some((a) => a.file === file && a.id === id);
  text.split('\n').forEach((line, i) => {
    if (!allowed('ipv4')) {
      for (const ip of findIpv4(line)) out.push(finding(FEHLER, file, i + 1, `IPv4-Adresse ${ip}`));
    }
    for (const p of SECRET_PATTERNS) {
      if (!allowed(p.id) && p.re.test(line)) out.push(finding(FEHLER, file, i + 1, p.label));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Prüfung 6: Dateien, die nicht ins Repo gehören
// ---------------------------------------------------------------------------

const FORBIDDEN_PATHS = [
  { re: /(^|\/)\.claude\//, label: 'lokale Claude-Code-Konfiguration' },
  { re: /(^|\/)\.DS_Store$/, label: 'macOS-Metadatei' },
  { re: /(^|\/)node_modules\//, label: 'Abhängigkeiten' },
  { re: /^drafts\/media\//, label: 'lizenzierte Platzhalter-Medien' },
  { re: /\.mp4$/i, label: 'Videodatei' },
];

export function forbiddenTrackedPaths(files) {
  const out = [];
  for (const file of files) {
    const hit = FORBIDDEN_PATHS.find((p) => p.re.test(file));
    if (hit) out.push(finding(FEHLER, file, null, `gehört nicht ins Repo (${hit.label})`));
  }
  return out;
}

export function scanAbsolutePaths(text, file) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (/\/Users\/[^/\s<>"'`]+\//.test(line) || /[A-Za-z]:\\Users\\[^\\\s]+\\/.test(line)) {
      out.push(finding(FEHLER, file, i + 1, 'absoluter lokaler Benutzerpfad'));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Prüfung 7: Markdown-Links
// ---------------------------------------------------------------------------

/** Anker-Name einer Überschrift nach GitHub-Regeln (klein, Satzzeichen weg, Leerzeichen zu Bindestrichen). */
export function slugifyHeading(text) {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function* markdownLines(md) {
  let fenced = false;
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fenced = !fenced;
      continue;
    }
    if (!fenced) yield { line: i + 1, text: lines[i] };
  }
}

export function extractHeadingSlugs(md) {
  const slugs = new Set();
  const seen = new Map();
  for (const { text } of markdownLines(md)) {
    const m = text.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!m) continue;
    const base = slugifyHeading(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    slugs.add(n === 0 ? base : `${base}-${n}`);
  }
  return slugs;
}

export function extractLinks(md) {
  const links = [];
  const re = /!?\[(?:[^\]\\]|\\.)*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  for (const { line, text } of markdownLines(md)) {
    for (const m of text.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length)).matchAll(re)) {
      links.push({ target: m[1].replace(/^<|>$/g, ''), line });
    }
  }
  return links;
}

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** exists(path): Datei oder Ordner vorhanden; headingSlugs(path): Set der Anker einer .md-Datei oder null. */
export function checkMarkdownLinks({ file, text, exists, headingSlugs }) {
  const out = [];
  for (const { target, line } of extractLinks(text)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
    const [pathAndQuery, rawAnchor] = target.split('#');
    const pathPart = safeDecode(pathAndQuery.split('?')[0]);
    const anchor = rawAnchor === undefined ? null : safeDecode(rawAnchor).toLowerCase();
    const resolved = pathPart === '' ? file : posix.normalize(posix.join(posix.dirname(file), pathPart));
    if (!exists(resolved)) {
      out.push(finding(FEHLER, file, line, `Link auf nicht vorhandene Datei: ${target}`));
      continue;
    }
    if (anchor && resolved.endsWith('.md')) {
      const slugs = headingSlugs(resolved);
      if (slugs && !slugs.has(anchor)) out.push(finding(WARNUNG, file, line, `Anker #${anchor} nicht in ${resolved} gefunden`));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prüfung 8: ADR-Konsistenz
// ---------------------------------------------------------------------------

/** adrs: [{ file, text }] mit Pfaden wie docs/decisions/0001-name.md */
export function checkAdrs(adrs) {
  const out = [];
  const byNumber = new Map();
  for (const adr of adrs) {
    const m = posix.basename(adr.file).match(/^(\d{4})-/);
    if (!m) {
      out.push(finding(FEHLER, adr.file, null, 'Dateiname beginnt nicht mit vierstelliger ADR-Nummer'));
      continue;
    }
    const n = Number(m[1]);
    if (byNumber.has(n)) out.push(finding(FEHLER, adr.file, null, `ADR-Nummer ${m[1]} doppelt (auch ${byNumber.get(n)})`));
    else byNumber.set(n, adr.file);
  }
  const max = Math.max(0, ...byNumber.keys());
  for (let n = 1; n <= max; n++) {
    if (!byNumber.has(n)) out.push(finding(FEHLER, 'docs/decisions', null, `Lücke in der Nummerierung: ${String(n).padStart(4, '0')} fehlt`));
  }

  const statusOf = (adr) => adr.text.split('\n').slice(0, 10).map((l, i) => ({ l, line: i + 1 })).find(({ l }) => /^\*\*Status:\*\*/.test(l));
  if (!adrs.some(statusOf)) {
    out.push(finding(WARNUNG, 'docs/decisions', null, 'kein ADR hat eine Statuszeile (Konvention aus CLAUDE.md noch nicht eingeführt?)'));
    return out;
  }
  for (const adr of adrs) {
    const s = statusOf(adr);
    if (!s) {
      out.push(finding(FEHLER, adr.file, null, 'Statuszeile (**Status:** …) fehlt'));
      continue;
    }
    const value = s.l.replace(/^\*\*Status:\*\*\s*/, '');
    if (!ADR_STATUS_WORDS.some((w) => value.startsWith(w))) {
      out.push(finding(FEHLER, adr.file, s.line, `Status "${value.slice(0, 40)}" beginnt mit keinem der Schlüsselwörter (${ADR_STATUS_WORDS.join(', ')})`));
    }
    if (/^(Teilweise )?[Üü]berholt/.test(value)) {
      const own = Number(posix.basename(adr.file).slice(0, 4));
      for (const ref of value.matchAll(/ADR (\d{4})/g)) {
        const n = Number(ref[1]);
        if (!byNumber.has(n)) out.push(finding(FEHLER, adr.file, s.line, `Verweis auf nicht vorhandenes ADR ${ref[1]}`));
        else if (n === own) out.push(finding(FEHLER, adr.file, s.line, 'ADR verweist auf sich selbst'));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prüfungen 9 und 10: Muster im App-Code
// ---------------------------------------------------------------------------

/** Ersetzt Kommentare durch Leerzeichen (Zeilen und Spalten bleiben erhalten). Strings, Templates und Regex-Literale bleiben unangetastet. */
export function stripJsComments(src) {
  const n = src.length;
  let i = 0;
  let out = '';
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const regexAllowed = () => {
    const tail = out.slice(-24).trimEnd();
    return tail === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(tail) || /\b(?:return|typeof|case|in|of|delete|void|throw|new|else|do)$/.test(tail);
  };
  const copyString = (quote) => {
    out += src[i++];
    while (i < n && src[i] !== quote && src[i] !== '\n') {
      if (src[i] === '\\') out += src[i++];
      if (i < n) out += src[i++];
    }
    if (i < n) out += src[i++];
  };
  const copyRegex = () => {
    let inClass = false;
    out += src[i++];
    while (i < n && src[i] !== '\n') {
      const c = src[i];
      if (c === '\\') {
        out += src[i++];
        if (i < n) out += src[i++];
        continue;
      }
      out += src[i++];
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) break;
    }
  };
  const copyTemplate = () => {
    out += src[i++];
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') {
        out += src[i++];
        if (i < n) out += src[i++];
      } else if (src[i] === '$' && src[i + 1] === '{') {
        out += '${';
        i += 2;
        code(true);
      } else {
        out += src[i++];
      }
    }
    if (i < n) out += src[i++];
  };
  function code(inBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === '/' && d === '/') {
        while (i < n && src[i] !== '\n') {
          out += ' ';
          i++;
        }
      } else if (c === '/' && d === '*') {
        const end = src.indexOf('*/', i + 2);
        const stop = end < 0 ? n : end + 2;
        out += blank(src.slice(i, stop));
        i = stop;
      } else if (c === '"' || c === "'") {
        copyString(c);
      } else if (c === '`') {
        copyTemplate();
      } else if (c === '/' && regexAllowed()) {
        copyRegex();
      } else {
        if (c === '{') depth++;
        if (c === '}') {
          if (inBrace && depth === 0) {
            out += src[i++];
            return;
          }
          depth--;
        }
        out += src[i++];
      }
    }
  }
  code(false);
  return out;
}

export const stripCssComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '));

export function scanForbiddenPatterns(code, file) {
  const out = [];
  const stripped = stripJsComments(code).split('\n');
  stripped.forEach((line, i) => {
    if (/(?:^|[^\w$.]|window\.)(?:confirm|alert|prompt)\s*\(/.test(line)) {
      out.push(finding(FEHLER, file, i + 1, 'nativer Dialog (confirm/alert/prompt), stattdessen showActionSheet()'));
    }
    if (/\bdebugger\b/.test(line)) out.push(finding(FEHLER, file, i + 1, 'debugger-Anweisung'));
    if (/\bconsole\.(?:log|debug)\s*\(/.test(line)) out.push(finding(WARNUNG, file, i + 1, 'console.log/debug im App-Code'));
  });
  // TODO/FIXME stehen per Definition in Kommentaren, daher am Originaltext prüfen.
  code.split('\n').forEach((line, i) => {
    if (/\b(?:TODO|FIXME)\b/.test(line)) out.push(finding(WARNUNG, file, i + 1, 'TODO/FIXME'));
  });
  return out;
}

export function scanHexColors(text, file, { allowlist = HEX_ALLOWLIST } = {}) {
  const isCss = file.endsWith('.css');
  const lines = (isCss ? stripCssComments(text) : stripJsComments(text)).split('\n');
  const out = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(?<![\w&])#([0-9a-fA-F]{3,8})(?![\w-])/g)) {
      if (![3, 4, 6, 8].includes(m[1].length)) continue;
      // In CSS sind "#id"-Selektoren häufig: nur Treffer hinter einem Doppelpunkt (Eigenschaftswert) zählen.
      if (isCss && !line.slice(0, m.index).includes(':')) continue;
      if (allowlist.some((a) => a.value === m[0].toLowerCase())) continue;
      out.push(finding(WARNUNG, file, i + 1, `hartkodierte Farbe ${m[0]} (Token in tailwind.config.js verwenden)`));
    }
    // rgb()/rgba() mit festen Zahlen: nur reines Weiß/Schwarz (neutrale Overlays, Schatten) ist erlaubt;
    // Token-Farben stehen als CSS-Variable da (`rgb(var(--rgb-surface) / 0.55)`).
    for (const m of line.matchAll(/\brgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/g)) {
      const channels = [m[1], m[2], m[3]].map(Number);
      if (channels.every((c) => c === 0) || channels.every((c) => c === 255)) continue;
      out.push(finding(WARNUNG, file, i + 1, `hartkodierte Farbe ${m[0]}) (CSS-Variable --rgb-<token> verwenden)`));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Ausführung: Dateisystem, git, Prozesse
// ---------------------------------------------------------------------------

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function listLines(s) {
  return s === null ? null : s.split('\n').filter(Boolean);
}

function walk(root, rel) {
  const out = [];
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const p = posix.join(rel, entry.name);
    if (entry.isDirectory()) out.push(...walk(root, p));
    else out.push(p);
  }
  return out;
}

function createContext(root, options) {
  const cache = new Map();
  const read = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    let text = null;
    try {
      const buf = readFileSync(join(root, rel));
      text = buf.includes(0) ? null : buf.toString('utf8');
    } catch {
      text = null;
    }
    cache.set(rel, text);
    return text;
  };
  // Getrackte und noch nicht eingecheckte (aber nicht ignorierte) Dateien: so wirkt der Check schon vor dem Commit.
  const listed = listLines(git(root, ['ls-files', '--cached', '--others', '--exclude-standard']));
  const files = [...new Set(listed ?? [])].filter((f) => existsSync(join(root, f))).sort();
  return { root, options, files, read, exists: (rel) => existsSync(join(root, rel)) };
}

const textFiles = (ctx, filter) => ctx.files.filter(filter).filter((f) => ctx.read(f) !== null);

function runAppShell(ctx) {
  const sw = ctx.read('sw.js') ?? '';
  const present = ['index.html', 'manifest.json', ...['js', 'css', 'icons'].flatMap((d) => (ctx.exists(d) ? walk(ctx.root, d) : []))];
  return checkAppShell({ present, entries: parseAppShell(sw), exists: ctx.exists });
}

function runCacheName(ctx) {
  const base = ctx.options.base;
  if (git(ctx.root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]) === null) {
    return [finding(WARNUNG, null, null, `Basis-Stand ${base} nicht verfügbar (Shallow-Clone?), übersprungen`)];
  }
  const baseSw = git(ctx.root, ['show', `${base}:sw.js`]);
  const committed = listLines(git(ctx.root, ['diff', '--name-only', `${base}...HEAD`]));
  if (baseSw === null || committed === null) {
    return [finding(WARNUNG, null, null, `Vergleich mit ${base} nicht möglich (kein gemeinsamer Vorfahre?), übersprungen`)];
  }
  const working = listLines(git(ctx.root, ['diff', '--name-only', 'HEAD'])) ?? [];
  const untracked = listLines(git(ctx.root, ['ls-files', '--others', '--exclude-standard'])) ?? [];
  const changedFiles = [...new Set([...committed, ...working, ...untracked])];
  return checkCacheName({ baseSw, currentSw: ctx.read('sw.js') ?? '', changedFiles });
}

function runTailwind(ctx) {
  const pkg = JSON.parse(ctx.read('package.json'));
  const bin = join(ctx.root, 'node_modules', '.bin', 'tailwindcss');
  if (!existsSync(bin)) return [finding(WARNUNG, null, null, 'tailwindcss nicht installiert (npm install), übersprungen')];
  const tmp = mkdtempSync(join(tmpdir(), 'fitlog-check-'));
  try {
    const outPath = join(tmp, 'tailwind.css');
    const args = buildCssArgs(pkg.scripts?.['build:css'] ?? '', outPath);
    if (!args) return [finding(WARNUNG, 'package.json', null, 'build:css hat unbekanntes Format, übersprungen')];
    execFileSync(bin, args, { cwd: ctx.root, stdio: 'pipe' });
    const fresh = readFileSync(outPath);
    const committed = readFileSync(join(ctx.root, 'css/tailwind.css'));
    return fresh.equals(committed) ? [] : [finding(FEHLER, 'css/tailwind.css', null, 'weicht vom Ergebnis von npm run build:css ab (neu bauen und einchecken)')];
  } catch (err) {
    return [finding(FEHLER, 'css/tailwind.css', null, `Build fehlgeschlagen: ${String(err.stderr ?? err.message).trim().split('\n')[0]}`)];
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function runDexie(ctx) {
  const pkg = JSON.parse(ctx.read('package.json'));
  const specVersion = pkg.devDependencies?.dexie ?? pkg.dependencies?.dexie;
  const npmFile = join(ctx.root, 'node_modules/dexie/dist/dexie.min.js');
  const installedPkg = join(ctx.root, 'node_modules/dexie/package.json');
  if (!specVersion) return [finding(FEHLER, 'package.json', null, 'keine dexie-Abhängigkeit eingetragen')];
  if (!existsSync(npmFile) || !existsSync(installedPkg)) {
    return [finding(WARNUNG, null, null, 'dexie nicht installiert (npm install), übersprungen')];
  }
  return checkDexie({
    vendorText: ctx.read('js/vendor/dexie.min.js') ?? '',
    npmText: readFileSync(npmFile, 'utf8'),
    specVersion,
    installedVersion: JSON.parse(readFileSync(installedPkg, 'utf8')).version,
  });
}

function runSecrets(ctx) {
  return textFiles(ctx, (f) => !GENERATED_FILE.test(f)).flatMap((f) => scanSecrets(ctx.read(f), f));
}

function runUnwanted(ctx) {
  return [
    ...forbiddenTrackedPaths(ctx.files),
    ...textFiles(ctx, (f) => !GENERATED_FILE.test(f)).flatMap((f) => scanAbsolutePaths(ctx.read(f), f)),
  ];
}

function runMarkdownLinks(ctx) {
  const mdFiles = ctx.files.filter((f) => f.endsWith('.md'));
  const slugCache = new Map();
  const headingSlugs = (rel) => {
    if (!slugCache.has(rel)) {
      const text = ctx.read(rel);
      slugCache.set(rel, text === null ? null : extractHeadingSlugs(text));
    }
    return slugCache.get(rel);
  };
  return mdFiles.flatMap((file) => checkMarkdownLinks({ file, text: ctx.read(file) ?? '', exists: ctx.exists, headingSlugs }));
}

function runAdrs(ctx) {
  const dir = 'docs/decisions';
  if (!ctx.exists(dir)) return [finding(FEHLER, dir, null, 'Ordner fehlt')];
  const adrs = readdirSync(join(ctx.root, dir))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: `${dir}/${f}`, text: ctx.read(`${dir}/${f}`) ?? '' }));
  return checkAdrs(adrs);
}

const appJsFiles = (ctx) => textFiles(ctx, (f) => /^js\/.*\.js$/.test(f) && !f.startsWith('js/vendor/'));

function runForbiddenPatterns(ctx) {
  return appJsFiles(ctx).flatMap((f) => scanForbiddenPatterns(ctx.read(f), f));
}

function runHexColors(ctx) {
  return [...appJsFiles(ctx), ...textFiles(ctx, (f) => f === 'css/styles.css')].flatMap((f) => scanHexColors(ctx.read(f), f));
}

function runTests(ctx) {
  try {
    execFileSync('npm', ['test', '--silent'], { cwd: ctx.root, stdio: 'pipe', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return [];
  } catch (err) {
    const tail = String(err.stdout ?? '').trim().split('\n').slice(-12).join('\n');
    return [finding(FEHLER, null, null, `npm test fehlgeschlagen\n${tail}`)];
  }
}

export const CHECKS = [
  { id: 1, name: 'App-Shell vollständig', run: runAppShell },
  { id: 2, name: 'CACHE_NAME hochgezählt', run: runCacheName },
  { id: 3, name: 'css/tailwind.css aktuell', run: runTailwind, slow: true },
  { id: 4, name: 'Dexie-Vendor-Datei aktuell', run: runDexie },
  { id: 5, name: 'Secret- und Infra-Scan', run: runSecrets },
  { id: 6, name: 'Keine unpassenden Dateien/Pfade im Repo', run: runUnwanted },
  { id: 7, name: 'Markdown-Links', run: runMarkdownLinks },
  { id: 8, name: 'ADR-Konsistenz', run: runAdrs },
  { id: 9, name: 'Verbotene Muster im App-Code', run: runForbiddenPatterns },
  { id: 10, name: 'Hartkodierte Farben', run: runHexColors },
  { id: 11, name: 'Tests laufen (npm test)', run: runTests, optIn: true },
];

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const options = { base: DEFAULT_BASE, fast: false, withTests: false, help: false, unknown: [] };
  for (const a of argv) {
    if (a === '--schnell') options.fast = true;
    else if (a === '--mit-tests') options.withTests = true;
    else if (a === '--hilfe' || a === '-h') options.help = true;
    else if (a.startsWith('--basis=') && a.length > 8) options.base = a.slice(8);
    else options.unknown.push(a);
  }
  return options;
}

const HELP = `Repo-Check für fitlog

  npm run check                       alle Prüfungen außer den Tests
  npm run check -- --schnell          ohne den Tailwind-Build (Prüfung 3)
  npm run check -- --mit-tests        zusätzlich npm test (Prüfung 11)
  npm run check -- --basis=<git-ref>  Vergleichsstand für Prüfung 2 (Standard: ${DEFAULT_BASE})

Exit-Code 1, sobald mindestens ein FEHLER vorliegt; WARNUNGEN brechen nicht ab.`;

const MAX_SHOWN = 25;

function statusOf(findings) {
  if (findings.some((f) => f.level === FEHLER)) return FEHLER;
  return findings.length ? WARNUNG : 'OK';
}

export function formatFinding(f) {
  const where = f.file ? (f.line ? `${f.file}:${f.line}` : f.file) : '';
  return where ? `${where}  ${f.message}` : f.message;
}

export function main(argv = process.argv.slice(2), root = ROOT) {
  const options = parseArgs(argv);
  if (options.help || options.unknown.length) {
    if (options.unknown.length) console.error(`Unbekannte Option: ${options.unknown.join(' ')}\n`);
    console.log(HELP);
    return options.unknown.length ? 2 : 0;
  }
  const ctx = createContext(root, options);
  let errors = 0;
  let warnings = 0;
  console.log(`fitlog Repo-Check (Basis-Stand: ${options.base})\n`);
  for (const check of CHECKS) {
    const label = `${String(check.id).padStart(2)}  ${check.name}`;
    const skipped = (check.slow && options.fast) || (check.optIn && !options.withTests);
    if (skipped) {
      console.log(`ÜBERSPRUNGEN ${label}${check.optIn ? ' (nur mit --mit-tests)' : ' (--schnell)'}`);
      continue;
    }
    let findings;
    try {
      findings = check.run(ctx);
    } catch (err) {
      findings = [finding(FEHLER, null, null, `Prüfung abgebrochen: ${err.message}`)];
    }
    errors += findings.filter((f) => f.level === FEHLER).length;
    warnings += findings.filter((f) => f.level === WARNUNG).length;
    console.log(`${statusOf(findings).padEnd(8)}     ${label}`);
    const sorted = [...findings].sort((a, b) => (a.level === b.level ? 0 : a.level === FEHLER ? -1 : 1));
    for (const f of sorted.slice(0, MAX_SHOWN)) console.log(`               ${f.level === FEHLER ? '✗' : '!'} ${formatFinding(f).replace(/\n/g, '\n                 ')}`);
    if (sorted.length > MAX_SHOWN) console.log(`               … und ${sorted.length - MAX_SHOWN} weitere`);
  }
  console.log(`\n${errors} Fehler, ${warnings} Warnungen`);
  return errors > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
