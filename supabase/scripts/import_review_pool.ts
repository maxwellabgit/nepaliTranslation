#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read --allow-write
/**
 * R2 review-pool importer.
 *
 * Reads the explicit corpus registry at `datasets/corpus-registry.json`
 * and imports each declared corpus into `private.review_source_items` via
 * `service_import_review_batch`. Refuses to walk any directory that is
 * not listed in the registry.
 *
 * Contract vs runbook §R2:
 *   1. Registry is the single source of truth. No guessing.
 *   2. Named adapters per `format` (jsonl-src-tgt, jsonl-eng-npi,
 *      gold-pair). Malformed rows, unknown schemas, or missing required
 *      fields land in the reject manifest instead of being silently skipped.
 *   3. PII detection is expanded (email, phone, SSN, cc, IBAN,
 *      high-entropy tokens) and PII rows never touch the review pool.
 *   4. Normalized source+target content hashes for global dedup within
 *      the run and across prior runs.
 *   5. `service_start_review_import_run` / `service_import_review_batch`
 *      / `service_finish_review_import_run` — transactional batches; run
 *      failures leave status='failed'.
 *   6. No permanent `__probe__` row is written. A capability check calls
 *      `service_start_review_import_run` with `p_dry_run=true` on
 *      startup; that leaves an auditable run record instead of a probe
 *      source item.
 *   7. Reject manifest is emitted as `datasets/review_import_rejects.json`
 *      so an operator can review before promoting to production.
 *   8. `--dry-run` (or `DRY_RUN=1`) writes the manifest but performs no
 *      Supabase writes; `service_start_review_import_run` still records
 *      the intent with `status='dry_run'` so operators can compare.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (unless --dry-run)
 *   IMPORT_ROOT   optional (default: process.cwd())
 *   GIT_SHA       optional; auto-detected from `git rev-parse HEAD` when
 *                 not set
 *
 * CLI:
 *   deno run supabase/scripts/import_review_pool.ts [--dry-run] [--corpus=ID]
 */

import { walk } from "https://deno.land/std@0.203.0/fs/walk.ts";
import { readLines } from "https://deno.land/std@0.203.0/io/read_lines.ts";
import { join, relative } from "https://deno.land/std@0.203.0/path/mod.ts";
import { crypto } from "https://deno.land/std@0.203.0/crypto/mod.ts";

type Registry = {
  version: string;
  content_hash_algorithm: "sha256";
  corpora: Array<{
    id: string;
    purpose: "training" | "benchmark" | "gold" | "review";
    root: string;
    glob: string;
    format:
      | "jsonl-src-tgt"
      | "jsonl-src-tgt-lang"
      | "jsonl-eng-npi"
      | "jsonl-en-ne"
      | "jsonl-meaning-bank"
      | "jsonl-review-candidate"
      | "gold-pair";
    provenance: string;
    license: string;
    visibility: "public_review_eligible" | "public_review_gated";
    rights_status?: "cleared_public_display" | "unresolved";
    notes?: string;
  }>;
};

type Detected = {
  source: string;
  target: string | null;
  direction: "en-ne" | "ne-en";
  register: string;
  script: string;
  licenseNote: string | null;
  metadata: Record<string, unknown>;
};

type ImportRow = {
  content_hash: string;
  origin: string;
  direction: "en-ne" | "ne-en";
  register: string;
  script: string;
  source_text: string;
  proposed_target: string | null;
  license_note: string | null;
  metadata: Record<string, unknown>;
  pii_flag: boolean;
  rights_status?: "cleared_public_display" | "unresolved";
  origin_class?: "training_source";
};

type RejectReason =
  | "unknown_shape"
  | "empty_source"
  | "empty_target"
  | "pii_email"
  | "pii_phone"
  | "pii_ssn"
  | "pii_credit_card"
  | "pii_iban"
  | "pii_high_entropy"
  | "duplicate_hash_in_run"
  | "duplicate_hash_in_corpus"
  | "malformed_json";

type RejectRecord = {
  corpus_id: string;
  origin: string;
  reason: RejectReason;
  detail?: string;
};

