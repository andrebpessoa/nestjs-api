# OpenAPI + Scalar Integration (NestJS)

Date: 2026-04-16
Status: approved (design), pending implementation

## Overview

Implement OpenAPI documentation in the NestJS API and expose it through Scalar UI for local development only.

Chosen decisions:
- Environment: local/dev only
- Routes: `GET /docs` (Scalar UI) and `GET /openapi.json` (OpenAPI spec)
- Documentation depth: rich endpoint documentation (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, etc.)
- Security schema in docs: cookie/session auth
- Architecture style: dedicated helper (`setupOpenApi`) called from `main.ts`

## Scope

In scope:
- Add OpenAPI generation with `@nestjs/swagger`
- Add Scalar API Reference with `@scalar/nestjs-api-reference`
- Add centralized setup function in `src/lib/openapi.ts`
- Expose `/openapi.json` and `/docs` in non-production environments
- Use `cleanupOpenApiDoc` from `nestjs-zod` before serving the spec
- Enrich `news` endpoints with Swagger decorators and auth docs

Out of scope:
- Public documentation in production
- Static OpenAPI file generation/versioning pipeline
- Broad documentation of every module outside the current `news` module

## Architecture

### 1) OpenAPI setup helper

Create `src/lib/openapi.ts` with a single responsibility: setup API docs for a running Nest app.

Responsibilities:
- Build OpenAPI metadata (`DocumentBuilder`)
- Register cookie auth security scheme
- Create OpenAPI document (`SwaggerModule.createDocument`)
- Normalize generated schema via `cleanupOpenApiDoc`
- Expose `GET /openapi.json`
- Mount Scalar at `GET /docs`, pointing to `/openapi.json`

### 2) Bootstrap integration

In `src/main.ts`:
- Keep existing bootstrap flow
- Call `setupOpenApi(app)` only when `process.env.NODE_ENV !== "production"`

This keeps `main.ts` concise while isolating documentation behavior in a focused module.

### 3) Endpoint documentation enrichment

In `src/modules/news/news.controller.ts`:
- Add `@ApiTags("news")` on controller
- Add per-route `@ApiOperation` summaries/descriptions
- Add response decorators (`@ApiOkResponse`, `@ApiCreatedResponse`, `@ApiNotFoundResponse`, `@ApiUnauthorizedResponse`, etc.)
- Add `@ApiCookieAuth()` on authenticated routes (create, list-all, find-one, update, remove)

### 4) DTO and response documentation strategy

- Keep current Zod DTOs for request/query validation (`createZodDto`)
- Introduce explicit response DTO classes for documentation clarity where needed (for item and paginated responses)
- Avoid documenting Prisma model types directly in controller responses

## Data Flow

1. App starts in dev.
2. `main.ts` calls `setupOpenApi(app)`.
3. Helper builds OpenAPI config and document.
4. Helper runs `cleanupOpenApiDoc(document)` for Zod/OpenAPI compatibility.
5. Helper serves `/openapi.json`.
6. Helper mounts Scalar on `/docs`, configured with `url: "/openapi.json"`.
7. Developers explore and test endpoints through Scalar.

Production flow:
- `/docs` and `/openapi.json` are not registered, resulting in `404`.

## Error Handling and Safety

- Docs routes are gated to non-production to reduce attack surface.
- OpenAPI metadata must not contain secrets or internal sensitive values.
- If documentation setup throws at startup in dev, fail fast to surface misconfiguration.
- Use `cleanupOpenApiDoc` to prevent schema inconsistencies with Zod-generated DTOs.

## Testing Strategy

### E2E behavior checks

Development mode:
- `GET /openapi.json` returns `200` and valid OpenAPI payload
- `GET /docs` returns `200`

Production mode:
- `GET /openapi.json` returns `404`
- `GET /docs` returns `404`

### Spec content checks

Validate that generated spec includes:
- `news` tag grouping
- Operation summaries for endpoints
- Auth requirement metadata (cookie scheme) on protected endpoints
- Expected response status documentation on core routes

## Implementation Notes

- Fastify is already used by this app; setup should remain compatible with current adapter.
- Current project already uses `nestjs-zod`, so OpenAPI generation must pass through `cleanupOpenApiDoc`.
- Existing validation setup should remain unchanged functionally; this work adds documentation surfaces and metadata.

## Acceptance Criteria

1. In development, `/docs` renders Scalar UI and `/openapi.json` is accessible.
2. In production, both docs routes are unavailable (`404`).
3. `news` endpoints appear in docs with clear operation descriptions and response metadata.
4. Cookie-based auth scheme is present in OpenAPI and applied to protected endpoints.
5. Generated OpenAPI is cleaned with `cleanupOpenApiDoc`.

