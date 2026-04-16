# Soft Delete -- Modulo de Noticias -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o hard delete do model `News` por soft delete via campo `deletedAt DateTime?`, filtrando registros deletados nas rotas publicas e na listagem autenticada por padrao, e permitindo restauracao via `PATCH /news/:id`.

**Architecture:** Adiciona `deletedAt` ao schema Prisma e gera uma migracao. O service filtra `deletedAt: null` em rotas publicas e na listagem autenticada; `findOne` e `update` ignoram o filtro para permitir visualizacao e restauracao. `remove` faz `update` com `deletedAt: new Date()` e retorna 404 se ja deletado. Restore e feito via `PATCH` com `{ "deleted": false }`.

**Tech Stack:** NestJS, Prisma 7 (SQLite/libsql), Zod v4, Vitest, nestjs-zod

---

## Files Modified

- `src/database/prisma/schema.prisma` -- adiciona `deletedAt DateTime?`
- `src/modules/news/dto/update-news.dto.ts` -- adiciona `deleted?: boolean`
- `src/modules/news/dto/news-query.dto.ts` -- adiciona `includeDeleted?: boolean`
- `src/modules/news/dto/news-response.dto.ts` -- adiciona `deletedAt` nullable
- `src/modules/news/news.service.ts` -- implementa soft delete em todos os metodos relevantes
- `src/modules/news/news.service.spec.ts` -- atualiza expects existentes + adiciona novos casos

---

## Task 1: Schema migration

**Files:**
- Modify: `src/database/prisma/schema.prisma`

- [ ] **Step 1: Adicionar campo `deletedAt` ao model News**

Em `src/database/prisma/schema.prisma`, localizar o model `News` e adicionar o campo apos `updatedAt`:

```prisma
model News {
  id        String    @id @default(cuid())
  title     String
  content   Json
  published Boolean   @default(false)
  authorId  String
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([authorId])
  @@map("news")
}
```

- [ ] **Step 2: Gerar migracao e cliente**

```bash
bunx prisma migrate dev --name add-news-deleted-at
```

Expected: migracao criada em `src/database/prisma/migrations/` e cliente regenerado. O campo `deletedAt` aparece no tipo `News` gerado.

- [ ] **Step 3: Verificar que o cliente foi atualizado**

```bash
grep -r "deletedAt" src/database/prisma/generated/prisma/models/News.ts | head -5
```

Expected: linhas com `deletedAt` no tipo gerado.

- [ ] **Step 4: Commit**

```bash
git add src/database/prisma/schema.prisma src/database/prisma/migrations/ src/database/prisma/generated/
git commit -m "feat: add deletedAt field to News schema"
```

---

## Task 2: Atualizar DTOs

**Files:**
- Modify: `src/modules/news/dto/update-news.dto.ts`
- Modify: `src/modules/news/dto/news-query.dto.ts`
- Modify: `src/modules/news/dto/news-response.dto.ts`

- [ ] **Step 1: Adicionar `deleted` ao UpdateNewsDto**

Conteudo completo de `src/modules/news/dto/update-news.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import * as z from "zod";
import { createNewsSchema } from "./create-news.dto";

export const updateNewsSchema = createNewsSchema
	.partial()
	.extend({ deleted: z.boolean().optional() })
	.strict();

export class UpdateNewsDto extends createZodDto(updateNewsSchema) {}
```

- [ ] **Step 2: Adicionar `includeDeleted` ao NewsQueryDto**

Conteudo completo de `src/modules/news/dto/news-query.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import * as z from "zod";
import { feedQuerySchema } from "./feed-query.dto";

export const newsQuerySchema = feedQuerySchema
	.extend({
		published: z
			.enum(["true", "false"])
			.transform((v) => v === "true")
			.optional(),
		authorId: z.string().optional(),
		includeDeleted: z
			.enum(["true", "false"])
			.transform((v) => v === "true")
			.optional(),
	})
	.strict();

export class NewsQueryDto extends createZodDto(newsQuerySchema) {}
```

- [ ] **Step 3: Adicionar `deletedAt` ao NewsResponseDto**

Conteudo completo de `src/modules/news/dto/news-response.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import * as z from "zod";

export const newsResponseSchema = z.object({
	id: z.string(),
	title: z.string(),
	content: z.record(z.string(), z.unknown()),
	published: z.boolean(),
	authorId: z.string(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	deletedAt: z.iso.datetime().nullable(),
});

export class NewsResponseDto extends createZodDto(newsResponseSchema) {}

export const paginatedNewsResponseSchema = z.object({
	data: z.array(newsResponseSchema),
	nextCursor: z.string().nullable(),
});

export class PaginatedNewsResponseDto extends createZodDto(
	paginatedNewsResponseSchema,
) {}
```

