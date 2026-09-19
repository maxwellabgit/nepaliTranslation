#!/usr/bin/env bash
# Generate TypeScript types from the local database.
# Requires Docker and the Supabase CLI: https://supabase.com/docs/guides/local-development
set -euo pipefail
cd "$(dirname "$0")/../.."
npx supabase gen types typescript --local > supabase/database.types.ts
echo "Wrote supabase/database.types.ts"
