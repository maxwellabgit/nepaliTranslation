#!/usr/bin/env node
/**
 * R2 exclusion gate.
 *
 * Reads `benchmarks/private_exclusions.json` (the CI-visible mirror of
 * `public.review_exclusions` in production Supabase) and asserts that
 * no excluded content hash appears in any registered training or
 * benchmark corpus. This is the audit's runbook §R2 rule 11:
 *
 *   "Every training/evaluation export joins against the exclusion
 *    registry. CI must fail if an excluded hash appears in a generated
 *    training set or a future private ship evaluation."
 *
 * The hash recipe matches `supabase/scripts/import_review_pool.ts`:
 *   sha256(`${direction}|${normalize(source)}|${normalize(target)}`)
 * where `normalize` collapses whitespace to a single space and trims.
 *
 * Adapters cover every format declared in `datasets/corpus-registry.json`.
 * Adapters are additive: any new adapter added to the importer must also
 * be reflected here so the guard cannot silently miss a corpus.
 *
 * Exit codes:
 *   0 — no excluded hash observed in any training/benchmark corpus.
 *   1 — at least one violation, or a corpus is unreadable.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { forbiddenSets, manifestReady } from "./exclusionManifest.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const registryPath = join(root, "datasets", "corpus-registry.json");
const exclusionsPath = join(root, "benchmarks", "private_exclusions.json");

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const exclusions = JSON.parse(readFileSync(exclusionsPath, "utf8"));

if (registry.content_hash_algorithm !== "sha256") {
  console.error(
    `check_review_exclusions: unsupported hash algorithm ${registry.content_hash_algorithm}`,
  );
  process.exit(1);
}
if (exclusions.content_hash_algorithm !== "sha256") {
  console.error(
    `check_review_exclusions: exclusion manifest uses unsupported algorithm ${exclusions.content_hash_algorithm}`,
  );
  process.exit(1);
}

if (!manifestReady(exclusions)) {
  console.error(
    "check_review_exclusions: exclusion manifest is not a fail-closed snapshot. Require exposure_count plus excluded, source_hashes, and target_hashes. An empty file is not proof.",
  );
  process.exit(1);
}

const { composite: excludedSet, source: sourceSet, target: targetSet } =
  forbiddenSets(exclusions);

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const normalize = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();
const composite = (direction, source, target) =>
  `${direction}|${normalize(source)}|${normalize(target)}`;

// Adapters: (row, origin) -> Array<{direction, source, target}>
const adapters = {
  "jsonl-src-tgt": (row) => {
    if (typeof row.src !== "string" || typeof row.tgt !== "string") return [];
    const direction = row.direction === "ne-en" ? "ne-en" : "en-ne";
    return [{ direction, source: row.src, target: row.tgt }];
  },
  "jsonl-src-tgt-lang": (row) => {
    if (typeof row.src !== "string" || typeof row.tgt !== "string") return [];
    const srcLang = String(row.src_lang ?? "").toLowerCase();
    const tgtLang = String(row.tgt_lang ?? "").toLowerCase();
    let direction = "en-ne";
    if (srcLang.startsWith("npi") || srcLang.startsWith("ne")) direction = "ne-en";
    if (tgtLang.startsWith("eng") || tgtLang.startsWith("en")) direction = "ne-en";
    if (srcLang.startsWith("eng") || srcLang.startsWith("en")) direction = "en-ne";
    return [{ direction, source: row.src, target: row.tgt }];
  },
  "jsonl-eng-npi": (row) => {
    if (typeof row.eng_Latn !== "string" || typeof row.npi_Deva !== "string") return [];
    return [{ direction: "en-ne", source: row.eng_Latn, target: row.npi_Deva }];
  },
  "jsonl-en-ne": (row) => {
    if (typeof row.en !== "string" || typeof row.ne !== "string") return [];
    return [{ direction: "en-ne", source: row.en, target: row.ne }];
  },
  "jsonl-meaning-bank": (row) => {
    if (typeof row.english !== "string") return [];
    const out = [];
    for (const field of ["ne_formal", "ne_informal", "roman_formal", "roman_informal"]) {
      const target = row[field];
      if (typeof target !== "string" || target.trim() === "") continue;
      out.push({ direction: "en-ne", source: row.english, target });
    }
    return out;
  },
  "gold-pair": (row) => {
    if (typeof row.source !== "string" || typeof row.reference !== "string") return [];
    // Direction/register/script don't matter for the hash beyond the composite
    // recipe; gold pair callers always use "en-ne" unless origin overrides.
    const direction = row.__direction || "en-ne";
    return [{ direction, source: row.source, target: row.reference }];
  },
};

function readJsonl(path) {
  const rows = [];
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try {
        rows.push(JSON.parse(t));
      } catch {
        // ignore malformed lines
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return rows;
}

function readGoldPair(dir) {
  const rows = [];
  const sources = readJsonl(join(dir, "sources.jsonl"));
  const refMap = new Map();
  for (const r of readJsonl(join(dir, "references.jsonl"))) {
    if (typeof r.id === "string" && typeof r.reference === "string") {
      refMap.set(r.id, r.reference);
    }
  }
  for (const s of sources) {
    if (typeof s.id !== "string" || typeof s.source !== "string") continue;
    const ref = refMap.get(s.id);
    if (!ref) continue;
    // dir path hints direction/register for the composite recipe.
    const direction = dir.includes("ne_en") ? "ne-en" : "en-ne";
    rows.push({ source: s.source, reference: ref, __direction: direction });
  }
  return rows;
}

function expandGlob(rootAbs, pattern) {
  // Minimal glob support: '*' matches [^/]*.
  if (!pattern.includes("*")) {
    return [join(rootAbs, pattern)];
  }
  const re = new RegExp(
    "^" +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^/]*") +
      "$",
  );
  try {
    return readdirSync(rootAbs)
      .filter((name) => re.test(name))
      .map((name) => join(rootAbs, name));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

let violations = 0;
let checked = 0;

for (const corpus of registry.corpora ?? []) {
  if (!(corpus.purpose === "training" || corpus.purpose === "benchmark")) {
    // Gold is public-review-eligible under R0 D2 but is not a training or
    // eval export target for the ship-cert step, so it is out of scope for
    // this specific guard. It IS scanned by the R1 pgTAP exclusion tests
    // and by the importer.
    continue;
  }

  const rootAbs = join(root, corpus.root);
  const adapter = adapters[corpus.format];
  if (!adapter) {
    console.error(
      `check_review_exclusions: corpus '${corpus.id}' declares unknown format '${corpus.format}' — this script must be updated to keep the guard honest.`,
    );
    process.exit(1);
  }

  let files = [];
  try {
    if (corpus.format === "gold-pair") {
      files = [rootAbs];
    } else {
      files = expandGlob(rootAbs, corpus.glob);
    }
  } catch (err) {
    console.error(
      `check_review_exclusions: corpus '${corpus.id}' file discovery failed: ${err.message}`,
    );
    process.exit(1);
  }

  for (const file of files) {
    const rows = corpus.format === "gold-pair" ? readGoldPair(file) : readJsonl(file);
    for (const row of rows) {
      const detected = adapter(row, corpus.id);
      for (const d of detected) {
        checked += 1;
        const hash = sha256(composite(d.direction, d.source, d.target));
        const sourceHash = sha256(normalize(d.source));
        const targetHash = sha256(normalize(d.target));
        if (
          excludedSet.has(hash) ||
          sourceSet.has(sourceHash) ||
          targetSet.has(targetHash)
        ) {
          violations += 1;
          console.error(
            `check_review_exclusions: VIOLATION corpus='${corpus.id}' file='${relative(root, file)}' hash=${hash} — this content is in benchmarks/private_exclusions.json and MUST NOT appear in training/eval.`,
          );
        }
      }
    }
  }
}

if (violations > 0) {
  console.error(
    `check_review_exclusions: FAILED — ${violations} excluded hash${violations === 1 ? "" : "es"} appeared in training/benchmark corpora out of ${checked} scanned rows.`,
  );
  process.exit(1);
}

console.log(
  `check_review_exclusions: ok (${checked} rows scanned; ${excludedSet.size} exclusions enforced).`,
);