- [ ] **Step 4: Verificar tipos**

```bash
bun run check-types 2>&1 | head -30
```

Expected: sem erros de tipo nos arquivos de DTO.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/dto/
git commit -m "feat: add soft delete fields to news DTOs"
```

---

## Task 3: TDD -- findPublicFeed e findPublicById

**Files:**
- Modify: `src/modules/news/news.service.spec.ts`
- Modify: `src/modules/news/news.service.ts`

- [ ] **Step 1: Atualizar expects existentes e adicionar testes para filtro de deletedAt**

Em `src/modules/news/news.service.spec.ts`, localizar e atualizar os seguintes testes:

**Teste existente "findPublicFeed with defaults queries only published news"** -- alterar o `where` esperado:

```ts
it("findPublicFeed with defaults queries only published news", async () => {
	prismaMock.news.findMany.mockResolvedValue([]);

	const query = feedQuerySchema.parse({});
	const result = await service.findPublicFeed(query);

	expect(prismaMock.news.findMany).toHaveBeenCalledWith({
		where: { published: true, deletedAt: null },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: 21,
	});
	expect(result).toEqual({ data: [], nextCursor: null });
});
```

**Teste existente "findPublicFeed with q adds title contains filter"** -- alterar o `where` esperado:

```ts
it("findPublicFeed with q adds title contains filter", async () => {
	prismaMock.news.findMany.mockResolvedValue([]);

	const query = feedQuerySchema.parse({ q: "nestjs" });
	await service.findPublicFeed(query);

	expect(prismaMock.news.findMany).toHaveBeenCalledWith(
		expect.objectContaining({
			where: { published: true, title: { contains: "nestjs" }, deletedAt: null },
		}),
	);
});
```

**Teste existente "findPublicFeed with dateFrom and dateTo..."** -- adicionar verificacao de deletedAt:

```ts
it("findPublicFeed with dateFrom and dateTo adds createdAt range filter", async () => {
	prismaMock.news.findMany.mockResolvedValue([]);

	const query = feedQuerySchema.parse({
		dateFrom: "2026-01-01",
		dateTo: "2026-12-31",
	});
	await service.findPublicFeed(query);

	const firstCall = prismaMock.news.findMany.mock.calls[0];
	expect(firstCall).toBeDefined();

	const callArgs = firstCall?.[0];
	expect(callArgs?.where.createdAt).toBeDefined();
	expect(callArgs?.where.createdAt?.gte).toBeInstanceOf(Date);
	expect(callArgs?.where.createdAt?.lte).toBeInstanceOf(Date);
	expect(callArgs?.where.deletedAt).toBeNull();
});
```

**Adicionar novo teste para findPublicById** -- verificar que deletedAt: null esta no where:

```ts
it("findPublicById filters out deleted news", async () => {
	prismaMock.news.findFirst.mockResolvedValue(null);

	await service.findPublicById("news_deleted").catch(() => {});

	expect(prismaMock.news.findFirst).toHaveBeenCalledWith({
		where: { id: "news_deleted", published: true, deletedAt: null },
	});
});
```

- [ ] **Step 2: Confirmar que os testes falham**

```bash
bun run test 2>&1 | grep -E "(FAIL|PASS|findPublicFeed|findPublicById)"
```

Expected: os testes atualizados e o novo teste falham.

- [ ] **Step 3: Atualizar findPublicFeed e findPublicById no service**

Em `src/modules/news/news.service.ts`, alterar os metodos:

```ts
async findPublicFeed(query: FeedQueryDto): Promise<PaginatedResult<News>> {
	const { q, cursor, limit, dateFrom, dateTo, sortBy, order } = query;
	const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
	const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

	const where: Prisma.NewsWhereInput = {
		published: true,
		deletedAt: null,
		...(q && { title: { contains: q } }),
		...((parsedDateFrom || parsedDateTo) && {
			createdAt: { gte: parsedDateFrom, lte: parsedDateTo },
		}),
	};

	const items = await this.prisma.news.findMany({
		where,
		orderBy: this.buildOrderBy(sortBy, order),
		take: limit + 1,
		...this.buildCursorArgs(cursor),
	});

	return this.paginateResult(items, limit);
}

async findPublicById(id: string): Promise<News> {
	const news = await this.prisma.news.findFirst({
		where: { id, published: true, deletedAt: null },
	});

	if (!news) {
		throw new NotFoundException("News not found");
	}

	return news;
}
```

- [ ] **Step 4: Confirmar que os testes passam**

```bash
bun run test 2>&1 | grep -E "(FAIL|PASS|findPublicFeed|findPublicById)"
```

Expected: todos os testes de findPublicFeed e findPublicById passam.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/news.service.ts src/modules/news/news.service.spec.ts
git commit -m "feat: filter deleted news from public routes"
```

