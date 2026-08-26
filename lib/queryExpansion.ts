// Query expansion + brand-alias normalization (Session 4, Track A).
//
// Purpose: replace the brittle hand-maintained brand word-lists in lib/parse.ts
// with an alias-aware layer so brand queries resolve to a platform's own spelling
// of the brand, e.g. "bape" must match ThredUp's "A Bathing Ape" listings
// instead of returning honest-zero or generic junk (HANDOFF §7 L).
//
// Two layers:
//   1. A narrow, curated **static** alias map (ALIAS_GROUPS), synchronous, always
//      available, covers the well-known streetwear cases on the FIRST request.
//   2. An **LLM** expander (sidecar POST /expand-query, gpt-4o-mini) that enriches
//      the long tail. Its results are cached aggressively (in-memory + Supabase,
//      ~30d) so we never pay per call repeatedly. parse.ts only ever reads
//      synchronously; the LLM path runs fire-and-forget via primeExpansion().
//
// parse.ts is synchronous, so expandAliasesSync() never awaits: it reads the
// static map merged with whatever the LLM has already learned into memory.

import { createAdminClient } from '@/lib/supabase/admin';

const SIDECAR_URL = process.env.CRAWL4AI_URL ?? 'http://localhost:8000';
const EXPANSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, brand aliases are stable

export interface QueryExpansion {
  // token (single word) -> alternate surface forms of the same brand
  aliasesByToken: Record<string, string[]>;
  // best-effort structured normalization of the query/title
  normalized: {
    brand: string | null;
    color: string | null;
    condition: string | null;
    size: string | null;
  };
}

// ── Curated static alias groups ────────────────────────────────────────────
// Each group lists surface forms that refer to the SAME brand. Keep this narrow
// and high-precision: only well-known aliases that are very unlikely to collide
// with unrelated listings. (Deliberately NOT including "off-white": colorFilter
// treats off-white as a color; mixing them would corrupt color matching.)
const ALIAS_GROUPS: string[][] = [
  ['bape', 'a bathing ape', 'bathing ape'],
  ['fear of god', 'fog'],
  ['fear of god essentials', 'essentials'],
  ['comme des garcons', 'cdg', 'comme des garçons'],
  ['the north face', 'tnf', 'north face'],
  ['anti social social club', 'assc'],
  ['stussy', 'stüssy'],
  ['polo ralph lauren', 'ralph lauren', 'polo'],
  ['new balance', 'nb'],
];

// Build token -> alternate-surface-forms lookup from the static groups.
// Key on every single-word surface form in a group; value is the OTHER forms
// in that group (so a query token expands to the brand's other spellings).
function buildStaticMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const group of ALIAS_GROUPS) {
    for (const form of group) {
      // single-word forms become lookup keys; multi-word forms are reachable
      // only as expansion targets (matched as substrings in parse.ts).
      if (form.includes(' ')) continue;
      const others = group.filter((f) => f !== form);
      const existing = map.get(form) ?? [];
      map.set(form, [...existing, ...others]);
    }
  }
  return map;
}

const STATIC_ALIASES = buildStaticMap();

// Every surface form (single- AND multi-word) -> its canonical brand (group[0]).
// Used to match a query brand to a title's brand even when neither shares a
// literal token (e.g. query "cdg" → "Comme des Garçons Play Tee").
const SURFACE_TO_CANONICAL = (() => {
  const m = new Map<string, string>();
  for (const group of ALIAS_GROUPS) {
    const canonical = group[0];
    for (const form of group) m.set(form, canonical);
  }
  return m;
})();

// Surface forms longest-first so multi-word brands win over their substrings.
const SURFACE_FORMS_BY_LENGTH = [...SURFACE_TO_CANONICAL.keys()].sort(
  (a, b) => b.length - a.length,
);

function normText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics so "garçons" -> "garcons"
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Canonical brand for a single query token, if it's a known brand surface form.
export function canonicalBrandOf(token: string): string | null {
  return SURFACE_TO_CANONICAL.get(token.toLowerCase()) ?? null;
}

// Detect a known brand mentioned anywhere in a free-text title.
export function detectBrandInText(text: string): string | null {
  const padded = ` ${normText(text)} `;
  for (const form of SURFACE_FORMS_BY_LENGTH) {
    if (padded.includes(` ${form} `)) return SURFACE_TO_CANONICAL.get(form) ?? null;
  }
  return null;
}

// LLM-learned aliases, merged in-process from primeExpansion(). token -> Set.
const learnedAliases = new Map<string, Set<string>>();

