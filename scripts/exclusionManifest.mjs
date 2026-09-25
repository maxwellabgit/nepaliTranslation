/**
 * Fail-closed exclusion snapshot.
 * An empty excluded list is not proof unless exposure_count and both
 * source and target hash arrays are present.
 */

export function manifestReady(manifest) {
  if (!manifest || typeof manifest !== 'object') return false;
  if (typeof manifest.exposure_count !== 'number' || manifest.exposure_count < 0) {
    return false;
  }
  if (!Array.isArray(manifest.excluded)) return false;
  if (!Array.isArray(manifest.source_hashes)) return false;
  if (!Array.isArray(manifest.target_hashes)) return false;
  const declared =
    manifest.excluded.length +
    manifest.source_hashes.length +
    manifest.target_hashes.length;
  if (manifest.exposure_count > 0 && declared === 0) return false;
  return true;
}

export function forbiddenSets(manifest) {
  return {
    composite: new Set(manifest.excluded ?? []),
    source: new Set(manifest.source_hashes ?? []),
    target: new Set(manifest.target_hashes ?? []),
  };
}

/** Drop export rows whose composite, source, or target hash was publicly exposed. */
export function filterExportRows(rows, manifest) {
  if (!manifestReady(manifest)) {
    throw new Error('exclusion manifest is not fail-closed');
  }
  const sets = forbiddenSets(manifest);
  const kept = [];
  const dropped = [];
  for (const row of rows) {
    const blocked =
      sets.composite.has(row.hash) ||
      sets.source.has(row.sourceHash) ||
      sets.target.has(row.targetHash);
    if (blocked) dropped.push(row);
    else kept.push(row);
  }
  return { kept, dropped };
}