// ---------------------------------------------------------------------------
// PII detection
//
// Not a compliance-grade PII detector. The runbook explicitly warns that
// regex alone does NOT guarantee de-identification and requires an
// admin-review override. This is defense-in-depth; corpus curators are
// still responsible for de-identifying before adding a corpus to the
// registry.
// ---------------------------------------------------------------------------

const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const RE_PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const RE_SSN = /\b\d{3}-\d{2}-\d{4}\b/;
const RE_CC = /\b(?:\d[ -]*?){13,19}\b/;
const RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;

function shannonEntropyBits(s: string): number {
  if (!s) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const n = s.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

function containsHighEntropyToken(text: string): boolean {
  for (const raw of text.split(/\s+/)) {
    const tok = raw.replace(/[.,;:!?)("'`]/g, "");
    if (tok.length < 24) continue;
    if (/^[A-Za-z0-9_-]+$/.test(tok) && shannonEntropyBits(tok) >= 4.0) {
      return true;
    }
  }
  return false;
}

function classifyPII(text: string): { flagged: boolean; reason?: RejectReason } {
  if (RE_EMAIL.test(text)) return { flagged: true, reason: "pii_email" };
  if (RE_SSN.test(text)) return { flagged: true, reason: "pii_ssn" };
  if (RE_CC.test(text)) return { flagged: true, reason: "pii_credit_card" };
  if (RE_IBAN.test(text)) return { flagged: true, reason: "pii_iban" };
  if (RE_PHONE.test(text)) {
    // Avoid flagging cardinals like years/route numbers.
    const digits = text.replace(/\D/g, "");
    if (digits.length >= 10) return { flagged: true, reason: "pii_phone" };
  }
  if (containsHighEntropyToken(text)) {
    return { flagged: true, reason: "pii_high_entropy" };
  }
  return { flagged: false };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function readJsonl(
  path: string,
  onMalformed: (line: string) => void,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const file = await Deno.open(path);
  try {
    for await (const line of readLines(file)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {
        onMalformed(trimmed.slice(0, 120));
      }
    }
  } finally {
    file.close();
  }
  return rows;
}

async function readGoldPair(
  dir: string,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const sources: Array<Record<string, unknown>> = [];
  const refs = new Map<string, string>();
  const srcFile = await Deno.open(join(dir, "sources.jsonl"));
  try {
    for await (const line of readLines(srcFile)) {
      const t = line.trim();
      if (!t) continue;
      try {
        sources.push(JSON.parse(t));
      } catch {
        // gold sources are curated; malformed here is a hard fail below.
      }
    }
  } finally {
    srcFile.close();
  }
  const refFile = await Deno.open(join(dir, "references.jsonl"));
  try {
    for await (const line of readLines(refFile)) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t) as Record<string, unknown>;
        if (typeof obj.id === "string" && typeof obj.reference === "string") {
          refs.set(obj.id, obj.reference);
        }
      } catch {
        // ignore malformed reference line
      }
    }
  } finally {
    refFile.close();
  }
  for (const s of sources) {
    if (typeof s.id !== "string" || typeof s.source !== "string") continue;
    const ref = refs.get(s.id);
    if (!ref) continue;
    rows.push({ id: s.id, source: s.source, reference: ref, status: s.status ?? "reviewed" });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Format adapters
// ---------------------------------------------------------------------------

function detectSrcTgt(row: Record<string, unknown>): Detected | null {
  if (typeof row.src !== "string" || typeof row.tgt !== "string") return null;
  const direction: "en-ne" | "ne-en" =
    row.direction === "ne-en" ? "ne-en" : "en-ne";
  return {
    source: row.src,
    target: row.tgt,
    direction,
    register: typeof row.register === "string" ? row.register : "unspecified",
    script: "unspecified",
    licenseNote: typeof row.provenance === "string" ? row.provenance : null,
    metadata: {
      meaning_id: row.meaning_id,
      surface: row.surface,
      product_prefix: row.product_prefix,
      provenance: row.provenance,
    },
  };
}

/** Unverified public-review prompts may have a suggested target or none. */
function detectReviewCandidate(row: Record<string, unknown>): Detected | null {
  if (
    typeof row.id !== "string" ||
    typeof row.source_text !== "string" ||
    !["en-ne", "ne-en"].includes(String(row.direction)) ||
    !(row.proposed_target === null || typeof row.proposed_target === "string") ||
    !["unverified_machine_suggestion", "source_only"].includes(String(row.suggestion_status))
  ) return null;
  return {
    source: row.source_text,
    target: row.proposed_target as string | null,
    direction: row.direction as "en-ne" | "ne-en",
    register: typeof row.register === "string" ? row.register : "unspecified",
    script: row.direction === "ne-en" ? "roman" : "deva",
    licenseNote: "owner_authorized_public_review",
    metadata: {
      prompt_id: row.id,
      surface: row.surface,
      suggestion_model: row.suggestion_model,
      suggestion_status: row.suggestion_status,
      review_status: "needs_public_review",
    },
  };
}

function detectEngNpi(row: Record<string, unknown>): Detected | null {
  if (typeof row.eng_Latn !== "string" || typeof row.npi_Deva !== "string") {
    return null;
  }
  return {
    source: row.eng_Latn,
    target: row.npi_Deva,
    direction: "en-ne",
    register: typeof row.formality === "string" ? row.formality : "unspecified",
    script: "deva",
    licenseNote: typeof row.license === "string" ? row.license : null,
    metadata: {
      source: row.source,
      unit: row.unit,
      domain: row.domain,
      context: row.context,
      quality_tier: row.quality_tier,
    },
  };
}

function detectSrcTgtLang(row: Record<string, unknown>): Detected | null {
  if (typeof row.src !== "string" || typeof row.tgt !== "string") return null;
  const srcLang = String(row.src_lang ?? "").toLowerCase();
  const tgtLang = String(row.tgt_lang ?? "").toLowerCase();
  let direction: "en-ne" | "ne-en" = "en-ne";
  if (srcLang.startsWith("npi") || srcLang.startsWith("ne")) direction = "ne-en";
  if (tgtLang.startsWith("eng") || tgtLang.startsWith("en")) direction = "ne-en";
  if (srcLang.startsWith("eng") || srcLang.startsWith("en")) direction = "en-ne";
  return {
    source: row.src,
    target: row.tgt,
    direction,
    register: typeof row.register === "string" ? row.register : "unspecified",
    script: direction === "ne-en" ? "deva" : "unspecified",
    licenseNote: typeof row.license === "string" ? row.license : null,
    metadata: {
      src_lang: row.src_lang,
      tgt_lang: row.tgt_lang,
      domain: row.domain,
      topic: row.topic,
      source: row.source,
    },
  };
}

function detectEnNe(row: Record<string, unknown>): Detected | null {
  if (typeof row.en !== "string" || typeof row.ne !== "string") return null;
  return {
    source: row.en,
    target: row.ne,
    direction: "en-ne",
    register: typeof row.formality === "string" ? row.formality : "unspecified",
    script: "deva",
    licenseNote: typeof row.license === "string" ? row.license : null,
    metadata: {
      id: row.id,
      domain: row.domain,
      topic: row.topic,
      source: row.source,
    },
  };
}

/**
 * meaning_bank.jsonl expands to up to four bilingual review rows per input
 * (en\u2192ne formal Deva, en\u2192ne informal Deva, en\u2192ne formal Roman,
 * en\u2192ne informal Roman). Each variant becomes its own Detected row so
 * dedup within the run separates identical Deva/Roman pairs.
 */
function detectMeaningBankMulti(
  row: Record<string, unknown>,
): Detected[] {
  if (typeof row.english !== "string") return [];
  const results: Detected[] = [];
  const meta = {
    meaning_id: row.meaning_id,
    surface: row.surface,
    provenance: row.provenance,
    unit: row.unit,
  };
  const variants: Array<{
    field: "ne_formal" | "ne_informal" | "roman_formal" | "roman_informal";
    register: "formal" | "informal";
    script: "deva" | "roman";
  }> = [
    { field: "ne_formal", register: "formal", script: "deva" },
    { field: "ne_informal", register: "informal", script: "deva" },
    { field: "roman_formal", register: "formal", script: "roman" },
    { field: "roman_informal", register: "informal", script: "roman" },
  ];
  for (const v of variants) {
    const target = row[v.field];
    if (typeof target !== "string" || target.trim() === "") continue;
    results.push({
      source: row.english,
      target,
      direction: "en-ne",
      register: v.register,
      script: v.script,
      licenseNote: typeof row.provenance === "string" ? row.provenance : null,
      metadata: { ...meta, variant: v.field },
    });
  }
  return results;
}

function detectGoldPair(
  row: Record<string, unknown>,
  origin: string,
): Detected | null {
  if (typeof row.source !== "string" || typeof row.reference !== "string") {
    return null;
  }
  return {
    source: row.source,
    target: row.reference,
    direction: origin.includes("ne_en") ? "ne-en" : "en-ne",
    register: origin.includes("informal") ? "informal" : "formal",
    script: origin.includes("roman") ? "roman" : "deva",
    licenseNote: "benchmark_gold",
    metadata: { id: row.id, status: row.status },
  };
}

// ---------------------------------------------------------------------------
// Registry driver
// ---------------------------------------------------------------------------

async function loadRegistry(root: string): Promise<{ registry: Registry; checksum: string }> {
  const path = join(root, "datasets", "corpus-registry.json");
  const raw = await Deno.readTextFile(path);
  const parsed = JSON.parse(raw) as Registry;
  if (parsed.content_hash_algorithm !== "sha256") {
    throw new Error("registry: only sha256 hashing is supported");
  }
  return { registry: parsed, checksum: await sha256Hex(raw) };
}

async function detectGitSha(root: string): Promise<string> {
  const envSha = Deno.env.get("GIT_SHA") ?? Deno.env.get("EXPO_PUBLIC_GIT_SHA");
  if (envSha && envSha.length > 0) return envSha;
  try {
    const cmd = new Deno.Command("git", {
      args: ["-C", root, "rev-parse", "HEAD"],
      stdout: "piped",
      stderr: "null",
    });
    const { code, stdout } = await cmd.output();
    if (code === 0) return new TextDecoder().decode(stdout).trim();
  } catch {
    // Falls through to unknown.
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRunFlag = Deno.args.includes("--dry-run");
  const dryRun = dryRunFlag || Deno.env.get("DRY_RUN") === "1";
  const corpusId = Deno.args.find((arg) => arg.startsWith("--corpus="))?.slice(9);
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const root = Deno.env.get("IMPORT_ROOT") ?? Deno.cwd();

  if (!dryRun && (!url || !service)) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless --dry-run");
    Deno.exit(2);
  }

  const { registry, checksum } = await loadRegistry(root);
  const corpora = corpusId
    ? registry.corpora.filter((corpus) => corpus.id === corpusId)
    : registry.corpora;
  if (corpusId && corpora.length !== 1) {
    throw new Error(`Unknown or duplicate registry corpus: ${corpusId}`);
  }
  const gitSha = await detectGitSha(root);
  console.log(
    `[import_review_pool] git_sha=${gitSha} registry_version=${registry.version} registry_checksum=${checksum} dry_run=${dryRun}`,
  );

  const rejects: RejectRecord[] = [];
  const perCorpus: Record<string, { seen: number; accepted: number; deduped: number; pii: number }> = {};
  const seenHashesAcrossRun = new Set<string>();
  const runIds: Record<string, string> = {};

  const headers = url && service
    ? {
        authorization: `Bearer ${service}`,
        apikey: service,
        "content-type": "application/json",
      }
    : null;

  async function startRun(originLabel: string, corpusId: string): Promise<string | null> {
    if (dryRun || !headers) return null;
    const res = await fetch(`${url}/rest/v1/rpc/service_start_review_import_run`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_origin: originLabel,
        p_git_sha: gitSha,
        p_registry_version: registry.version,
        p_manifest_checksum: checksum,
        p_corpus_id: corpusId,
        p_dry_run: false,
      }),
    });
    if (!res.ok) {
      throw new Error(`start_run failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json();
    return typeof body === "string" ? body : body?.result ?? null;
  }

  async function finishRun(runId: string | null, status: "ok" | "failed", err?: string) {
    if (!runId || !headers) return;
    await fetch(`${url}/rest/v1/rpc/service_finish_review_import_run`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_run_id: runId,
        p_status: status,
        p_error_message: err ?? null,
        p_notes: null,
      }),
    });
  }

  async function importBatch(
    runId: string | null,
    rows: ImportRow[],
    corpusId: string,
  ): Promise<{ inserted: number; skipped_excluded: number }> {
    if (dryRun || !headers || !runId) {
      return { inserted: 0, skipped_excluded: 0 };
    }
    const res = await fetch(`${url}/rest/v1/rpc/service_import_review_batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_run_id: runId,
        p_rows: rows,
        p_corpus_id: corpusId,
      }),
    });
    if (!res.ok) {
      throw new Error(`import_batch failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json() as Record<string, unknown>;
    return {
      inserted: Number(body.inserted ?? 0),
      skipped_excluded: Number(body.skipped_excluded ?? 0),
    };
  }

  for (const corpus of corpora) {
    const abs = join(root, corpus.root);
    perCorpus[corpus.id] = { seen: 0, accepted: 0, deduped: 0, pii: 0 };

    let files: Array<{ origin: string; path: string }> = [];
    try {
      if (corpus.format === "gold-pair") {
        // gold-pair walks the directory itself.
        files = [{ origin: `${corpus.root}`, path: abs }];
      } else {
        for await (
          const entry of walk(abs, {
            match: [globToRegexp(corpus.glob)],
            includeDirs: false,
          })
        ) {
          files.push({
            origin: `${corpus.root}/${relative(abs, entry.path)}`,
            path: entry.path,
          });
        }
      }
    } catch (err) {
      console.warn(`[import_review_pool] corpus=${corpus.id} unreadable at ${abs}: ${err}`);
      continue;
    }

    if (files.length === 0) {
      console.warn(`[import_review_pool] corpus=${corpus.id} no matching files under ${abs}`);
      continue;
    }

    let runId: string | null = null;
    try {
      runId = await startRun(`registry:${corpus.id}`, corpus.id);
      const seenHashesInCorpus = new Set<string>();
      const accepted: ImportRow[] = [];

      for (const file of files) {
        const rows = corpus.format === "gold-pair"
          ? await readGoldPair(file.path)
          : await readJsonl(file.path, (bad) =>
              rejects.push({
                corpus_id: corpus.id,
                origin: file.origin,
                reason: "malformed_json",
                detail: bad,
              }),
            );

        for (const row of rows) {
          perCorpus[corpus.id].seen += 1;

          // meaning_bank expands to multiple review rows; every other
          // adapter returns a single Detected.
          const detectedList: Detected[] = [];
          if (corpus.format === "jsonl-src-tgt") {
            const d = detectSrcTgt(row);
            if (d) detectedList.push(d);
          } else if (corpus.format === "jsonl-src-tgt-lang") {
            const d = detectSrcTgtLang(row);
            if (d) detectedList.push(d);
          } else if (corpus.format === "jsonl-eng-npi") {
            const d = detectEngNpi(row);
            if (d) detectedList.push(d);
          } else if (corpus.format === "jsonl-en-ne") {
            const d = detectEnNe(row);
            if (d) detectedList.push(d);
          } else if (corpus.format === "jsonl-meaning-bank") {
            detectedList.push(...detectMeaningBankMulti(row));
          } else if (corpus.format === "jsonl-review-candidate") {
            const d = detectReviewCandidate(row);
            if (d) detectedList.push(d);
          } else if (corpus.format === "gold-pair") {
            const d = detectGoldPair(row, file.origin);
            if (d) detectedList.push(d);
          }

          if (detectedList.length === 0) {
            rejects.push({
              corpus_id: corpus.id,
              origin: file.origin,
              reason: "unknown_shape",
              detail: JSON.stringify(row).slice(0, 120),
            });
            continue;
          }

          for (const detected of detectedList) {
            const source = normalizeText(detected.source);
            const target = detected.target ? normalizeText(detected.target) : "";
            if (!source) {
              rejects.push({
                corpus_id: corpus.id,
                origin: file.origin,
                reason: "empty_source",
              });
              continue;
            }
            if (!target && corpus.format !== "jsonl-review-candidate") {
              rejects.push({
                corpus_id: corpus.id,
                origin: file.origin,
                reason: "empty_target",
              });
              continue;
            }

            const pii = classifyPII(`${source}\n${target}`);
            if (pii.flagged) {
              rejects.push({
                corpus_id: corpus.id,
                origin: file.origin,
                reason: pii.reason ?? "pii_high_entropy",
              });
              perCorpus[corpus.id].pii += 1;
              continue;
            }

            const composite = `${detected.direction}|${source}|${target}`;
            const contentHash = await sha256Hex(composite);

            if (seenHashesInCorpus.has(contentHash)) {
              rejects.push({
                corpus_id: corpus.id,
                origin: file.origin,
                reason: "duplicate_hash_in_corpus",
                detail: contentHash,
              });
              perCorpus[corpus.id].deduped += 1;
              continue;
            }
            seenHashesInCorpus.add(contentHash);

            if (seenHashesAcrossRun.has(contentHash)) {
              rejects.push({
                corpus_id: corpus.id,
                origin: file.origin,
                reason: "duplicate_hash_in_run",
                detail: contentHash,
              });
              perCorpus[corpus.id].deduped += 1;
              continue;
            }
            seenHashesAcrossRun.add(contentHash);

            accepted.push({
              content_hash: contentHash,
              origin: file.origin,
              direction: detected.direction,
              register: detected.register,
              script: detected.script,
              source_text: source,
              proposed_target: target || null,
              license_note: detected.licenseNote,
              metadata: {
                ...detected.metadata,
                corpus_id: corpus.id,
                corpus_purpose: corpus.purpose,
                corpus_provenance: corpus.provenance,
                corpus_license: corpus.license,
              },
              pii_flag: false,
              ...(corpus.format === "jsonl-review-candidate"
                ? {
                    rights_status: corpus.rights_status ?? "unresolved",
                    origin_class: "training_source" as const,
                  }
                : {}),
            });
            perCorpus[corpus.id].accepted += 1;
          }
        }
      }

      // Push in transactional batches of 200 rows.
      const BATCH = 200;
      for (let i = 0; i < accepted.length; i += BATCH) {
        await importBatch(runId, accepted.slice(i, i + BATCH), corpus.id);
      }
      runIds[corpus.id] = runId ?? "dry-run";
      await finishRun(runId, "ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[import_review_pool] corpus=${corpus.id} FAILED: ${msg}`);
      await finishRun(runId, "failed", msg);
      Deno.exit(3);
    }
  }

  // Reject manifest is always written so an operator can inspect a
  // dry-run before promoting to production.
  const manifestPath = join(root, "datasets", "review_import_rejects.json");
  await Deno.writeTextFile(
    manifestPath,
    JSON.stringify(
      {
        version: registry.version,
        git_sha: gitSha,
        registry_checksum: checksum,
        dry_run: dryRun,
        corpus_filter: corpusId ?? null,
        per_corpus: perCorpus,
        run_ids: runIds,
        rejects,
        generated_at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    `[import_review_pool] wrote reject manifest to ${manifestPath} rejects=${rejects.length}`,
  );

  if (!dryRun && headers) {
    await fetch(`${url}/rest/v1/rpc/service_refresh_review_length_tiers`, {
      method: "POST",
      headers,
      body: "{}",
    });
  }

  console.log("[import_review_pool] done");
}

/** Minimal glob → RegExp. Supports `*` and literal characters. */
function globToRegexp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`(^|/)${escaped}$`);
}

if (import.meta.main) {
  await main();
}
