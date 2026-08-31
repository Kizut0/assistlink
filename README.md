# AssistLink

A platform connecting students with research and teaching opportunities.

## Setup

### Prerequisites
- Node.js 22+
- Docker & Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd assistlink
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your configuration if needed (defaults are pre-filled for local development).

4. **Start PostgreSQL database**
   ```bash
   docker-compose up -d
   ```

5. **Apply database migrations**
   ```bash
   npx prisma migrate deploy   # apply existing migrations to the DB
   npx prisma generate         # generate the Prisma client
   ```
   For local development you can instead run `npm run migrate`
   (`prisma migrate dev`), which applies pending migrations and regenerates
   the client in one step.

6. **Seed the database with sample data** (optional)
   ```bash
   npm run seed
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:8081`

### Database

This project uses **Prisma migrations** as the single source of truth for the
database schema. Do not use `prisma db push` — it bypasses migration history
and will cause drift.

- **View/manage data**: `npm run studio` (`npx prisma studio`)
- **Generate Prisma client**: `npm run generate` (`npx prisma generate`)
- **Create a new migration** (after editing `schema.prisma`):
  ```bash
  npx prisma migrate dev --name <describe_your_change>
  ```
- **Reset the database** (drop, re-apply all migrations, then re-seed manually):
  ```bash
  npm run migrate:reset   # then: npm run seed
  ```
- **Apply migrations in CI/production**: `npm run migrate:deploy`

### Scripts

- `npm run dev` - Start dev server with auto-reload
- `npm start` - Start production server
- `npm run seed` - Run seed script
- `npm run migrate` - Create/apply migrations in development (`prisma migrate dev`)
- `npm run migrate:deploy` - Apply migrations (CI/production)
- `npm run migrate:reset` - Drop and re-apply all migrations
- `npm run generate` - Generate the Prisma client
- `npm run studio` - Open Prisma Studio

### Project Structure

```
assistlink/
├── src/
│   ├── server.js       # Main server entry point
│   ├── app.js          # Express app configuration
│   └── generated/      # Generated Prisma client (git-ignored)
├── prisma/
│   ├── schema.prisma   # Database schema
│   ├── migrations/     # Database migrations (source of truth)
│   └── seed.ts         # Seed script (TypeScript)
├── docker-compose.yml  # Docker configuration
├── package.json        # Dependencies & scripts
└── .env.example        # Environment variables template
```

### API Endpoints

- `GET /assistlink/api/health` - Health check endpoint

### Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Push to your branch
5. Create a pull request

### Database Schema

The project uses Prisma ORM with PostgreSQL. Main models:
- **User** - Students, professors, admins
- **Student** - Student profiles with skills
- **Post** - Job/RA/TA postings
- **Application** - Student applications to posts
- **Department** - Academic departments

See `prisma/schema.prisma` for the full schema.
