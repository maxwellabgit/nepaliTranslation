/**
 * Deny-by-default public-review eligibility.
 * The database function private.review_public_eligible must match these rules.
 * Unresolved rights are treated as admin_only.
 */

const CLEARED = 'cleared_public_display';

export function effectiveRights(rightsStatus) {
  if (!rightsStatus || rightsStatus === 'unresolved') return 'admin_only';
  return rightsStatus;
}

export function publicReviewDecision(row) {
  const reasons = [];
  const rights = effectiveRights(row.rights_status);
  if (row.explicit_eligible !== true) reasons.push('not_explicitly_eligible');
  if (rights !== CLEARED) reasons.push('rights_not_cleared');
  if (row.origin_class === 'collected_user' && row.anonymization_status !== 'certified') {
    reasons.push('anonymization_not_certified');
  }
  if (row.substantively_reviewed === true) reasons.push('already_reviewed');
  if (row.quarantined === true) reasons.push('quarantined');
  if (row.planned_or_open === true) reasons.push('already_planned');
  if (row.export_excluded === true) reasons.push('export_excluded');
  return {
    eligible: reasons.length === 0,
    effective_rights: rights,
    reasons,
  };
}
