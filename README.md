# AssistLink

A platform connecting students with research and teaching opportunities (RA/TA
postings, applications, AI candidate ranking, and a peer service integration).

**Stack:** Node.js 22 · TypeScript · Express 5 · Prisma 7 · PostgreSQL 16 ·
Microsoft AD (OIDC/MSAL) · Docker

> The project is written in TypeScript and runs through `tsx` — there is **no
> build step in development**. All API routes are namespaced under
> `/assistlink/api`.

## Setup

### Prerequisites
- Node.js 22+
- Docker & Docker Compose
- Git

### Installation

1. **Clone and install**
   ```bash
   git clone <repo-url>
   cd assistlink
   npm install
   ```

2. **Create your environment file**
   ```bash
   cp .env.example .env
   ```
   > **The app will not start until the four required service secrets are set.** The
   > config loader fails fast at boot with `Missing required secret: <NAME>`
   > rather than failing later mid-request. Placeholder values are fine locally
   > for services you aren't calling yet. See [Environment](#environment).

3. **Start PostgreSQL**
   ```bash
   docker compose up -d
   docker compose ps        # wait for "healthy"
   ```

4. **Apply migrations and generate the client**
   ```bash
   npm run migrate:deploy   # apply existing migrations
   npm run generate         # generate the Prisma client
   ```

5. **Seed sample data** (recommended — the smoke test expects it)
   ```bash
   npm run seed
   ```

   To add or refresh 50 faculty-spanning student profiles and one professor in
   each faculty without recreating the rest of the database, run
   `npm run seed:test-users`.

   `npm run seed` is also safe to rerun for the deterministic demo users,
   profiles, faculty leads, and sample postings. Other local accounts and data
   are preserved.

6. **Run the dev server**
   ```bash
   npm run dev
   ```
   Health check: <http://localhost:8081/assistlink/api/health>

## Web interface

Open <http://localhost:8081/assistlink/> after starting the server. The responsive
interface is served by Express from `public/`; no additional frontend install or
build is required.

- **Students:** search and filter RA/TA opportunities, save a profile, apply, and
  track application decisions.
- **Professors:** land on Applications & postings, with their own postings ordered
  by pending applications. Summary counts, review filters, and direct create/edit
  actions keep recruiting work together, including private and closed postings.
  Campus postings remains available as a secondary view.
- **Admins:** land on User management, with account totals, role filters, search,
  pagination, and confirmed role assignment. Their own postings are a separate view.
- **Save feedback:** student profiles show saved, unsaved, saving, and failed states
  beside a sticky save action. Failed saves preserve edits; leaving unsaved changes
  prompts for confirmation. Role and application decisions show visible confirmation.
- **Staff API:** `GET /assistlink/api/posts/workspace` returns only the signed-in
  author's postings with total, pending, accepted, and rejected application counts.
  It requires a Professor or Admin role.
- **Sign-in:** choose Microsoft sign-in. The browser receives an HTTP-only session
  cookie with the existing JWT expiry. Production cookies require HTTPS. OAuth
  state is checked against a signed, short-lived cookie. The normal API login
  continues returning a bearer token; initiate it in a browser that retains cookies.
- **Local development:** the sign-in dialog exposes the existing development
  bypass only outside production. Choose a seeded role and its actual database
  user ID (default seed: professor 1, admin 2, student 3). This selection lasts
  for the browser tab; it does not create a database user.

The test-user fixture keys run from `student-001` through `student-050`, with
one `prof-*` account per faculty. PostgreSQL IDs remain auto-incremented so
existing posts, applications, and profiles are never renumbered. A fresh
`npm run migrate:reset && npm run seed` gives the students contiguous IDs after
the original professor and admin records; run that only when the local data
can be discarded.

The UI uses the existing API plus `GET /posts?mine=1`,
`GET /me/applications`, `GET /auth/options`, and `POST /auth/logout`.
Cookie-authenticated writes require `x-assistlink-request: web`; existing bearer
clients are unchanged. Logout clears the browser cookie. Run `npm run test:web`
for HTTP integration tests of asset serving, sessions, CSRF protection, query
scoping, and role management; database reads in this suite use mocks. Run
`npm run test:users:db` for opt-in PostgreSQL checks of pagination, preserved work,
existing sessions, and concurrent role changes. This creates and removes its own
temporary users; use a local test database. Use `./smoke-test.sh` to validate
against a running seeded database. Real Microsoft sign-in needs valid AD settings.

