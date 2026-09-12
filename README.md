# AssistLink

AssistLink connects university students with research and teaching assistant
opportunities. Students maintain profiles and apply to openings; professors review
applications and can use Gemini-assisted candidate ranking; admins manage user
roles.

**Stack:** Node.js 22, TypeScript, Express 5, Prisma 7, PostgreSQL 16,
Microsoft Entra ID/MSAL, and Gemini.

All API routes use the `/assistlink/api` prefix. The web interface is available at
`/assistlink/` and is served directly by Express.

## Quick start

Requirements: Node.js 22+, Docker, and Docker Compose.

```bash
npm install
cp .env.example .env
docker compose up -d
npm run migrate:deploy
npm run generate
npm run seed
npm run dev
```

Open:

- Web app: <http://localhost:8081/assistlink/>
- Health check: <http://localhost:8081/assistlink/api/health>

Prisma migrations are the database source of truth. Do not use `prisma db push`.
After changing `prisma/schema.prisma`, create a migration and run
`npm run generate`.

## Configuration

The app requires these values at startup:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Session-token signing secret |
| `AD_CLIENT_SECRET` | Microsoft Entra application secret |

Real Microsoft sign-in also needs `AD_CLIENT_ID`, `AD_TENANT_ID`, and an
`AD_REDIRECT_URI` registered with Entra. The local default callback is
`http://localhost:8081/assistlink/api/auth/callback`.

Gemini ranking is optional until used:

```env
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-2.5-flash
```

Other settings are documented in `.env.example`. Production secrets are intended
to come from Azure Key Vault; runtime Key Vault loading is not implemented yet.

## Roles and sign-in

- **Student:** update a profile, browse openings, apply, and track applications.
- **Professor:** create and manage postings, review applicants, and run ranking.
- **Admin:** manage user roles and perform professor actions.

Microsoft sign-in creates or updates the user and issues a short-lived JWT. Browser
sessions use an HTTP-only cookie; API clients can use
`Authorization: Bearer <token>`. Protected requests reload the current database
role, so role changes take effect without issuing a new token.

For local development only, protected routes accept an `x-dev-user` header:

```bash
curl http://localhost:8081/assistlink/api/posts \
  -H 'x-dev-user: {"userId":1,"role":"PROFESSOR"}'
```

The default seed uses professor ID 1, admin ID 2, and student ID 3. The bypass is
disabled when `NODE_ENV=production`.

## Main API routes

All paths below are relative to `/assistlink/api`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Health check |
| `GET` | `/auth/login` | Public | Start Microsoft sign-in |
| `GET` | `/auth/callback` | Public | Complete sign-in |
| `GET` | `/auth/me` | Authenticated | Current user |
| `POST` | `/auth/logout` | Browser session | Clear session |
| `GET` | `/posts` | Authenticated | List open public posts |
| `GET` | `/posts?mine=1` | Authenticated | List the caller's posts |
| `GET` | `/posts/workspace` | Professor/Admin | Posting dashboard and application counts |
| `GET` | `/posts/:id` | Authenticated | Get a post |
| `POST` | `/posts` | Professor/Admin | Create a post |
| `PATCH` | `/posts/:id` | Owner/Admin | Edit a post |
| `PATCH` | `/posts/:id/close` | Owner/Admin | Close a post |
| `GET` | `/me/profile` | Student | Get own profile |
| `PUT` | `/me/profile` | Student | Create or update own profile |
| `GET` | `/me/applications` | Student | Track own applications |
| `POST` | `/posts/:postId/applications` | Student | Apply to a post |
| `GET` | `/posts/:postId/applications` | Owner/Admin | Review applicants |
| `PATCH` | `/applications/:id` | Owner/Admin | Accept or reject an applicant |
| `POST` | `/posts/:id/rank` | Owner/Admin | Rank applicants with Gemini |
| `GET` | `/users` | Admin | Search and filter users |
| `PATCH` | `/users/:id/role` | Admin | Assign a user role |

Responses use `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "message": "..." } }`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Start the server |
| `npm run typecheck` | Type-check the project |
| `npm run test:web` | Run API, frontend, auth, profile, and ranking tests |
| `npm run test:users:db` | Run opt-in PostgreSQL role/concurrency tests |
| `npm run seed` | Seed demo data |
| `npm run seed:test-users` | Seed additional student and professor fixtures |
| `npm run migrate` | Create/apply a development migration |
| `npm run migrate:deploy` | Apply committed migrations |
| `npm run migrate:reset` | Reset the local database |
| `npm run generate` | Regenerate the Prisma client |
| `npm run studio` | Open Prisma Studio |

`./smoke-test.sh` exercises the main workflow against a running seeded database.

## Project layout

```text
src/
  config/       Environment configuration
  middleware/   Authentication, authorization, validation, and errors
  modules/      Feature routes, controllers, services, and validators
  app.ts        Express application
  server.ts     HTTP server entry point
prisma/         Schema, migrations, and seed scripts
public/         Browser interface
tests/          Automated tests
```

Routes call controllers, controllers call services, and services own database
access and authorization-sensitive business rules.
