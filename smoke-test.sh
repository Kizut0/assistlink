<<<<<<< Updated upstream
#!/usr/bin/env bash
# permission matrix + posts lifecycle + profiles + applications
# uses the x-dev-user header to fake AD logins (dev only, blocked in prod)
=======
git#!/usr/bin/env bash
# AssistLink — Phase 02/03 smoke test (permission matrix + posts lifecycle).
>>>>>>> Stashed changes
#
#   docker compose up -d
#   npm run dev            # terminal 1
#   ./smoke-test.sh        # terminal 2
#
# assumes seeded professor is userId 1 and seeded student (Alice) is userId 3
# override with PROF_ID=n STUDENT_ID=n ./smoke-test.sh
set -u

BASE="${BASE:-http://localhost:8081/assistlink/api}"
PROF_ID="${PROF_ID:-1}"
STUDENT_ID="${STUDENT_ID:-3}"

PROF='{"userId":'"$PROF_ID"',"role":"PROFESSOR","email":"prof@au.edu"}'
OTHER_PROF='{"userId":999,"role":"PROFESSOR","email":"other@au.edu"}'
STUDENT='{"userId":'"$STUDENT_ID"',"role":"STUDENT","email":"stu@au.edu"}'
# not seeded - a STUDENT with no Student row yet, for the "no profile" apply check
NEW_STUDENT='{"userId":42,"role":"STUDENT","email":"newstu@au.edu"}'
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

echo "== Phase 04 — student profile CRUD (Task 22) =="
check "get profile no token 401"    401 "$(code "$BASE/me/profile")"
check "get profile as PROFESSOR 403" 403 "$(code "$BASE/me/profile" -H "x-dev-user: $PROF")"
check "get profile as STUDENT 200"  200 "$(code "$BASE/me/profile" -H "x-dev-user: $STUDENT")"
check "put profile empty body 400"  400 "$(code -X PUT "$BASE/me/profile" -H "$JSON" -H "x-dev-user: $STUDENT" -d '{}')"
check "put profile bad gpa 400"     400 "$(code -X PUT "$BASE/me/profile" -H "$JSON" -H "x-dev-user: $STUDENT" -d '{"gpa":5.0}')"
check "put profile as PROFESSOR 403" 403 "$(code -X PUT "$BASE/me/profile" -H "$JSON" -H "x-dev-user: $PROF" -d '{"bio":"nope"}')"

BIO="updated bio $(date +%s)"
check "put profile valid 200"       200 "$(code -X PUT "$BASE/me/profile" -H "$JSON" -H "x-dev-user: $STUDENT" -d '{"bio":"'"$BIO"'","skills":["Go","SQL"]}')"
if grep -q "$BIO" /tmp/al_body; then check "profile update persisted" "persisted" "persisted"
else check "profile update persisted" "persisted" "missing"; fi

echo "== Phase 04 — apply to a post (Task 23) =="
STAMP4=$(date +%s)
check "create post for apply test 201" 201 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"RA opening '"$STAMP4"'","details":"apply test","jobCategory":"RA"}')"
APID=$(sed -n 's/.*"id":\([0-9]*\).*/\1/p' /tmp/al_body | head -1)
echo "  (apply-test post id = ${APID:-?})"

check "apply no token 401"          401 "$(code -X POST "$BASE/posts/${APID:-0}/applications")"
check "apply as PROFESSOR 403"      403 "$(code -X POST "$BASE/posts/${APID:-0}/applications" -H "x-dev-user: $PROF")"

# GET must be read-only: prove it doesn't silently create a profile that
# would let a student skip the "complete your profile" guard below.
check "get profile (no profile yet) 200" 200 "$(code "$BASE/me/profile" -H "x-dev-user: $NEW_STUDENT")"
if grep -q '"data":null' /tmp/al_body; then check "GET didn't create a row" "no row" "no row"
else check "GET didn't create a row" "no row" "row exists"; fi

check "apply no profile 400"        400 "$(code -X POST "$BASE/posts/${APID:-0}/applications" -H "x-dev-user: $NEW_STUDENT")"
check "apply unknown post 404"      404 "$(code -X POST "$BASE/posts/999999/applications" -H "x-dev-user: $STUDENT")"

