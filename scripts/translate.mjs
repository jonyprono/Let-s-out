#!/usr/bin/env node
/**
 * translate.mjs -- Automatic translation script using DeepL API
 *
 * Usage:
 *   node scripts/translate.mjs --lang en
 *   node scripts/translate.mjs --lang es
 *   node scripts/translate.mjs --lang en,es,pt
 *
 * Env variable required (in .env.local at monorepo root):
 *   DEEPL_API_KEY=your-key-here
 *
 * SECURITY: This script runs ONLY in Node.js (dev/CI). The API key is NEVER
 * bundled into the Vite/browser build.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Load .env.local ---
function loadEnv() {
  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) {
    console.error('  .env.local not found at project root.');
    console.error('    Create it and add: DEEPL_API_KEY=your-key-here');
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

// --- CLI args ---
function parseLangs() {
  const idx = process.argv.indexOf('--lang');
  if (idx === -1 || !process.argv[idx + 1]) {
    console.error('Usage: node scripts/translate.mjs --lang en');
    console.error('   Multiple: --lang en,es,pt');
    process.exit(1);
  }
  return process.argv[idx + 1].split(',').map(l => l.trim().toLowerCase());
}

// --- DeepL language codes ---
const DEEPL_LANG_MAP = {
  en: 'EN-GB',
  es: 'ES',
  pt: 'PT-PT',
  de: 'DE',
  it: 'IT',
  ar: 'AR',
  zh: 'ZH',
};

// --- Flatten / unflatten helpers ---
function flattenObject(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

function unflattenObject(flat) {
  const result = {};
  for (const [fullKey, value] of Object.entries(flat)) {
    const parts = fullKey.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

// --- Protect {{placeholders}} with opaque tokens ---
// Uses __P0__, __P1__ etc. so DeepL treats them as unknown words and skips them.
function protectPlaceholders(texts) {
  const registry = [];
  const protected_ = texts.map(text =>
    text.replace(/\{\{[^}]+\}\}/g, match => {
      const idx = registry.length;
      registry.push(match);
      return `__P${idx}__`;
    })
  );
  return { protected_, registry };
}

function restorePlaceholders(texts, registry) {
  return texts.map(text =>
    text.replace(/__P(\d+)__/g, (_, idx) => registry[+idx] ?? `__P${idx}__`)
  );
}

// --- DeepL API batch call (no tag_handling to avoid XML parse errors) ---
async function translateBatch(texts, targetLang, apiKey) {
  const { protected_, registry } = protectPlaceholders(texts);

  const params = new URLSearchParams();
  params.append('source_lang', 'FR');
  params.append('target_lang', targetLang);
  // No tag_handling -- avoids XML parse errors with & and {{}} in strings
  for (const t of protected_) params.append('text', t);

  const isFree = apiKey.endsWith(':fx');
  const endpoint = isFree
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepL API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const translated = data.translations.map(t => t.text);
  return restorePlaceholders(translated, registry);
}

// --- Translate one language ---
async function translateLanguage(frFlat, targetLangCode, apiKey) {
  const keys = Object.keys(frFlat);
  const values = Object.values(frFlat);
  const BATCH = 50;
  const translated = [];
  let totalChars = 0;

  for (let i = 0; i < values.length; i += BATCH) {
    const batch = values.slice(i, i + BATCH);
    totalChars += batch.join('').length;
    const end = Math.min(i + BATCH, values.length);
    process.stdout.write(`  Translating keys ${i + 1}-${end}/${values.length}...`);
    const results = await translateBatch(batch, DEEPL_LANG_MAP[targetLangCode], apiKey);
    translated.push(...results);
    process.stdout.write(' ok\n');
  }

  console.log(`  Characters used: ~${totalChars}`);

  const translatedFlat = {};
  keys.forEach((key, idx) => { translatedFlat[key] = translated[idx]; });
  return unflattenObject(translatedFlat);
}

// --- Main ---
async function main() {
  loadEnv();
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    console.error('DEEPL_API_KEY not found in .env.local');
    process.exit(1);
  }

  const langs = parseLangs();
  const frPath = resolve(ROOT, 'apps/web/src/locales/fr.json');
  const frRaw = readFileSync(frPath, 'utf8').replace(/^\uFEFF/, '');
  const fr = JSON.parse(frRaw);
  const frFlat = flattenObject(fr);

  console.log(`Source: fr.json (${Object.keys(frFlat).length} keys)`);

  for (const lang of langs) {
    if (lang === 'fr') { console.log('Skipping fr (source)'); continue; }
    if (!DEEPL_LANG_MAP[lang]) {
      console.warn(`Unknown lang code "${lang}". Known: ${Object.keys(DEEPL_LANG_MAP).join(', ')}`);
      continue;
    }
    console.log(`\nTranslating to ${lang.toUpperCase()} (${DEEPL_LANG_MAP[lang]})`);
    const result = await translateLanguage(frFlat, lang, apiKey);
    const outPath = resolve(ROOT, `apps/web/src/locales/${lang}.json`);
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`Written: apps/web/src/locales/${lang}.json`);
  }

  console.log('\nDone!');
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });