#!/usr/bin/env bash
# scripts/verify-ai-containment.sh
# Smoke test: containment is in place after deploy.
# Requires: SUPABASE_URL, USER_A_JWT (non-owner), USER_B_JWT (non-owner, different),
# OWNER_JWT (super_admin) in the environment.

set -euo pipefail
: "${SUPABASE_URL:?need SUPABASE_URL}"
: "${USER_A_JWT:?need USER_A_JWT}"
: "${USER_B_JWT:?need USER_B_JWT}"
: "${OWNER_JWT:?need OWNER_JWT}"

CHAT_URL="$SUPABASE_URL/functions/v1/ai-assistant-chat"

echo "1. No-auth call to chat must 401"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$CHAT_URL" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}')
test "$code" = "401" || { echo "expected 401, got $code"; exit 1; }

echo "2. User A asks 'list all my deals'"
curl -s -X POST "$CHAT_URL" \
  -H "Authorization: Bearer $USER_A_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"list every deal you can see"}]}' \
  > /tmp/user_a_response.txt

echo "3. User B asks 'list all my deals'"
curl -s -X POST "$CHAT_URL" \
  -H "Authorization: Bearer $USER_B_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"list every deal you can see"}]}' \
  > /tmp/user_b_response.txt

echo "4. Diff the two responses — they MUST differ (different RLS scope)"
if diff -q /tmp/user_a_response.txt /tmp/user_b_response.txt > /dev/null; then
  echo "FAIL: both users see identical data — RLS scope leakage"
  exit 1
fi

echo "5. Owner gets larger scope"
owner_size=$(curl -s -X POST "$CHAT_URL" \
  -H "Authorization: Bearer $OWNER_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"list every deal you can see"}]}' | wc -c)
user_size=$(wc -c < /tmp/user_a_response.txt)
test "$owner_size" -gt "$user_size" || { echo "FAIL: owner response not larger than user"; exit 1; }

echo "All containment checks passed."
