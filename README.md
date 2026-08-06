# College Football Fantasy League

A Next.js + TypeScript starter for a college football fantasy league with a snake draft and roster restrictions based on conference membership.

Roster rules now require 1 Big Ten, 1 Big 12, 1 SEC, 1 ACC, 2 Group-of-5 teams, 2 FCS teams, and 2 wildcard teams. If a user picks a second team from the same conference, that second pick is treated as a wildcard. Wildcards can also be used for independent teams or additional FCS teams.

## Getting Started

1. Copy `.env.example` to `.env` and update your PostgreSQL connection string, CFDB API key, and SMTP credentials. The `DATABASE_URL` must match the user/password of your local PostgreSQL instance, and the server must be running on port `7873`.

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Generate Prisma client and push the schema to your local PostgreSQL database:

```bash
npm run prisma:generate
npm run db:push
```

4. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Database Schema

The project includes a Prisma schema for:

- users, leagues, and league membership
- teams, conferences, and roster slots
- snake draft picks and roster assignments
- seasons, weeks, games, line data, and game results
- weekly scoring and external team mappings

## Seed Data

A simple conference seed file is included at `prisma/seed.js`. Run it after your database is available:

```bash
npm run db:seed
```

## Notes

- Use a local PostgreSQL database as your development backend.
- Store the `CFDB_API_KEY` securely in `.env`.
- Configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_FROM` to enable account verification emails.
- Spread pushes should count as a half-point for both teams when implementing scoring.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
