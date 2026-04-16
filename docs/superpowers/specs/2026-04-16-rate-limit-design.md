# Rate Limiting Design

**Date:** 2026-04-16  
**Status:** Approved

## Overview

Implement per-route rate limiting using `@nestjs/throttler` on a NestJS API backed by Fastify. The goal is to protect auth endpoints against brute force and public feed endpoints against scraping, while allowing higher throughput for authenticated news routes.

## Constraints

- HTTP adapter: Fastify (not Express)
- Auth routes (`/api/auth/*`) are handled internally by `@thallesp/nestjs-better-auth` -- they are not standard NestJS controllers, so `@Throttle` decorators cannot be applied to them directly
- Storage: in-memory initially; Redis migration must be possible by swapping only the storage provider, with zero changes to controllers

## Rate Limits

| Throttler name | Limit     | TTL | Applied to                                        |
|----------------|-----------|-----|---------------------------------------------------|
| `auth`         | 20 req/min | 60s | Global default -- covers `/api/auth/*` and any unspecified route |
| `news`         | 100 req/min | 60s | All authenticated NewsController routes (controller-level override) |
| `feed`         | 200 req/min | 60s | `GET /news/feed` and `GET /news/feed/:id` (method-level override) |

Rate limit key: client IP (default `@nestjs/throttler` behavior with Fastify).

## Architecture

### ThrottlerModule (AppModule)

Register `ThrottlerModule.forRoot` with the three named throttlers. Add `APP_GUARD` with `ThrottlerGuard` to apply the `auth` throttler globally. This automatically covers all routes including better-auth internal routes.

```typescript
ThrottlerModule.forRoot([
  { name: 'auth', ttl: 60000, limit: 20 },
  { name: 'news', ttl: 60000, limit: 100 },
  { name: 'feed', ttl: 60000, limit: 200 },
])
```

### NewsController

Apply `@Throttle({ news: { ttl: 60000, limit: 100 } })` at the controller level to override the global `auth` throttler for all authenticated routes.

Apply `@Throttle({ feed: { ttl: 60000, limit: 200 } })` at the method level on `feed()` and `feedItem()` to override to the higher feed limit.

Use `@SkipThrottle({ auth: true, news: true })` on feed methods to ensure only the `feed` throttler applies there, avoiding double-counting from the global guard and controller-level decorator.

### Storage

Default: `ThrottlerStorageService` (in-memory, built into `@nestjs/throttler`).

To migrate to Redis: install `@nestjs-throttler/storage-redis`, replace the storage provider in `ThrottlerModule.forRoot`. No changes needed in controllers or guards.

## Error Handling

When a limit is exceeded, `ThrottlerGuard` throws `ThrottledException`, which NestJS maps to `429 Too Many Requests`. No custom exception filter is required for the initial implementation.

`RateLimit-*` response headers are not injected by default in the Fastify adapter. This can be added later via a custom guard extension if needed.

## Testing

- Unit tests for `NewsController` using `@nestjs/testing` with `ThrottlerModule` configured in-memory
- Mock or skip the guard in existing unit tests that do not focus on rate limiting
- Verify that decorated methods carry the correct throttler metadata using `Reflector` if needed
- No new e2e tests required for the throttler itself -- focus is on correct decorator configuration

## Files to Create or Modify

| File | Change |
|------|--------|
| `package.json` | Add `@nestjs/throttler` dependency |
| `src/app.module.ts` | Import `ThrottlerModule`, add `APP_GUARD` |
| `src/modules/news/news.controller.ts` | Add `@Throttle` at controller and method level |
| `src/modules/news/news.controller.spec.ts` | Update test setup to include `ThrottlerModule` |