// ── Synchronous lookup (consumed by parse.ts) ──────────────────────────────
// Returns alternate surface forms for a single query token. Includes both
// single-word aliases (matched against title tokens) and multi-word aliases
// (matched as substrings), parse.ts decides how to compare each.
export function expandAliasesSync(token: string): string[] {
  const t = token.toLowerCase();
  const out = new Set<string>(STATIC_ALIASES.get(t) ?? []);
  const learned = learnedAliases.get(t);
  if (learned) for (const a of learned) out.add(a);
  return [...out];
}

function mergeLearned(aliasesByToken: Record<string, string[]> | undefined): void {
  if (!aliasesByToken) return;
  for (const [token, forms] of Object.entries(aliasesByToken)) {
    const key = token.toLowerCase();
    const set = learnedAliases.get(key) ?? new Set<string>();
    for (const f of forms) {
      const v = String(f).toLowerCase().trim();
      if (v && v !== key) set.add(v);
    }
    learnedAliases.set(key, set);
  }
}

// ── Cache-key normalization (shared shape with searchCache.normalizeQuery) ──
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');
}

// De-dupe priming so the 8 platforms in one search don't each call the LLM, and
// so we don't re-prime a query we've already handled this process lifetime.
// `inflight` holds the shared promise: concurrent callers AWAIT the same work
// (so when callers await, all platforms see the aliases before they parse),
// while a second search for an already-primed query returns instantly.
const inflight = new Map<string, Promise<void>>();
const primed = new Set<string>();

// ── LLM expansion ──────────────────────────────────────────────────────────
// Two call styles, both safe:
//   • `void primeExpansion(query)`   : fire-and-forget (enrich cache for later).
//   • `await primeExpansion(query)`  : block until aliases are loaded so the
//     CURRENT request's relevance matching sees them (seam in searchWorker).
// Order: in-memory primed → Supabase cache → sidecar LLM → write both caches.
// Never throws; expansion is best-effort enrichment on top of the static map,
// and the awaited path is bounded (see fetchExpansionFromSidecar timeout) so a
// cold/slow LLM never stalls a search beyond a few seconds: it just falls back
// to the static alias map for that request.
export function primeExpansion(query: string): Promise<void> {
  const norm = normalizeQuery(query);
  if (!norm || primed.has(norm)) return Promise.resolve();
  const existing = inflight.get(norm);
  if (existing) return existing;

  const work = (async () => {
    const cached = await readExpansionCache(norm);
    if (cached) {
      mergeLearned(cached.aliasesByToken);
      return;
    }
    const fresh = await fetchExpansionFromSidecar(query);
    if (fresh) {
      mergeLearned(fresh.aliasesByToken);
      await writeExpansionCache(norm, fresh);
    }
  })()
    .catch((err) => console.error('[queryExpansion] prime failed:', err))
    .finally(() => {
      // Mark primed even on empty/stub/error result so we don't re-hammer the
      // sidecar for a query that yielded no aliases this process lifetime.
      primed.add(norm);
      inflight.delete(norm);
    });

  inflight.set(norm, work);
  return work;
}

async function fetchExpansionFromSidecar(query: string): Promise<QueryExpansion | null> {
  try {
    const res = await fetch(`${SIDECAR_URL}/expand-query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
      // Bounded so the awaited (first-request) path never stalls a search for
      // long: on timeout we fall back to the static alias map and the LLM
      // result still lands in cache for next time.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<QueryExpansion>;
    return {
      aliasesByToken: data.aliasesByToken ?? {},
      normalized: data.normalized ?? { brand: null, color: null, condition: null, size: null },
    };
  } catch {
    return null;
  }
}

async function readExpansionCache(normQuery: string): Promise<QueryExpansion | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('query_expansion_cache')
      .select('payload, expires_at')
      .eq('query_norm', normQuery)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return data.payload as QueryExpansion;
  } catch {
    return null;
  }
}

async function writeExpansionCache(normQuery: string, payload: QueryExpansion): Promise<void> {
  try {
    const supabase = createAdminClient();
    const expiresAt = new Date(Date.now() + EXPANSION_TTL_SECONDS * 1000).toISOString();
    await supabase
      .from('query_expansion_cache')
      .upsert({ query_norm: normQuery, payload, expires_at: expiresAt }, { onConflict: 'query_norm' });
  } catch (err) {
    console.error('[queryExpansion] cache write failed:', err);
  }
}

// Read whatever expansion we have for a query (cache only, no LLM call).
export function getNormalizedExpansion(query: string): QueryExpansion | null {
  const norm = normalizeQuery(query);
  if (!primed.has(norm)) return null;
  const aliasesByToken: Record<string, string[]> = {};
  for (const token of norm.split(' ')) {
    const aliases = expandAliasesSync(token);
    if (aliases.length) aliasesByToken[token] = aliases;
  }
  return {
    aliasesByToken,
    normalized: { brand: null, color: null, condition: null, size: null },
  };
}
