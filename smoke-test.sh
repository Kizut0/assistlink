#!/usr/bin/env bash
# AssistLink — Phase 02/03 smoke test (permission matrix + posts lifecycle).
#
# Uses the non-production `x-dev-user` bypass to stand in for AD-issued JWTs.
#
#   docker compose up -d      # Postgres
#   npm run dev               # terminal 1
#   ./smoke-test.sh           # terminal 2
#
# Assumes the seeded professor is userId 1 (override with PROF_ID=n ./smoke-test.sh).
set -u

BASE="${BASE:-http://localhost:8081/assistlink/api}"
PROF_ID="${PROF_ID:-1}"

PROF='{"userId":'"$PROF_ID"',"role":"PROFESSOR","email":"prof@au.edu"}'
OTHER_PROF='{"userId":999,"role":"PROFESSOR","email":"other@au.edu"}'
STUDENT='{"userId":3,"role":"STUDENT","email":"stu@au.edu"}'
JSON='Content-Type: application/json'

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  ok   $1 ($3)"; pass=$((pass+1));
          else echo "  FAIL $1 — expected $2, got $3"; fail=$((fail+1)); fi; }
code() { curl -s -o /tmp/al_body -w '%{http_code}' "$@"; }

echo "== Phase 02 — auth & RBAC =="
check "health 200"                  200 "$(code "$BASE/health")"
check "/auth/me no token 401"       401 "$(code "$BASE/auth/me")"
check "/auth/me bad token 401"      401 "$(code "$BASE/auth/me" -H 'Authorization: Bearer not.a.jwt')"
check "/auth/me dev prof 200"       200 "$(code "$BASE/auth/me" -H "x-dev-user: $PROF")"
check "list posts no token 401"     401 "$(code "$BASE/posts")"
check "list posts as STUDENT 200"   200 "$(code "$BASE/posts" -H "x-dev-user: $STUDENT")"
check "create as STUDENT 403"       403 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $STUDENT" -d '{"title":"RA role","details":"help","jobCategory":"RA"}')"
check "create no token 401"         401 "$(code -X POST "$BASE/posts" -H "$JSON" -d '{"title":"RA role","details":"help","jobCategory":"RA"}')"

echo "== Phase 03 — validation (Task 21) =="
check "malformed JSON 400"          400 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{bad json')"
check "missing jobCategory 400"     400 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"No category","details":"x"}')"
check "bad jobCategory 400"         400 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"Bad cat","details":"x","jobCategory":"XX"}')"
check "title too short 400"         400 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"ab","details":"x","jobCategory":"RA"}')"
check "empty update 400"            400 "$(code -X PATCH "$BASE/posts/1" -H "$JSON" -H "x-dev-user: $PROF" -d '{}')"
check "unknown route 404"           404 "$(code "$BASE/nope")"

echo "== Phase 03 — posts lifecycle (Tasks 18/19/20) =="
STAMP=$(date +%s)
check "create as PROFESSOR 201"     201 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"TA needed '"$STAMP"'","details":"grading","requiredSkills":["ml"],"jobCategory":"TA"}')"
PID=$(sed -n 's/.*"id":\([0-9]*\).*/\1/p' /tmp/al_body | head -1)
echo "  (new post id = ${PID:-?})"

check "private post create 201"     201 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"SECRET '"$STAMP"'","details":"hidden","jobCategory":"RA","private":true}')"
curl -s "$BASE/posts" -H "x-dev-user: $STUDENT" > /tmp/al_list
if grep -q "SECRET $STAMP" /tmp/al_list; then check "private post hidden from list" "hidden" "listed"
else check "private post hidden from list" "hidden" "hidden"; fi

if [ -n "${PID:-}" ]; then
  check "non-owner edit 403"        403 "$(code -X PATCH "$BASE/posts/$PID" -H "$JSON" -H "x-dev-user: $OTHER_PROF" -d '{"title":"hijacked title"}')"
  check "owner edit 200"            200 "$(code -X PATCH "$BASE/posts/$PID" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"TA needed (edited)"}')"
  check "owner close 200"           200 "$(code -X PATCH "$BASE/posts/$PID/close" -H "x-dev-user: $PROF")"
  curl -s "$BASE/posts" -H "x-dev-user: $STUDENT" > /tmp/al_list
  if grep -q "\"id\":$PID," /tmp/al_list; then check "closed post hidden from list" "hidden" "listed"
  else check "closed post hidden from list" "hidden" "hidden"; fi
fi

echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
