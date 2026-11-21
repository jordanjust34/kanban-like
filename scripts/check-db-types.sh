#!/usr/bin/env bash
# Checks that the committed src/lib/database.types.ts matches the types generated from
# the migrations (used by .github/workflows/db.yml).
#
#   scripts/check-db-types.sh <freshly-generated.ts> [committed.ts]
#
# The committed file is generated against the hosted project, but CI generates against a
# local stack built from supabase/migrations. Those two outputs can differ cosmetically, so
# both sides are normalised the same way before diffing:
#   - the `__InternalSupabase: { PostgrestVersion: '...' }` block (and its two comment
#     lines) is dropped, because the local PostgREST version needn't match the hosted one;
#   - both files go through prettier with default options, which absorbs whitespace, quote
#     and trailing-comma differences between generator versions.
# Anything left over is real schema drift and fails the check.
set -euo pipefail

generated=${1:?usage: check-db-types.sh <generated.ts> [committed.ts]}
committed=${2:-src/lib/database.types.ts}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

normalise() {
  # --stdin-filepath must not match .prettierignore (which lists database.types.ts), or
  # prettier would pass the input through unformatted.
  npx --no-install prettier --no-config --stdin-filepath normalised-db-types.ts <"$1" |
    perl -0pe '
      s/^[ \t]*\/\/ (Allows to automatically instantiate createClient|instead of createClient<Database).*\n//mg;
      s/^[ \t]*__InternalSupabase: \{[^}]*\};?\n//mg;
    ' >"$2"
}

normalise "$committed" "$tmp/committed.ts"
normalise "$generated" "$tmp/generated.ts"

if ! diff -u --label "committed: $committed" --label "generated from migrations" \
  "$tmp/committed.ts" "$tmp/generated.ts"; then
  msg="database.types.ts is stale — run \`npx supabase gen types typescript --project-id <ref> --schema public > src/lib/database.types.ts\` after applying the migrations"
  echo "::error file=$committed::$msg"
  echo "$msg (diff above, after normalisation)" >&2
  exit 1
fi
echo "database.types.ts is in sync with supabase/migrations"
