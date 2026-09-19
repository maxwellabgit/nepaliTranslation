#!/usr/bin/env bash
# Two concurrent grants with the same source id must create one ledger row.
set -euo pipefail
URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
USER_ID="11111111-1111-4111-8111-111111111111"
psql "$URL" -v ON_ERROR_STOP=1 -c "delete from public.reward_ledger where source_id = 'concurrent-src';"
BEFORE=$(psql "$URL" -tA -c "select lifetime_credits from public.earned_entitlements where user_id = '$USER_ID';")
psql "$URL" -v ON_ERROR_STOP=1 -c "select private.apply_reward('$USER_ID'::uuid, 'rewarded_video', 'concurrent-src', 2, 10);" &
psql "$URL" -v ON_ERROR_STOP=1 -c "select private.apply_reward('$USER_ID'::uuid, 'rewarded_video', 'concurrent-src', 2, 10);" &
wait
COUNT=$(psql "$URL" -tA -c "select count(*) from public.reward_ledger where source_id = 'concurrent-src';")
AFTER=$(psql "$URL" -tA -c "select lifetime_credits from public.earned_entitlements where user_id = '$USER_ID';")
if [ "$COUNT" != "1" ]; then
  echo "expected 1 ledger row, got $COUNT"
  exit 1
fi
DELTA=$((AFTER - BEFORE))
if [ "$DELTA" != "2" ]; then
  echo "expected +2 credits, got +$DELTA (before=$BEFORE after=$AFTER)"
  exit 1
fi
echo "concurrent reward grant ok (1 row, +2 credits)"
