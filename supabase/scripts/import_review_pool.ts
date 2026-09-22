#!/usr/bin/env -S deno run --allow-env --allow-net --allow-read
/**
 * G1 review-pool importer.
 *
 * Reads every JSONL row under `datasets/`, `training/`, and `benchmarks/`
 * that has a translation pair, dedupes by SHA-256 content hash, and calls
 * `service_import_review_item` to store it in `private.review_source_items`.
 *
 * Idempotent: rerunning it does not duplicate rows.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   IMPORT_ROOT   optional (default: cwd two levels up from this script)
 *   DRY_RUN=1     print reconciliation without HTTP calls
 *
 * Boundary (V1_G0_DECISIONS.md D2):
 *   All datasets/training/benchmarks rows are eligible for public review
 *   after de-identification and dedup. Submissions must not be promoted
 *   back to training/benchmarks automatically. Contributor known checks
 *   are separately curated synthetic rows -- never copied from gold.
 */

import { readLines } from "https://deno.land/std@0.203.0/io/read_lines.ts";
import { walk } from "https://deno.land/std@0.203.0/fs/walk.ts";
import { join, relative } from "https://deno.land/std@0.203.0/path/mod.ts";
import { crypto } from "https://deno.land/std@0.203.0/crypto/mod.ts";

interface ImportRow {
  contentHash: string;
  origin: string;
  direction: "en-ne" | "ne-en";
  register: string;
  script: string;
  sourceText: string;
  proposedTarget: string | null;
  licenseNote: string | null;
  metadata: Record<string, unknown>;
  piiFlag: boolean;
}

const PII_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{16}\b/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
];

function hasPII(text: string): boolean {
  return PII_PATTERNS.some((re) => re.test(text));
}

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

interface Detected {
  source: string;
  target: string | null;
  direction: "en-ne" | "ne-en";
  register: string;
  script: string;
  licenseNote: string | null;
  metadata: Record<string, unknown>;
}

