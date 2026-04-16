# News: Text Search, Cursor Pagination, and Filters

Date: 2026-04-16
Status: approved

## Overview

Add text search, cursor-based pagination, and complex filters to the `News` module. Both the public feed (`GET /news/feed`) and the admin listing (`GET /news`) receive query params for search, pagination, and filtering. All validation is handled by Zod DTOs via `ZodValidationPipe`.

## Scope

- Text search on `title` via `LIKE %q%` (Prisma `contains`)
- Cursor-based pagination using Prisma `cursor` + `take` + `skip`
- Filters: `published`, `authorId`, `dateFrom`, `dateTo`
- Arbitrary sort via `sortBy` + `order`
- `ZodValidationPipe` registered globally in `main.ts`
- No changes to `findOne`, `findPublicById`, `create`, `update`, `remove`

Out of scope:
- Full-text search on `content` (JSON field, SQLite limitation)
- FTS5 or raw SQL search
- Offset/page-based pagination

## Architecture

### Response shape

Both paginated endpoints return:

```ts
interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}
```

Defined as a module-local interface in `news.service.ts`. `nextCursor` is the `id` of the last item in `data`, or `null` when no further pages exist. The client passes it as `?cursor=<id>` on the next request.

### Cursor strategy

Fetch `limit + 1` records. If the result length exceeds `limit`, a next page exists: return the first `limit` items and set `nextCursor` to the last item's `id`. Otherwise return all items with `nextCursor: null`.

When a cursor is provided, add `cursor: { id: cursor }, skip: 1` to skip the cursor record itself.

`orderBy` is always compound: `[{ [sortBy]: order }, { id: order }]` to guarantee stable ordering when `sortBy` values tie.

## New Files

### `src/modules/news/dto/feed-query.dto.ts`

```ts
import { createZodDto } from "nestjs-zod";
import * as z from "zod";

export const feedQuerySchema = z
  .object({
    q:        z.string().trim().min(1).optional(),
    cursor:   z.string().optional(),
    limit:    z.coerce.number().int().min(1).max(50).default(20),
    dateFrom: z.coerce.date().optional(),
    dateTo:   z.coerce.date().optional(),
    sortBy:   z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
    order:    z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
```

### `src/modules/news/dto/news-query.dto.ts`

```ts
import { createZodDto } from "nestjs-zod";
import * as z from "zod";
import { feedQuerySchema } from "./feed-query.dto";

export const newsQuerySchema = feedQuerySchema
  .extend({
    published: z.coerce.boolean().optional(),
    authorId:  z.string().optional(),
  })
  .strict();

export class NewsQueryDto extends createZodDto(newsQuerySchema) {}
```

## Modified Files

### `src/main.ts`

Register `ZodValidationPipe` globally so query params and bodies are validated:

```ts
import { ZodValidationPipe } from "nestjs-zod";

app.useGlobalPipes(new ZodValidationPipe());
```

### `src/modules/news/news.service.ts`

Define `PaginatedResult` at the top of the file (module-local interface, not exported):

```ts
interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
}
```

Add two private helpers:

```ts
private buildCursorArgs(cursor: string | undefined, limit: number) {
  return cursor
    ? { take: limit + 1, skip: 1, cursor: { id: cursor } }
    : { take: limit + 1 };
}

private paginateResult<T extends { id: string }>(
  items: T[],
  limit: number,
): PaginatedResult<T> {
  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;
  return {
    data,
    nextCursor: hasNextPage ? data[data.length - 1].id : null,
  };
}
```

Updated `findPublicFeed`:

```ts
async findPublicFeed(query: FeedQueryDto): Promise<PaginatedResult<News>> {
  const { q, cursor, limit, dateFrom, dateTo, sortBy, order } = query;

  const where: Prisma.NewsWhereInput = {
    published: true,
    ...(q && { title: { contains: q } }),
    ...((dateFrom || dateTo) && {
      createdAt: { gte: dateFrom, lte: dateTo },
    }),
  };

  const items = await this.prisma.news.findMany({
    where,
    orderBy: [{ [sortBy]: order }, { id: order }],
    ...this.buildCursorArgs(cursor, limit),
  });

  return this.paginateResult(items, limit);
}
```

Updated `findAll` (admin):

```ts
async findAll(query: NewsQueryDto): Promise<PaginatedResult<News>> {
  const { q, cursor, limit, dateFrom, dateTo, sortBy, order, published, authorId } = query;

  const where: Prisma.NewsWhereInput = {
    ...(published !== undefined && { published }),
    ...(authorId && { authorId }),
    ...(q && { title: { contains: q } }),
    ...((dateFrom || dateTo) && {
      createdAt: { gte: dateFrom, lte: dateTo },
    }),
  };

  const items = await this.prisma.news.findMany({
    where,
    orderBy: [{ [sortBy]: order }, { id: order }],
    ...this.buildCursorArgs(cursor, limit),
  });

  return this.paginateResult(items, limit);
}
```

### `src/modules/news/news.controller.ts`

```ts
@AllowAnonymous()
@Get("feed")
feed(@Query() query: FeedQueryDto) {
  return this.newsService.findPublicFeed(query);
}

@Get()
findAll(@Query() query: NewsQueryDto) {
  return this.newsService.findAll(query);
}
```

## Tests

### Unit: `news.service.spec.ts` (new cases)

- `findPublicFeed` with `q` builds `where: { published: true, title: { contains: q } }`
- `findPublicFeed` with `cursor` passes `cursor: { id }`, `skip: 1`, `take: limit + 1`
- `findPublicFeed` with `limit + 1` results sets `nextCursor` to last item id
- `findPublicFeed` with fewer results than limit sets `nextCursor: null`
- `findPublicFeed` with `dateFrom`/`dateTo` builds `createdAt: { gte, lte }`
- `findAll` with `published`, `authorId` filters builds correct `where`

### Unit: `news.controller.spec.ts` (new cases)

- `feed` delegates `FeedQueryDto` to `newsService.findPublicFeed`
- `findAll` delegates `NewsQueryDto` to `newsService.findAll`

### E2E: `news.e2e-spec.ts` (new cases)

- `GET /news/feed?q=<term>` returns only published items matching title
- `GET /news/feed?limit=1` returns `data` with 1 item and non-null `nextCursor`
- `GET /news/feed?limit=1&cursor=<id>` returns the next item
- `GET /news/feed?limit=100` with fewer items returns `nextCursor: null`
- `GET /news?published=false` (authenticated) returns only drafts
- `GET /news?authorId=<id>` (authenticated) returns only that author's items

## Constraints

- SQLite does not support `mode: 'insensitive'` in Prisma string filters. Title search is case-sensitive.
- `content` is a `Json` field. Prisma does not expose `contains` on Json in SQLite. Content search is out of scope.
- `sortBy=title` produces case-sensitive lexicographic ordering in SQLite.
