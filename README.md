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

5. **Run database migrations**
   ```bash
   npx prisma db push
   ```

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

- **View/manage data**: `npx prisma studio`
- **Generate Prisma client**: `npx prisma generate`
- **Create new migration**: `npx prisma db push`

### Scripts

- `npm run dev` - Start dev server with auto-reload
- `npm start` - Start production server
- `npm run seed` - Run seed script

### Project Structure

```
assistlink/
├── src/
│   ├── server.js       # Main server entry point
│   ├── app.js          # Express app configuration
│   └── generated/      # Generated Prisma client
├── prisma/
│   ├── schema.prisma   # Database schema
│   ├── migrations/     # Database migrations
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
- **APIKey** - API authentication keys

See `prisma/schema.prisma` for full schema.
