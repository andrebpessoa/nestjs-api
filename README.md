# nest-api

NestJS API with Prisma (libSQL/SQLite), better-auth session authentication, Zod DTOs, and OpenAPI docs served via Scalar.

## Stack

- NestJS 11 with Fastify adapter
- Prisma 7 + `@prisma/adapter-libsql` (SQLite)
- better-auth via `@thallesp/nestjs-better-auth`
- nestjs-zod for DTO validation
- vitest 4 for unit and e2e tests
- biome for lint and format
- bun as runtime and package manager

## Setup

```bash
bun install
cp .env.example .env
bunx prisma migrate deploy
```

## Development

```bash
bun run start:dev      # watch mode
bun run start          # single run
bun run start:prod     # built output
```

OpenAPI docs are exposed in non-production environments:

- JSON spec: `http://localhost:3000/openapi.json`
- Scalar UI: `http://localhost:3000/docs`

## Tests

```bash
bun run test           # unit tests (vitest project: unit)
bun run test:e2e       # e2e tests (vitest project: e2e, separate test.db)
bun run test:cov       # coverage
```

E2E runs against an isolated `test.db` managed by the global setup. Unit tests do not touch the database.

## Quality

```bash
bun run check          # biome check with autofix
bun run ci:lint        # biome CI check (no writes)
```

## Project layout

```
src/
  config/              # env validation
  database/prisma/     # PrismaService, schema, migrations
  lib/                 # auth config, openapi setup
  modules/news/        # feature module (controller, service, dto)
  generated/prisma/    # prisma client output (gitignored)
  main.ts              # Nest bootstrap
test/                  # e2e specs and setup
```