if [ -n "${APID:-}" ]; then
  check "apply as STUDENT 201"      201 "$(code -X POST "$BASE/posts/$APID/applications" -H "x-dev-user: $STUDENT")"
  check "apply again 409"           409 "$(code -X POST "$BASE/posts/$APID/applications" -H "x-dev-user: $STUDENT")"

  check "create+close post for closed test 201" 201 "$(code -X POST "$BASE/posts" -H "$JSON" -H "x-dev-user: $PROF" -d '{"title":"TA closed '"$STAMP4"'","details":"apply test","jobCategory":"TA"}')"
  CPID=$(sed -n 's/.*"id":\([0-9]*\).*/\1/p' /tmp/al_body | head -1)
  check "close it 200"              200 "$(code -X PATCH "$BASE/posts/$CPID/close" -H "x-dev-user: $PROF")"
  check "apply to closed post 400"  400 "$(code -X POST "$BASE/posts/$CPID/applications" -H "x-dev-user: $STUDENT")"
fi

echo "== Phase 04 — view applicants (Task 24) =="
check "applicants no token 401"      401 "$(code "$BASE/posts/${APID:-0}/applications")"
check "applicants as STUDENT 403"    403 "$(code "$BASE/posts/${APID:-0}/applications" -H "x-dev-user: $STUDENT")"
check "applicants non-owner prof 403" 403 "$(code "$BASE/posts/${APID:-0}/applications" -H "x-dev-user: $OTHER_PROF")"
check "applicants unknown post 404"  404 "$(code "$BASE/posts/999999/applications" -H "x-dev-user: $PROF")"
check "applicants as owner 200"      200 "$(code "$BASE/posts/${APID:-0}/applications" -H "x-dev-user: $PROF")"

# first "id" in the list is the application id (student/user ids come later)
AID=$(grep -o '"id":[0-9]*' /tmp/al_body | head -1 | cut -d: -f2)
echo "  (application id = ${AID:-?})"
if grep -q '"gpa"' /tmp/al_body; then check "applicant carries profile fields" "present" "present"
else check "applicant carries profile fields" "present" "missing"; fi
if grep -q '"aiScore"' /tmp/al_body; then check "applicant carries aiScore field" "present" "present"
else check "applicant carries aiScore field" "present" "missing"; fi

echo "== Phase 04 — accept / reject (Task 25) =="
check "decide no token 401"          401 "$(code -X PATCH "$BASE/applications/${AID:-0}" -H "$JSON" -d '{"status":"ACCEPTED"}')"
check "decide as STUDENT 403"        403 "$(code -X PATCH "$BASE/applications/${AID:-0}" -H "$JSON" -H "x-dev-user: $STUDENT" -d '{"status":"ACCEPTED"}')"
check "decide non-owner prof 403"    403 "$(code -X PATCH "$BASE/applications/${AID:-0}" -H "$JSON" -H "x-dev-user: $OTHER_PROF" -d '{"status":"ACCEPTED"}')"
check "decide bad status 400"        400 "$(code -X PATCH "$BASE/applications/${AID:-0}" -H "$JSON" -H "x-dev-user: $PROF" -d '{"status":"MAYBE"}')"
check "decide PENDING rejected 400"  400 "$(code -X PATCH "$BASE/applications/${AID:-0}" -H "$JSON" -H "x-dev-user: $PROF" -d '{"status":"PENDING"}')"
check "decide empty body 400"        400 "$(code -X PATCH "$BASE/applications/${AID:-0}" -H "$JSON" -H "x-dev-user: $PROF" -d '{}')"
check "decide unknown application 404" 404 "$(code -X PATCH "$BASE/applications/999999" -H "$JSON" -H "x-dev-user: $PROF" -d '{"status":"ACCEPTED"}')"

if [ -n "${AID:-}" ]; then
  check "owner accepts 200"          200 "$(code -X PATCH "$BASE/applications/$AID" -H "$JSON" -H "x-dev-user: $PROF" -d '{"status":"ACCEPTED"}')"
  curl -s "$BASE/posts/$APID/applications" -H "x-dev-user: $PROF" > /tmp/al_body
  if grep -q '"status":"ACCEPTED"' /tmp/al_body; then check "decision persisted" "ACCEPTED" "ACCEPTED"
  else check "decision persisted" "ACCEPTED" "not saved"; fi
  check "owner can reject too 200"   200 "$(code -X PATCH "$BASE/applications/$AID" -H "$JSON" -H "x-dev-user: $PROF" -d '{"status":"REJECTED"}')"
fi

echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