This interface deploys together with the existing Node/Express backend. It is not
configured as a separate static or Cloudflare Workers deployment.

## Environment

Four service secrets are **required** — the app refuses to boot without them. In
production (Phase 07) these come from Azure Key Vault; the names in brackets are
the vault entry names.

| Variable | Purpose | Vault entry |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `DATABASE-URL` |
| `JWT_SECRET` | Signing key for session JWTs | `JWT-SECRET` |
| `GEMINI_API_KEY` | Gemini Flash candidate ranking (Phase 05; optional until ranking is used) | Google AI Studio |
| `PARTNER_API_KEY` | Consuming the partner Events API (Phase 06) | `PARTNER-API-KEY` |
| `AD_CLIENT_SECRET` | Microsoft AD OIDC client secret | `AD-CLIENT-SECRET` |

`AD_CLIENT_ID`, `AD_TENANT_ID` and `AD_REDIRECT_URI` are **public identifiers,
not secrets** — they are read from the environment in every environment and must
never be added to Key Vault.

Other config: `PORT` (default 8081), `NODE_ENV`, `JWT_EXPIRES_IN` (default `30m`),
`GEMINI_MODEL` (default `gemini-2.5-flash`), and `GEMINI_BASE_URL`.

### Gemini ranking (Phase 05)

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey)
and add it to `.env` as `GEMINI_API_KEY=...`. The key is used only by the server;
never put it in `public/` or commit it. The ranking endpoint sends posting and
applicant profile text to Gemini Flash and stores a validated 0–100 score plus a
short rationale. It does not send names, emails, résumé links, or student-facing
ranking data. Ranking is manual, synchronous, limited to 50 applicants and 100,000
serialized input characters, and does not change application decisions.

`POST /assistlink/api/posts/:id/rank` is available to the posting owner or an
admin. A Gemini outage, invalid response, timeout, or changed posting preserves
previous scores and returns a retryable error. The web applicant dialog exposes
Rank/Re-rank applicants and keeps accept/reject as a separate manual action.

### Microsoft AD setup

Sign-in needs a registered app (or the credentials provided in class):

1. Azure portal → **Microsoft Entra ID → App registrations → New registration**
   (single tenant).
2. **Authentication → Add a platform → Web**, redirect URI exactly:
   `http://localhost:8081/assistlink/api/auth/callback`
3. Copy **Application (client) ID** → `AD_CLIENT_ID` and
   **Directory (tenant) ID** → `AD_TENANT_ID`.
4. **Certificates & secrets → New client secret** → copy the *Value* →
   `AD_CLIENT_SECRET`.
5. **API permissions → Microsoft Graph → Delegated → `User.Read`**, then grant
   admin consent if your tenant requires it.

Then visit <http://localhost:8081/assistlink/api/auth/login> to sign in. You are
redirected to Microsoft and back to `/auth/callback`, which returns a JWT.

> Visiting `/auth/callback` directly returns `400 Missing authorization code` —
> that is expected. Always start at `/auth/login`.

## Authentication & roles

- Sign-in is Microsoft AD → the API mints its own **30-minute JWT** carrying
  `{ userId, role }`. Send it as `Authorization: Bearer <token>`. The API verifies
  the token, then reads the current user and role from PostgreSQL for each protected
  request. The role embedded in an old token does not retain revoked permissions.
- Roles are `PROFESSOR`, `ADMIN`, `STUDENT`. **New AD users default to
  `STUDENT`**; admins assign saved roles in **Users**. Microsoft sign-in preserves
  an existing account’s assigned role.
- Ownership rules (e.g. a professor may only edit their own posts) are enforced
  in the service layer, on top of the role guard.

### Admin setup and professor onboarding

1. The first real admin signs in with their university Microsoft account once.
2. A trusted operator runs `npm run studio`, opens **User**, finds that exact
   email, sets `role` to `ADMIN`, and saves. No migration or reseeding is needed.
   The seeded admin (`admin@university.edu`) is only a development account, not
   a Microsoft identity.
3. Refresh the web app. The account now has a **Users** navigation item.
4. Ask each professor to sign in once. In **Users**, search their name or email,
   select **Professor**, click **Save**, and confirm the named account and roles.