function detectPair(
  row: Record<string, unknown>,
  origin: string,
): Detected | null {
  // Training clean parallel: {src, tgt, direction, register, ...}
  if (typeof row.src === "string" && typeof row.tgt === "string" && typeof row.direction === "string") {
    return {
      source: row.src,
      target: row.tgt,
      direction: (row.direction === "ne-en" ? "ne-en" : "en-ne"),
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
  // English pool / conversation seeds: {eng_Latn, npi_Deva, ...}
  if (typeof row.eng_Latn === "string" && typeof row.npi_Deva === "string") {
    const formality = typeof row.formality === "string" ? row.formality : "unspecified";
    return {
      source: row.eng_Latn,
      target: row.npi_Deva,
      direction: "en-ne",
      register: formality,
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
  // FLORES/BPCC benchmark sample: {eng_Latn, npi_Deva} + more.
  if (typeof row.eng_Latn === "string" && typeof row.npi_Deva === "string") {
    return {
      source: row.eng_Latn,
      target: row.npi_Deva,
      direction: "en-ne",
      register: "unspecified",
      script: "deva",
      licenseNote: origin,
      metadata: { ...row },
    };
  }
  // Gold sources + references pair: caller pre-merges.
  if (typeof row.source === "string" && typeof row.reference === "string") {
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
  return null;
}

async function readJsonl(path: string): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const file = await Deno.open(path);
  try {
    for await (const line of readLines(file)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        rows.push(JSON.parse(trimmed));
      } catch {
        // Ignore malformed lines; the importer will report skip_other via reconciliation.
      }
    }
  } finally {
    file.close();
  }
  return rows;
}

async function mergeGoldPair(dir: string): Promise<Array<Record<string, unknown>>> {
  const sources = await readJsonl(join(dir, "sources.jsonl"));
  const refs = await readJsonl(join(dir, "references.jsonl"));
  const refMap = new Map<string, string>();
  for (const r of refs) {
    if (typeof r.id === "string" && typeof r.reference === "string") {
      refMap.set(r.id, r.reference);
    }
  }
  const rows: Array<Record<string, unknown>> = [];
  for (const s of sources) {
    if (typeof s.id !== "string" || typeof s.source !== "string") continue;
    const ref = refMap.get(s.id);
    if (!ref) continue;
    rows.push({ id: s.id, source: s.source, reference: ref, status: s.status ?? "reviewed" });
  }
  return rows;
}

async function main() {
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const dryRun = Deno.env.get("DRY_RUN") === "1";
  const root = Deno.env.get("IMPORT_ROOT") ?? Deno.cwd();

  if (!dryRun && (!url || !service)) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required (or DRY_RUN=1)");
    Deno.exit(2);
  }

  const included: ImportRow[] = [];
  const seen = new Set<string>();
  const skipReasons: Record<string, number> = {};

  const rootsWithFiles: Array<{ origin: string; path: string; format: "jsonl" | "gold-pair" }> = [];

  // Direct JSONL corpora
  for (const dir of ["training/data", "datasets/synthetic/english_pool", "benchmarks/data"]) {
    const abs = join(root, dir);
    try {
      for await (const entry of walk(abs, { exts: [".jsonl"], includeDirs: false })) {
        rootsWithFiles.push({
          origin: `${dir}/${relative(abs, entry.path)}`,
          path: entry.path,
          format: "jsonl",
        });
      }
    } catch {
      // Directory missing on this host: skip silently.
    }
  }

  // Gold pair directories
  for (const cls of ["en_ne_formal", "en_ne_informal", "ne_en_deva", "ne_en_roman"]) {
    const dir = join(root, "benchmarks", "gold", cls);
    try {
      const st = await Deno.stat(dir);
      if (st.isDirectory) {
        rootsWithFiles.push({
          origin: `benchmarks/gold/${cls}`,
          path: dir,
          format: "gold-pair",
        });
      }
    } catch {
      // Directory missing: skip.
    }
  }

  for (const file of rootsWithFiles) {
    const rows = file.format === "gold-pair"
      ? await mergeGoldPair(file.path)
      : await readJsonl(file.path);
    for (const row of rows) {
      const detected = detectPair(row, file.origin);
      if (!detected) {
        skipReasons["unknown_shape"] = (skipReasons["unknown_shape"] ?? 0) + 1;
        continue;
      }
      const source = normalizeText(detected.source);
      const target = detected.target ? normalizeText(detected.target) : "";
      if (!source) {
        skipReasons["empty_source"] = (skipReasons["empty_source"] ?? 0) + 1;
        continue;
      }
      const composite = `${detected.direction}|${source}|${target}`;
      const contentHash = await sha256Hex(composite);
      if (seen.has(contentHash)) {
        skipReasons["duplicate_hash_in_run"] =
          (skipReasons["duplicate_hash_in_run"] ?? 0) + 1;
        continue;
      }
      seen.add(contentHash);
      const piiFlag = hasPII(source) || hasPII(target);
      if (piiFlag) {
        skipReasons["pii_flagged"] = (skipReasons["pii_flagged"] ?? 0) + 1;
        // Still stored (importer sets pii_flag=true, which disables eligibility)
      }
      included.push({
        contentHash,
        origin: file.origin,
        direction: detected.direction,
        register: detected.register,
        script: detected.script,
        sourceText: source,
        proposedTarget: target || null,
        licenseNote: detected.licenseNote,
        metadata: detected.metadata,
        piiFlag,
      });
    }
  }

  console.log(
    `[import_review_pool] candidates=${included.length} unique_hashes=${seen.size} skip=${
      JSON.stringify(skipReasons)
    }`,
  );

  if (dryRun) {
    console.log("[import_review_pool] DRY_RUN=1 -> not calling Supabase");
    return;
  }

  const headers = {
    authorization: `Bearer ${service}`,
    apikey: service!,
    "content-type": "application/json",
  };

  const runRes = await fetch(`${url}/rest/v1/rpc/service_import_review_item`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_content_hash: "__probe__",
      p_origin: "probe",
      p_direction: "en-ne",
      p_register: "unspecified",
      p_script: "unspecified",
      p_source_text: "probe",
      p_proposed_target: "probe",
      p_license_note: null,
      p_metadata: {},
      p_pii_flag: true,
    }),
  });
  if (!runRes.ok) {
    console.error(`Import RPC unreachable: ${runRes.status} ${await runRes.text()}`);
    Deno.exit(3);
  }

  let inserted = 0;
  for (const row of included) {
    const res = await fetch(`${url}/rest/v1/rpc/service_import_review_item`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_content_hash: row.contentHash,
        p_origin: row.origin,
        p_direction: row.direction,
        p_register: row.register,
        p_script: row.script,
        p_source_text: row.sourceText,
        p_proposed_target: row.proposedTarget,
        p_license_note: row.licenseNote,
        p_metadata: row.metadata,
        p_pii_flag: row.piiFlag,
      }),
    });
    if (res.ok) inserted += 1;
  }

  const tierRes = await fetch(`${url}/rest/v1/rpc/service_refresh_review_length_tiers`, {
    method: "POST",
    headers,
    body: "{}",
  });

  console.log(
    `[import_review_pool] inserted=${inserted} tier_refresh_status=${tierRes.status}`,
  );
}

if (import.meta.main) {
  await main();
}
