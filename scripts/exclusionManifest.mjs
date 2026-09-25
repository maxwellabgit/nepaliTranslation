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

/**
 * Synthetic exposure. Not from gold and not from the live corpus.
 * A scan that reports zero committed exclusions does not exercise this case.
 */
export const POSITIVE_EXPORT_FIXTURE = {
  direction: 'en-ne',
  source: 'exposed fixture source sentence',
  target: 'खुला लक्ष्य वाक्य',
  privateSource: 'private fixture source sentence',
  privateTarget: 'निजी लक्ष्य वाक्य',
};

export function provePositiveExportFixture(sha256, normalize) {
  const fixture = POSITIVE_EXPORT_FIXTURE;
  const composite = (direction, source, target) =>
    `${direction}|${normalize(source)}|${normalize(target)}`;
  const sourceHash = sha256(normalize(fixture.source));
  const targetHash = sha256(normalize(fixture.target));
  const exposedHash = sha256(composite(fixture.direction, fixture.source, fixture.target));
  const manifest = {
    exposure_count: 2,
    excluded: [exposedHash],
    source_hashes: [sourceHash],
    target_hashes: [targetHash],
  };
  if (!manifestReady(manifest)) {
    throw new Error('positive export fixture manifest is not fail-closed');
  }
  const rows = [
    {
      label: 'exact-pair',
      hash: exposedHash,
      sourceHash,
      targetHash,
    },
    {
      label: 'same-source',
      hash: sha256(composite(fixture.direction, fixture.source, fixture.privateTarget)),
      sourceHash,
      targetHash: sha256(normalize(fixture.privateTarget)),
    },
    {
      label: 'same-target',
      hash: sha256(composite(fixture.direction, fixture.privateSource, fixture.target)),
      sourceHash: sha256(normalize(fixture.privateSource)),
      targetHash,
    },
    {
      label: 'unexposed',
      hash: sha256(composite(fixture.direction, fixture.privateSource, fixture.privateTarget)),
      sourceHash: sha256(normalize(fixture.privateSource)),
      targetHash: sha256(normalize(fixture.privateTarget)),
    },
  ];
  const { kept, dropped } = filterExportRows(rows, manifest);
  const keptLabels = kept.map((row) => row.label);
  const droppedLabels = dropped.map((row) => row.label).sort();
  if (keptLabels.length !== 1 || keptLabels[0] !== 'unexposed') {
    throw new Error(`positive export fixture kept ${keptLabels.join(',')}`);
  }
  if (droppedLabels.join(',') !== 'exact-pair,same-source,same-target') {
    throw new Error(`positive export fixture dropped ${droppedLabels.join(',')}`);
  }
  return { exposure_count: manifest.exposure_count, kept: keptLabels, dropped: droppedLabels };
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