Admins can assign Student, Professor, or Admin to other existing accounts.
Self-role changes are blocked, and at least one admin must remain. Serializable
transactions recheck the acting admin and retry conflicts so concurrent demotions
cannot remove every admin. Changing a role preserves profiles, applications, and
postings. Only the assigned role's permissions apply; a promoted professor's old
student profile remains saved but is no longer editable through student routes.

Changes take effect on the next protected request for both browser cookies and
bearer tokens. The UI refreshes account information on navigation and window
focus; users whose access changed are returned to a permitted view. Database
availability is now required for every real authenticated request. The local
`x-dev-user` bypass still impersonates a role without changing it in the database;
**Users** always shows saved assignments. Test immediate role refresh with real
JWT/cookie sessions, not development impersonation.

**Admin API** (under `/assistlink/api`):

- `GET /users?q=…&role=…&page=…`: search name/email (case-insensitive), optional
  `STUDENT`/`PROFESSOR`/`ADMIN` filter, positive page number. Returns
  `{ users, pagination: { page, pageSize, total, totalPages } }` in the normal
  success envelope. Pages contain 25 users, newest first; an out-of-range page
  clamps to the last page. Returned fields: `id`, `name`, `email`, `role`, `createdAt`.
- `PATCH /users/:id/role` with `{ "role": "PROFESSOR" }`: returns the updated
  user's same public fields. Invalid inputs return 400, insufficient access or
  self-changes 403, missing targets 404, and last-admin/concurrency conflicts 409.

No invitations, automatic Microsoft group mapping, or role-change audit history
are included. Users must have signed in before an admin can find them.

### Developer bypass (non-production only)

To test protected routes without a real AD login, send a JSON `x-dev-user`
header. It is **hard-blocked when `NODE_ENV=production`**.

```bash
curl http://localhost:8081/assistlink/api/posts \
  -H 'x-dev-user: {"userId":1,"role":"PROFESSOR","email":"prof@au.edu"}'
```

## Testing

```bash
npm run typecheck     # tsc --noEmit
./smoke-test.sh       # permission matrix + posts lifecycle + profiles + applications (server must be running)
```

`smoke-test.sh` assumes the seeded professor is `userId 1` and the seeded
student is `userId 3`; override with `PROF_ID=n STUDENT_ID=n ./smoke-test.sh`.

## Database

**Prisma migrations are the single source of truth.** Do not use
`prisma db push` — it bypasses migration history and causes drift.

- Create a migration after editing `schema.prisma`:
  `npx prisma migrate dev --name <describe_your_change>`
- Reset (drop, re-apply all migrations): `npm run migrate:reset`, then
  `npm run seed` (reset does not auto-seed)
- Apply in CI/production: `npm run migrate:deploy`
- Inspect data: `npm run studio`

> After **any** schema change, run `npm run generate` — otherwise TypeScript
> still sees the old model and you'll get "property does not exist" errors.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Dev server with auto-reload (`tsx watch`) |
| `npm start` | Start the server |
| `npm run typecheck` | Type-check without emitting |
| `npm run test:web` | HTTP, frontend, and Gemini ranking tests with mocked data |
| `npm run test:users:db` | PostgreSQL role and concurrency tests with temporary fixtures |
| `npm run seed` | Load sample data |
| `npm run seed:test-users` | Upsert 50 student and 9 professor test users across all faculties |
| `npm run migrate` | Create/apply migrations in development |
| `npm run migrate:deploy` | Apply migrations (CI/production) |
| `npm run migrate:reset` | Drop and re-apply all migrations |
| `npm run generate` | Generate the Prisma client |
| `npm run studio` | Open Prisma Studio |

## API endpoints

