import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveRights, publicReviewDecision } from './reviewEligibility.mjs';

const cleared = {
  explicit_eligible: true,
  rights_status: 'cleared_public_display',
  origin_class: 'training_source',
  anonymization_status: 'not_required',
  substantively_reviewed: false,
  quarantined: false,
  planned_or_open: false,
  export_excluded: false,
};

test('unresolved rights are admin_only', () => {
  assert.equal(effectiveRights('unresolved'), 'admin_only');
  assert.equal(effectiveRights(undefined), 'admin_only');
  const decision = publicReviewDecision({ ...cleared, rights_status: 'unresolved' });
  assert.equal(decision.eligible, false);
  assert.equal(decision.effective_rights, 'admin_only');
  assert.ok(decision.reasons.includes('rights_not_cleared'));
});

test('collected text without certification cannot enter review', () => {
  const decision = publicReviewDecision({
    ...cleared,
    origin_class: 'collected_user',
    anonymization_status: 'pending',
  });
  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.includes('anonymization_not_certified'));
});

test('cleared licensed training row can enter', () => {
  assert.equal(publicReviewDecision(cleared).eligible, true);
});

test('certified collected row can enter', () => {
  const decision = publicReviewDecision({
    ...cleared,
    origin_class: 'collected_user',
    anonymization_status: 'certified',
  });
  assert.equal(decision.eligible, true);
});

test('previously exposed or reviewed rows cannot re-enter', () => {
  assert.equal(publicReviewDecision({ ...cleared, export_excluded: true }).eligible, false);
  assert.equal(publicReviewDecision({ ...cleared, substantively_reviewed: true }).eligible, false);
  assert.equal(publicReviewDecision({ ...cleared, planned_or_open: true }).eligible, false);
  assert.equal(publicReviewDecision({ ...cleared, quarantined: true }).eligible, false);
});
