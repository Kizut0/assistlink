# AssistLink

AssistLink connects university students with research and teaching assistant
opportunities. Students maintain profiles and apply to openings; professors review
applications and can use AI-assisted candidate ranking; admins manage user
roles.

**Stack:** Node.js 22, TypeScript, Express 5, Prisma 7, PostgreSQL 16,
Microsoft Entra ID/MSAL, and OpenRouter.

All API routes use the `/assistlink/api` prefix. The web interface is available at
`/assistlink/` and is served directly by Express.

Workspace pages have shareable URLs: `/assistlink/opportunities/`,
`/assistlink/opportunities/<id>/`, `/assistlink/profile/`,
`/assistlink/applications/`, `/assistlink/manage/`, and `/assistlink/users/`.
Opening one without a browser session redirects to `/assistlink/login/`; sign-in
returns to the requested page. Profile and applications are student pages, while
manage and users require their corresponding roles in the app and API.

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

Ranking is optional until used. The production demo uses OpenRouter's lightweight
`gpt-oss-20b` endpoint:

```env
RANKING_PROVIDER=openrouter
OPENROUTER_MODEL=openai/gpt-oss-20b
# Local development only; production loads OPENROUTER-API-KEY from Key Vault.
OPENROUTER_API_KEY=your-openrouter-key
```

Other settings are documented in `.env.example`. In production, set
`AZURE_KEY_VAULT_URL`; startup uses `DefaultAzureCredential` to load
`DATABASE-URL`, `JWT-SECRET`, `AD-CLIENT-SECRET`, and the optional
`OPENROUTER-API-KEY` and `DEMO-AUTH-PASSCODE` before initializing the application. Managed identity is
recommended on Azure; service-principal and Azure CLI credentials also work.

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

For a controlled production demonstration, set `DEMO_AUTH_ENABLED=true` and add
the `DEMO-AUTH-PASSCODE` Key Vault secret. The blank sign-in form then accepts
the shared passcode with any account created by `npm run seed:demo`: students
`student1@university.edu` through `student50@university.edu`, all nine seeded
professor emails, and `admin@university.edu`. The form never displays the
accounts or stores the passcode.

## Main API routes

All paths below are relative to `/assistlink/api`.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Health check |
| `GET` | `/auth/login` | Public | Start Microsoft sign-in |
| `GET` | `/auth/callback` | Public | Complete sign-in |
| `POST` | `/auth/demo-login` | Demo mode | Sign in a whitelisted seeded account |
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
| `POST` | `/me/resume` | Student | Upload and extract a résumé PDF |
| `GET` | `/me/resume` | Student | Open own résumé PDF |
| `DELETE` | `/me/resume` | Student | Delete own résumé and extracted text |
| `GET` | `/me/applications` | Student | Track own applications |
| `POST` | `/posts/:postId/applications` | Student | Apply to a post |
| `GET` | `/posts/:postId/applications` | Owner/Admin | Review applicants |
| `GET` | `/posts/:postId/applications/:applicationId/resume` | Owner/Admin | Open an applicant résumé PDF |
| `PATCH` | `/applications/:id` | Owner/Admin | Accept or reject an applicant |
| `POST` | `/posts/:id/rank` | Owner/Admin | Rank applicants with the configured AI provider |
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
| `npm run verify:openrouter` | Verify the configured OpenRouter key, model, and structured-output request |
| `npm run seed` | Seed demo data |
| `npm run seed:demo` | Idempotently seed the Azure/local demo dataset |
| `npm run seed:test-users` | Seed additional student and professor fixtures |
| `npm run migrate` | Create/apply a development migration |
| `npm run migrate:deploy` | Apply committed migrations |
| `npm run migrate:reset` | Reset the local database |
| `npm run generate` | Regenerate the Prisma client |
| `npm run studio` | Open Prisma Studio |

`./smoke-test.sh` exercises the main workflow against a running seeded database.

## Azure VM deployment

The production Compose stack runs both the API and PostgreSQL 16 on the VM. The
database is private to the Compose network and persists in a named Docker volume;
only API port 8081 is bound to VM localhost. The API uses the VM's managed
identity to read Key Vault. Copy `.env.production.example` to `.env.production`,
create the host-side PostgreSQL password file, add
`deploy/nginx/assistlink.conf` to the domain's HTTPS server block, then run
`./deploy.sh`. Follow the complete [Azure VM checklist](deploy/AZURE_VM.md) for
identity, secrets, first-admin setup, backups, networking, TLS, and verification.
This single-VM database design is economical but not highly available, so keep
verified backups outside the VM.

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