All routes are prefixed with `/assistlink/api`. Responses use a consistent
envelope: `{ success: true, data }` or `{ success: false, error: { message } }`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/auth/login` | — | Redirects to Microsoft AD |
| GET | `/auth/callback` | — | Exchanges the code, upserts user, returns a JWT |
| GET | `/auth/me` | any | The decoded current user |
| GET | `/users` | ADMIN | Search/filter users; 25 per page |
| PATCH | `/users/:id/role` | ADMIN | Assign a role to another user |
| GET | `/posts` | any | Open, non-private posts, newest first |
| GET | `/posts/:id` | any | A single post |
| POST | `/posts` | PROFESSOR, ADMIN | Create a posting |
| PATCH | `/posts/:id` | owner or ADMIN | Edit a posting |
| PATCH | `/posts/:id/close` | owner or ADMIN | Set status to `CLOSED` |
| GET | `/me/profile` | STUDENT | Your own profile (`null` if you haven't saved one yet) |
| PUT | `/me/profile` | STUDENT | Update `faculty`, `major`, `skills[]`, `resumeUrl`, `resumeText`, `workHoursPerWeek`, `gpa`, `bio` |
| POST | `/posts/:postId/applications` | STUDENT | Apply to an open post. 409 if already applied, 400 if closed or you haven't set up a profile |
| GET | `/posts/:postId/applications` | post owner or ADMIN | Applicant list with student profile fields and AI score/rationale, best-first |
| POST | `/posts/:id/rank` | post owner or ADMIN | Score all applicants with Gemini Flash and save AI rationale |
| PATCH | `/applications/:id` | post owner or ADMIN | Accept or reject an applicant (`ACCEPTED` / `REJECTED`) |

`events` and `peer` are mounted but return `501` until their phase lands.

**Update your profile** (`PUT /me/profile`), need at least one field:

```json
{
  "faculty": "Vincent Mary School of Engineering, Science and Technology",
  "major": "Computer Science",
  "skills": ["Python", "React"],
  "bio": "Second-year CS student interested in ML.",
  "gpa": 3.7,
  "workHoursPerWeek": 10
}
```

**Decide on an applicant** (`PATCH /applications/:id`):

```json
{ "status": "ACCEPTED" }
```

Only `ACCEPTED` or `REJECTED` are accepted — `PENDING` is the initial state an
application is created in, not a decision. Ownership is resolved through the
application's post, so only that post's author (or an ADMIN) can decide.

**Create a post** (`POST /posts`), every write route is zod-validated:

```json
{
  "title": "Research Assistant Needed",
  "details": "Help with image-classification research.",
  "requiredSkills": ["Python", "TensorFlow"],
  "jobCategory": "RA",
  "private": false
}
```

`title` min 3 chars · `details` required · `jobCategory` is `RA` or `TA` ·
`requiredSkills` defaults `[]` · `private` defaults `false`. `authorId` is taken
from the JWT, never the body.

## Project structure

```
assistlink/
├── src/
│   ├── server.ts             # boots the HTTP server
│   ├── app.ts                # builds the Express app
│   ├── config/               # env loading, fails fast on missing secrets
│   ├── lib/prisma.ts         # Prisma client singleton (pg driver adapter)
│   ├── middleware/           # auth, roles, validate, errors, logging
│   ├── modules/              # feature folders: routes → controller → service
│   ├── routes/index.ts       # mounts modules under /assistlink/api
│   ├── utils/                # ApiError, response envelope, asyncHandler
│   └── generated/            # generated Prisma client (git-ignored)
├── prisma/
│   ├── schema.prisma         # database schema
│   ├── migrations/           # migration history (source of truth)
│   └── seed.ts               # sample data
├── smoke-test.sh             # permission matrix + posts lifecycle
├── docker-compose.yml        # local PostgreSQL
└── .env.example              # environment template
```

Layering rule: routes call controllers, controllers call services, services call
the database. Keep each layer thin.

## Database schema

- **User** — students, professors, admins (`role` enum, linked to AD by `adObjectId`)
- **Student** — 1:1 extension of User (faculty, major, GPA, weekly hours, résumé, `skills[]`)
- **Post** — RA/TA postings (`details`, `jobCategory`, `private`, `status`)
- **Application** — a student's application (`status`, `aiScore`, `aiRationale`, one per student per post)
- **Department** — the nine faculty/school names used by student profiles

See `prisma/schema.prisma` for the full schema.

## Contributing

`main` is protected — it only changes through a reviewed pull request.

1. Branch from `main`: `git checkout -b feat/<short-description>`
2. Make your changes
3. Verify: `npm run typecheck` and `./smoke-test.sh` both pass
4. Commit and push: `git push -u origin HEAD`
5. Open a pull request into `main` and request a review from a teammate

If you changed `schema.prisma`, commit the generated migration in
`prisma/migrations/` — never the generated client in `src/generated/`.