---

## Task 4: TDD -- findAll com filtro deletedAt e suporte a includeDeleted

**Files:**
- Modify: `src/modules/news/news.service.spec.ts`
- Modify: `src/modules/news/news.service.ts`

- [ ] **Step 1: Atualizar teste existente e adicionar teste de includeDeleted**

Em `src/modules/news/news.service.spec.ts`:

**Teste existente "findAll with defaults returns paginated result"** -- alterar o `where` esperado:

```ts
it("findAll with defaults returns paginated result", async () => {
	prismaMock.news.findMany.mockResolvedValue([]);

	const query = newsQuerySchema.parse({});
	const result = await service.findAll(query);

	expect(prismaMock.news.findMany).toHaveBeenCalledWith({
		where: { deletedAt: null },
		orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		take: 21,
	});
	expect(result).toEqual({ data: [], nextCursor: null });
});
```

**Adicionar novo teste para includeDeleted**:

```ts
it("findAll with includeDeleted=true omits deletedAt filter", async () => {
	prismaMock.news.findMany.mockResolvedValue([]);

	const query = newsQuerySchema.parse({ includeDeleted: "true" });
	await service.findAll(query);

	const callArgs = prismaMock.news.findMany.mock.calls[0]?.[0];
	expect(callArgs?.where).not.toHaveProperty("deletedAt");
});
```

- [ ] **Step 2: Confirmar que os testes falham**

```bash
bun run test 2>&1 | grep -E "(FAIL|PASS|findAll)"
```

Expected: "findAll with defaults" e "findAll with includeDeleted" falham.

- [ ] **Step 3: Atualizar findAll no service**

Em `src/modules/news/news.service.ts`, alterar o metodo `findAll`:

```ts
async findAll(query: NewsQueryDto): Promise<PaginatedResult<News>> {
	const {
		q,
		cursor,
		limit,
		dateFrom,
		dateTo,
		sortBy,
		order,
		published,
		authorId,
		includeDeleted,
	} = query;
	const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
	const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

	const where: Prisma.NewsWhereInput = {
		...(includeDeleted ? {} : { deletedAt: null }),
		...(published !== undefined && { published }),
		...(authorId && { authorId }),
		...(q && { title: { contains: q } }),
		...((parsedDateFrom || parsedDateTo) && {
			createdAt: { gte: parsedDateFrom, lte: parsedDateTo },
		}),
	};

	const items = await this.prisma.news.findMany({
		where,
		orderBy: this.buildOrderBy(sortBy, order),
		take: limit + 1,
		...this.buildCursorArgs(cursor),
	});

	return this.paginateResult(items, limit);
}
```

- [ ] **Step 4: Confirmar que os testes passam**

```bash
bun run test 2>&1 | grep -E "(FAIL|PASS|findAll)"
```

Expected: todos os testes de findAll passam.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/news.service.ts src/modules/news/news.service.spec.ts
git commit -m "feat: filter deleted news from authenticated list, add includeDeleted param"
```

---

## Task 5: TDD -- remove com soft delete

**Files:**
- Modify: `src/modules/news/news.service.spec.ts`
- Modify: `src/modules/news/news.service.ts`

- [ ] **Step 1: Adicionar testes para o comportamento de soft delete em remove**

Em `src/modules/news/news.service.spec.ts`, adicionar apos os testes de `findAll`:

```ts
// --- remove ---

it("remove soft-deletes by setting deletedAt instead of deleting the record", async () => {
	prismaMock.news.findFirst.mockResolvedValue({ id: "news_1" });
	prismaMock.news.update.mockResolvedValue({
		id: "news_1",
		deletedAt: new Date(),
	});

	await service.remove("news_1");

	expect(prismaMock.news.update).toHaveBeenCalledWith({
		where: { id: "news_1" },
		data: { deletedAt: expect.any(Date) },
	});
	expect(prismaMock.news.delete).not.toHaveBeenCalled();
});

