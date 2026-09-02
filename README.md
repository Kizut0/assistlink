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
   > **The app will not start until all five required secrets are set.** The
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

6. **Run the dev server**
   ```bash
   npm run dev
   ```
   Health check: <http://localhost:8081/assistlink/api/health>

## Environment

Five secrets are **required** — the app refuses to boot without them. In
production (Phase 07) these come from Azure Key Vault; the names in brackets are
the vault entry names.

| Variable | Purpose | Vault entry |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `DATABASE-URL` |
| `JWT_SECRET` | Signing key for session JWTs | `JWT-SECRET` |
| `OPENAI_API_KEY` | AI candidate ranking (Phase 05) | `OPENAI-API-KEY` |
| `PARTNER_API_KEY` | Consuming the partner Events API (Phase 06) | `PARTNER-API-KEY` |
| `AD_CLIENT_SECRET` | Microsoft AD OIDC client secret | `AD-CLIENT-SECRET` |

`AD_CLIENT_ID`, `AD_TENANT_ID` and `AD_REDIRECT_URI` are **public identifiers,
not secrets** — they are read from the environment in every environment and must
never be added to Key Vault.

Other config: `PORT` (default 8081), `NODE_ENV`, `JWT_EXPIRES_IN` (default `30m`).

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
  `{ userId, role }`. Send it as `Authorization: Bearer <token>`.
- Roles are `PROFESSOR`, `ADMIN`, `STUDENT`. **New AD users default to
  `STUDENT`**; promotion to PROFESSOR/ADMIN is an admin-only endpoint that lands
  in Phase 07. Until then, promote a user by hand in `npm run studio`.
- Ownership rules (e.g. a professor may only edit their own posts) are enforced
  in the service layer, on top of the role guard.

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
| `npm run seed` | Load sample data |
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
| GET | `/posts` | any | Open, non-private posts, newest first |
| GET | `/posts/:id` | any | A single post |
| POST | `/posts` | PROFESSOR, ADMIN | Create a posting |
| PATCH | `/posts/:id` | owner or ADMIN | Edit a posting |
| PATCH | `/posts/:id/close` | owner or ADMIN | Set status to `CLOSED` |
| GET | `/profiles/me` | STUDENT | Your own profile (auto-created empty on first read) |
| PUT | `/profiles/me` | STUDENT | Update `skills[]`, `resumeUrl`, `resumeText`, `workHoursPerWeek`, `gpa`, `bio` |
| POST | `/posts/:postId/applications` | STUDENT | Apply to an open post. 409 if already applied, 400 if closed or you haven't set up a profile |

Viewing applicants and accepting/rejecting them aren't built yet (still 501), same with `users`, `ranking`, `events`, `peer`.

**Update your profile** (`PUT /profiles/me`), need at least one field:

```json
{
  "skills": ["Python", "React"],
  "bio": "Second-year CS student interested in ML.",
  "gpa": 3.7,
  "workHoursPerWeek": 10
}
```

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
- **Student** — 1:1 extension of User (GPA, weekly hours, résumé, `skills[]`)
- **Post** — RA/TA postings (`details`, `jobCategory`, `private`, `status`)
- **Application** — a student's application (`status`, `aiScore`, `aiRationale`, one per student per post)
- **Department** — academic departments

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
