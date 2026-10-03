const fs = require('fs');
const ts = require('../../mobile/node_modules/typescript');
function catalog(path) {
  const result = {};
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && ts.isStringLiteral(node.initializer)) result[node.name.text] = node.initializer.text;
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
const en = catalog('mobile/src/i18n/en.ts');
const ne = catalog('mobile/src/i18n/ne.ts');
const sections = [
  ['Startup introduction','startupConsent.intro'],
  ['General Terms acceptance','startupConsent.terms'],
  ['General Privacy acceptance','startupConsent.privacy'],
  ['Separate optional permission','privacy.consentSeparate'],
  ['Model-improvement disclosure','auth.contributionConsentBody'],
  ['Optional opt-in checkbox','privacy.modelImprovementOptIn'],
  ['Contribution age checkbox','auth.ageConfirm'],
  ['Default-off speech disclosure','privacy.audioDisclosure'],
  ['Withdrawal confirmation','auth.withdrawConsentBody'],
  ['Delete shared data confirmation','auth.deleteAccountBody'],
  ['Accepted recovery tradeoff','privacy.installationWarning'],
];
let out = '# Bola guest consent — owner legal and bilingual review\n\nSource: 9504fcd; mobile copy unchanged from4bbd3e1. General acceptance version2026-10-02.guest.startup; optional contribution version2026-10-02.guest. Extracted verbatim from English/Nepali UI catalogs. This is a review package, not legal or bilingual approval. Synthetic hosted consent tests do not supply that approval.\n\n';
for (const [heading,key] of sections) {
  if (!en[key] || !ne[key]) throw new Error('Missing review copy: '+key);
  out += `## ${heading}\n\nEnglish: ${en[key]}\n\nNepali: ${ne[key]}\n\n`;
}
out += '## Remaining sign-off\n\n- [ ] Owner/legal reviewer approves the exact disclosure, retention, processors and commercial-use statement.\n- [ ] Bilingual reviewer approves Nepali meaning and register; Romanized rendering checked on device.\n- [ ] Published Terms/Privacy URLs and App Store privacy answers match this guest contract.\n- [ ] Physical iPhone/iPad verifies readable optional choice, speech initially off, offline withdrawal/retry and honest purge status.\n\nNo new TestFlight build is delivered until the owner resumes delivery.\n';
fs.writeFileSync('docs/GUEST_CONSENT_OWNER_REVIEW.md',out);