it("remove throws NotFoundException when news is already soft-deleted", async () => {
	prismaMock.news.findFirst.mockResolvedValue(null);

	await expect(service.remove("news_deleted")).rejects.toThrow(
		NotFoundException,
	);

	expect(prismaMock.news.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Confirmar que os testes falham**

```bash
bun run test 2>&1 | grep -E "(FAIL|PASS|remove)"
```

Expected: os dois novos testes de `remove` falham.

- [ ] **Step 3: Atualizar remove no service**

Em `src/modules/news/news.service.ts`, substituir o metodo `remove`:

```ts
async remove(id: string): Promise<News> {
	const existing = await this.prisma.news.findFirst({
		where: { id, deletedAt: null },
		select: { id: true },
	});

	if (!existing) {
		throw new NotFoundException("News not found");
	}

	return this.prisma.news.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
}
```

- [ ] **Step 4: Confirmar que os testes passam**

```bash
bun run test 2>&1 | grep -E "(FAIL|PASS|remove)"
```

Expected: todos os testes de `remove` passam.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/news.service.ts src/modules/news/news.service.spec.ts
git commit -m "feat: soft delete news via deletedAt timestamp"
```

---

## Task 6: TDD -- findOne e update com suporte a deleted

**Files:**
- Modify: `src/modules/news/news.service.spec.ts`
- Modify: `src/modules/news/news.service.ts`

- [ ] **Step 1: Adicionar testes para findOne e update**

Em `src/modules/news/news.service.spec.ts`, adicionar:

```ts
// --- findOne com deletedAt ---

it("findOne returns news even when deletedAt is set", async () => {
	const deletedNews = {
		id: "news_1",
		title: "Old",
		deletedAt: new Date("2026-04-01"),
	};
	prismaMock.news.findUnique.mockResolvedValue(deletedNews);

	const result = await service.findOne("news_1");

	expect(result).toEqual(deletedNews);
	expect(prismaMock.news.findUnique).toHaveBeenCalledWith({
		where: { id: "news_1" },
	});
});

// --- update com deleted field ---

it("update with deleted=false sets deletedAt to null (restore)", async () => {
	prismaMock.news.findUnique.mockResolvedValue({ id: "news_1" });
	prismaMock.news.update.mockResolvedValue({ id: "news_1", deletedAt: null });

	await service.update("news_1", { deleted: false });

	expect(prismaMock.news.update).toHaveBeenCalledWith({
		where: { id: "news_1" },
		data: {
			title: undefined,
			content: undefined,
			published: undefined,
			deletedAt: null,
		},
	});
});

it("update with deleted=true sets deletedAt to current date", async () => {
	prismaMock.news.findUnique.mockResolvedValue({ id: "news_1" });
	prismaMock.news.update.mockResolvedValue({
		id: "news_1",
		deletedAt: new Date(),
	});

	await service.update("news_1", { deleted: true });

	expect(prismaMock.news.update).toHaveBeenCalledWith({
		where: { id: "news_1" },
		data: {
			title: undefined,
			content: undefined,
			published: undefined,
			deletedAt: expect.any(Date),
		},
	});
});

it("update without deleted field does not change deletedAt", async () => {
	prismaMock.news.findUnique.mockResolvedValue({ id: "news_1" });
	prismaMock.news.update.mockResolvedValue({ id: "news_1" });

	await service.update("news_1", { title: "New title" });

	const callArgs = prismaMock.news.update.mock.calls[0]?.[0];
	expect(callArgs?.data).not.toHaveProperty("deletedAt");
});
```

- [ ] **Step 2: Confirmar que os testes falham**

```bash
bun run test 2>&1 | grep -E "(FAIL|PASS|findOne|update)"
```

Expected: os novos testes de `findOne` e `update` falham.

- [ ] **Step 3: Atualizar findOne e update no service**

Em `src/modules/news/news.service.ts`, alterar os metodos `findOne`, `update` e `assertExists`:

```ts
async findOne(id: string): Promise<News> {
	const news = await this.prisma.news.findUnique({ where: { id } });

	if (!news) {
		throw new NotFoundException("News not found");
	}

	return news;
}

async update(id: string, dto: UpdateNewsDto): Promise<News> {
	await this.assertExists(id);

	const deletedAtUpdate =
		dto.deleted === false
			? { deletedAt: null }
			: dto.deleted === true
				? { deletedAt: new Date() }
				: {};

	return this.prisma.news.update({
		where: { id },
		data: {
			title: dto.title,
			content: dto.content,
			published: dto.published,
			...deletedAtUpdate,
		},
	});
}

private async assertExists(id: string): Promise<void> {
	const existing = await this.prisma.news.findUnique({
		where: { id },
		select: { id: true },
	});

	if (!existing) {
		throw new NotFoundException("News not found");
	}
}
```

Nota: `findOne` nao muda em relacao ao atual (ja usa `findUnique` sem filtro de `deletedAt`). O `assertExists` volta a usar `findUnique` sem filtrar `deletedAt`, pois o `remove` agora faz sua propria verificacao inline.

- [ ] **Step 4: Confirmar que todos os testes passam**

```bash
bun run test 2>&1 | tail -20
```

Expected: suite completa passa sem falhas.

- [ ] **Step 5: Verificar tipos**

```bash
bun run check-types 2>&1 | head -30
```

Expected: sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/modules/news/news.service.ts src/modules/news/news.service.spec.ts
git commit -m "feat: support restore and soft-delete via PATCH, expose deletedAt in findOne"
```
