import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/utils.js';

test('escapeHtml escaped & < > " und \'', () => {
  assert.equal(escapeHtml('&'), '&amp;');
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('>'), '&gt;');
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
});

test('escapeHtml: kein Doppel-Escaping der eigenen Ersetzungen und Attribut-Ausbruch blockiert', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  const out = escapeHtml('" onmouseover="alert(1)" x=\'');
  assert.ok(!out.includes('"') && !out.includes("'"));
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

test('escapeHtml: normale Texte und Zahlen bleiben unverändert', () => {
  assert.equal(escapeHtml('Bankdrücken (Kurzhantel)'), 'Bankdrücken (Kurzhantel)');
  assert.equal(escapeHtml(82.5), '82.5');
  assert.equal(escapeHtml(''), '');
});
