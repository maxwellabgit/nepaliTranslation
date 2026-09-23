# Review lookahead

Plans private America/New_York windows toward 28 days and requires 14 before public review is enabled. Append only.

- Source: `scripts/reviewLookahead.mjs`
- Database: `private.review_public_eligible` and window tables
- Schedule file: `schedule.yaml`
- Secret names, not values: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Proof: `node --test scripts/reviewLookahead.test.mjs`
