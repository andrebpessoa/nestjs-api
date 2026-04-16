# News Search, Pagination and Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add title text search, cursor-based pagination, and complex filters (`published`, `authorId`, `dateFrom`, `dateTo`, `sortBy`, `order`) to both public feed and admin news listing endpoints.

**Architecture:** Two new Zod DTOs (`FeedQueryDto`, `NewsQueryDto`) validate query params. The service gains two private helpers (`buildCursorArgs`, `paginateResult`) and both `findPublicFeed` + `findAll` are updated to accept and apply the query. The response shape changes from `News[]` to `{ data: News[], nextCursor: string | null }` for both endpoints.

**Tech Stack:** NestJS 11, Prisma 7, Zod 4, nestjs-zod 5, Vitest, Fastify, supertest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/modules/news/dto/feed-query.dto.ts` | Zod schema + DTO for public feed query params |
| Create | `src/modules/news/dto/news-query.dto.ts` | Extends feed schema with admin-only filters |
| Modify | `src/main.ts` | Register `ZodValidationPipe` globally |
| Modify | `src/modules/news/news.service.ts` | Add `PaginatedResult`, helpers, update `findPublicFeed` + `findAll` |
| Modify | `src/modules/news/news.controller.ts` | Update `feed` + `findAll` to receive query DTOs |
| Modify | `src/modules/news/news.service.spec.ts` | Update existing test + add pagination/filter cases |
| Modify | `src/modules/news/news.controller.spec.ts` | Update existing test + add query delegation cases |
| Modify | `test/news.e2e-spec.ts` | Update response shape assertions + add new cases |

---

## Task 1: Register ZodValidationPipe globally

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add ZodValidationPipe to main.ts**

Replace the entire file with:

```ts
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ZodValidationPipe } from "nestjs-zod";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({ logger: true }),
		{
			bodyParser: false,
		},
	);

	app.useGlobalPipes(new ZodValidationPipe());

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
bun run test
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(app): register ZodValidationPipe globally"
```

---

## Task 2: Create FeedQueryDto

**Files:**
- Create: `src/modules/news/dto/feed-query.dto.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `src/modules/news/dto/feed-query.dto.spec.ts`:

```ts
import { feedQuerySchema } from "./feed-query.dto";

describe("feedQuerySchema", () => {
	it("applies defaults when no params given", () => {
		const result = feedQuerySchema.parse({});

		expect(result).toEqual({
			limit: 20,
			sortBy: "createdAt",
			order: "desc",
		});
	});

	it("coerces limit from string to number", () => {
		const result = feedQuerySchema.parse({ limit: "5" });

		expect(result.limit).toBe(5);
	});

	it("coerces dateFrom from ISO string to Date", () => {
		const result = feedQuerySchema.parse({ dateFrom: "2026-01-01" });

		expect(result.dateFrom).toBeInstanceOf(Date);
	});

	it("rejects limit above 50", () => {
		expect(() => feedQuerySchema.parse({ limit: "51" })).toThrow();
	});

	it("rejects limit below 1", () => {
		expect(() => feedQuerySchema.parse({ limit: "0" })).toThrow();
	});

	it("rejects unknown keys", () => {
		expect(() => feedQuerySchema.parse({ unknown: "field" })).toThrow();
	});

	it("rejects invalid sortBy value", () => {
		expect(() => feedQuerySchema.parse({ sortBy: "invalid" })).toThrow();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
bun run test -- feed-query
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the DTO file**

Create `src/modules/news/dto/feed-query.dto.ts`:

```ts
import { createZodDto } from "nestjs-zod";
import * as z from "zod";

export const feedQuerySchema = z
	.object({
		q: z.string().trim().min(1).optional(),
		cursor: z.string().optional(),
		limit: z.coerce.number().int().min(1).max(50).default(20),
		dateFrom: z.coerce.date().optional(),
		dateTo: z.coerce.date().optional(),
		sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
		order: z.enum(["asc", "desc"]).default("desc"),
	})
	.strict();

export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
```

- [ ] **Step 4: Run to verify it passes**

```bash
bun run test -- feed-query
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/dto/feed-query.dto.ts src/modules/news/dto/feed-query.dto.spec.ts
git commit -m "feat(news): add FeedQueryDto with cursor pagination and filter schema"
```

---

## Task 3: Create NewsQueryDto

**Files:**
- Create: `src/modules/news/dto/news-query.dto.ts`

**Note on boolean coercion:** `z.coerce.boolean()` treats any non-empty string as `true`, so `"false"` would become `true`. Use `z.enum(["true","false"]).transform()` instead for query params.

- [ ] **Step 1: Write the failing schema tests**

Create `src/modules/news/dto/news-query.dto.spec.ts`:

```ts
import { newsQuerySchema } from "./news-query.dto";

describe("newsQuerySchema", () => {
	it("applies defaults from feedQuerySchema", () => {
		const result = newsQuerySchema.parse({});

		expect(result.limit).toBe(20);
		expect(result.sortBy).toBe("createdAt");
		expect(result.order).toBe("desc");
	});

	it("parses published=true string to boolean true", () => {
		const result = newsQuerySchema.parse({ published: "true" });

		expect(result.published).toBe(true);
	});

	it("parses published=false string to boolean false", () => {
		const result = newsQuerySchema.parse({ published: "false" });

		expect(result.published).toBe(false);
	});

	it("accepts authorId as string", () => {
		const result = newsQuerySchema.parse({ authorId: "user_1" });

		expect(result.authorId).toBe("user_1");
	});

	it("rejects unknown keys", () => {
		expect(() => newsQuerySchema.parse({ unknown: "field" })).toThrow();
	});

	it("rejects invalid published value", () => {
		expect(() => newsQuerySchema.parse({ published: "yes" })).toThrow();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
bun run test -- news-query
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the DTO file**

Create `src/modules/news/dto/news-query.dto.ts`:

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
	})
	.strict();

export class NewsQueryDto extends createZodDto(newsQuerySchema) {}
```

- [ ] **Step 4: Run to verify it passes**

```bash
bun run test -- news-query
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/dto/news-query.dto.ts src/modules/news/dto/news-query.dto.spec.ts
git commit -m "feat(news): add NewsQueryDto with admin-only filters"
```

---

## Task 4: Update NewsService.findPublicFeed

**Files:**
- Modify: `src/modules/news/news.service.ts`
- Modify: `src/modules/news/news.service.spec.ts`

- [ ] **Step 1: Update existing test and add new cases**

Replace the entire content of `src/modules/news/news.service.spec.ts`:

```ts
import { PrismaService } from "@db/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { feedQuerySchema } from "./dto/feed-query.dto";
import { newsQuerySchema } from "./dto/news-query.dto";
import { CreateNewsDto } from "./dto/create-news.dto";
import { NewsService } from "./news.service";

describe("NewsService", () => {
	let service: NewsService;
	const prismaMock = {
		news: {
			create: vi.fn(),
			findMany: vi.fn(),
			findFirst: vi.fn(),
			findUnique: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		},
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				NewsService,
				{
					provide: PrismaService,
					useValue: prismaMock,
				},
			],
		}).compile();

		service = module.get<NewsService>(NewsService);
	});

	// --- findPublicFeed ---

	it("findPublicFeed with defaults queries only published news", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		const query = feedQuerySchema.parse({});
		const result = await service.findPublicFeed(query);

		expect(prismaMock.news.findMany).toHaveBeenCalledWith({
			where: { published: true },
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: 21,
		});
		expect(result).toEqual({ data: [], nextCursor: null });
	});

	it("findPublicFeed with q adds title contains filter", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		const query = feedQuerySchema.parse({ q: "nestjs" });
		await service.findPublicFeed(query);

		expect(prismaMock.news.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { published: true, title: { contains: "nestjs" } },
			}),
		);
	});

	it("findPublicFeed with cursor passes cursor and skip args", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		const query = feedQuerySchema.parse({ cursor: "news_cursor", limit: "5" });
		await service.findPublicFeed(query);

		expect(prismaMock.news.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				cursor: { id: "news_cursor" },
				skip: 1,
				take: 6,
			}),
		);
	});

	it("findPublicFeed returns nextCursor when more items exist", async () => {
		const items = [
			{ id: "a", title: "A" },
			{ id: "b", title: "B" },
			{ id: "c", title: "C" },
		];
		prismaMock.news.findMany.mockResolvedValue(items);

		const query = feedQuerySchema.parse({ limit: "2" });
		const result = await service.findPublicFeed(query);

		expect(result.data).toHaveLength(2);
		expect(result.nextCursor).toBe("b");
	});

	it("findPublicFeed returns nextCursor null when no more items", async () => {
		const items = [{ id: "a", title: "A" }];
		prismaMock.news.findMany.mockResolvedValue(items);

		const query = feedQuerySchema.parse({ limit: "2" });
		const result = await service.findPublicFeed(query);

		expect(result.data).toHaveLength(1);
		expect(result.nextCursor).toBeNull();
	});

	it("findPublicFeed with dateFrom and dateTo adds createdAt range filter", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		const query = feedQuerySchema.parse({
			dateFrom: "2026-01-01",
			dateTo: "2026-12-31",
		});
		await service.findPublicFeed(query);

		const call = prismaMock.news.findMany.mock.calls[0][0];
		expect(call.where.createdAt).toBeDefined();
		expect(call.where.createdAt.gte).toBeInstanceOf(Date);
		expect(call.where.createdAt.lte).toBeInstanceOf(Date);
	});

	// --- findPublicById ---

	it("findPublicById should throw NotFoundException for draft or missing item", async () => {
		prismaMock.news.findFirst.mockResolvedValue(null);

		await expect(service.findPublicById("news_1")).rejects.toThrow(
			NotFoundException,
		);
	});

	// --- create ---

	it("create should persist authorId from session argument", async () => {
		const dto: CreateNewsDto = {
			title: "Breaking",
			content: { blocks: [{ type: "paragraph", text: "Hello" }] },
			published: true,
		};

		prismaMock.news.create.mockResolvedValue({
			id: "news_1",
			title: dto.title,
			content: dto.content,
			published: true,
			authorId: "user_1",
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await service.create("user_1", dto);

		expect(prismaMock.news.create).toHaveBeenCalledWith({
			data: {
				title: "Breaking",
				content: { blocks: [{ type: "paragraph", text: "Hello" }] },
				published: true,
				authorId: "user_1",
			},
		});
	});

	// --- findOne ---

	it("findOne should throw NotFoundException when item does not exist", async () => {
		prismaMock.news.findUnique.mockResolvedValue(null);

		await expect(service.findOne("news_1")).rejects.toThrow(NotFoundException);
	});

	// --- findAll ---

	it("findAll with defaults returns paginated result", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		const query = newsQuerySchema.parse({});
		const result = await service.findAll(query);

		expect(prismaMock.news.findMany).toHaveBeenCalledWith({
			where: {},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			take: 21,
		});
		expect(result).toEqual({ data: [], nextCursor: null });
	});

	it("findAll with published=false filters to drafts", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		const query = newsQuerySchema.parse({ published: "false" });
		await service.findAll(query);

		expect(prismaMock.news.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ published: false }),
			}),
		);
	});

	it("findAll with authorId filters by author", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		const query = newsQuerySchema.parse({ authorId: "user_1" });
		await service.findAll(query);

		expect(prismaMock.news.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ authorId: "user_1" }),
			}),
		);
	});
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
bun run test -- news.service
```

Expected: FAIL — `findPublicFeed` called without arguments, type errors, wrong assertions.

- [ ] **Step 3: Update news.service.ts**

Replace the entire content of `src/modules/news/news.service.ts`:

```ts
import { PrismaService } from "@db/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { News, Prisma } from "@/generated/prisma/client";
import { CreateNewsDto } from "./dto/create-news.dto";
import { FeedQueryDto } from "./dto/feed-query.dto";
import { NewsQueryDto } from "./dto/news-query.dto";
import { UpdateNewsDto } from "./dto/update-news.dto";

interface PaginatedResult<T> {
	data: T[];
	nextCursor: string | null;
}

@Injectable()
export class NewsService {
	constructor(private readonly prisma: PrismaService) {}

	async create(authorId: string, dto: CreateNewsDto): Promise<News> {
		return this.prisma.news.create({
			data: {
				title: dto.title,
				content: dto.content as Prisma.InputJsonValue,
				published: dto.published ?? false,
				authorId,
			},
		});
	}

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
			orderBy: [
				{ [sortBy]: order } as Prisma.NewsOrderByWithRelationInput,
				{ id: order },
			],
			...this.buildCursorArgs(cursor, limit),
		});

		return this.paginateResult(items, limit);
	}

	async findPublicById(id: string): Promise<News> {
		const news = await this.prisma.news.findFirst({
			where: { id, published: true },
		});

		if (!news) {
			throw new NotFoundException("News not found");
		}

		return news;
	}

	async findAll(query: NewsQueryDto): Promise<PaginatedResult<News>> {
		const { q, cursor, limit, dateFrom, dateTo, sortBy, order, published, authorId } =
			query;

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
			orderBy: [
				{ [sortBy]: order } as Prisma.NewsOrderByWithRelationInput,
				{ id: order },
			],
			...this.buildCursorArgs(cursor, limit),
		});

		return this.paginateResult(items, limit);
	}

	async findOne(id: string): Promise<News> {
		const news = await this.prisma.news.findUnique({ where: { id } });

		if (!news) {
			throw new NotFoundException("News not found");
		}

		return news;
	}

	async update(id: string, dto: UpdateNewsDto): Promise<News> {
		await this.assertExists(id);

		return this.prisma.news.update({
			where: { id },
			data: {
				title: dto.title,
				content: dto.content as Prisma.InputJsonValue | undefined,
				published: dto.published,
			},
		});
	}

	async remove(id: string): Promise<News> {
		await this.assertExists(id);
		return this.prisma.news.delete({ where: { id } });
	}

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

	private async assertExists(id: string): Promise<void> {
		const existing = await this.prisma.news.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!existing) {
			throw new NotFoundException("News not found");
		}
	}
}
```

- [ ] **Step 4: Run to verify tests pass**

```bash
bun run test -- news.service
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/news.service.ts src/modules/news/news.service.spec.ts
git commit -m "feat(news): add cursor pagination and filters to NewsService"
```

---

## Task 5: Update NewsController

**Files:**
- Modify: `src/modules/news/news.controller.ts`
- Modify: `src/modules/news/news.controller.spec.ts`

- [ ] **Step 1: Update controller tests**

Replace the entire content of `src/modules/news/news.controller.spec.ts`:

```ts
import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { auth } from "@/lib/auth";
import { feedQuerySchema } from "./dto/feed-query.dto";
import { newsQuerySchema } from "./dto/news-query.dto";
import { CreateNewsDto } from "./dto/create-news.dto";
import { UpdateNewsDto } from "./dto/update-news.dto";
import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";

describe("NewsController", () => {
	let controller: NewsController;
	const newsServiceMock = {
		findPublicFeed: vi.fn(),
		findPublicById: vi.fn(),
		create: vi.fn(),
		findAll: vi.fn(),
		findOne: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
	};

	beforeEach(async () => {
		vi.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			controllers: [NewsController],
			providers: [
				{
					provide: NewsService,
					useValue: newsServiceMock,
				},
			],
		}).compile();

		controller = module.get<NewsController>(NewsController);
	});

	it("feed delegates query to findPublicFeed", () => {
		const query = feedQuerySchema.parse({}) as unknown as FeedQueryDto;
		controller.feed(query);
		expect(newsServiceMock.findPublicFeed).toHaveBeenCalledWith(query);
	});

	it("findAll delegates query to newsService.findAll", () => {
		const query = newsQuerySchema.parse({}) as unknown as NewsQueryDto;
		controller.findAll(query);
		expect(newsServiceMock.findAll).toHaveBeenCalledWith(query);
	});

	it("create should pass authenticated user id to service", () => {
		const dto: CreateNewsDto = {
			title: "Breaking",
			content: { body: "text" },
			published: false,
		};
		const session = {
			user: { id: "user_1" },
		} as UserSession<typeof auth>;

		controller.create(session, dto);

		expect(newsServiceMock.create).toHaveBeenCalledWith("user_1", dto);
	});

	it("create should throw UnauthorizedException when session has no user id", () => {
		const dto: CreateNewsDto = {
			title: "Breaking",
			content: { body: "text" },
			published: false,
		};
		const session = { user: {} } as UserSession<typeof auth>;

		expect(() => controller.create(session, dto)).toThrow(
			UnauthorizedException,
		);
	});

	it("update should delegate id and dto as string + payload", () => {
		const dto: UpdateNewsDto = { published: true };
		controller.update("news_1", dto);
		expect(newsServiceMock.update).toHaveBeenCalledWith("news_1", dto);
	});
});
```

- [ ] **Step 2: Run to verify tests fail**

```bash
bun run test -- news.controller
```

Expected: FAIL — `feed` and `findAll` methods have wrong signatures.

- [ ] **Step 3: Update news.controller.ts**

Replace the entire content of `src/modules/news/news.controller.ts`:

```ts
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UnauthorizedException,
} from "@nestjs/common";
import {
	AllowAnonymous,
	Session,
	type UserSession,
} from "@thallesp/nestjs-better-auth";
import { auth } from "@/lib/auth";
import { CreateNewsDto } from "./dto/create-news.dto";
import { FeedQueryDto } from "./dto/feed-query.dto";
import { NewsQueryDto } from "./dto/news-query.dto";
import { UpdateNewsDto } from "./dto/update-news.dto";
import { NewsService } from "./news.service";

@Controller("news")
export class NewsController {
	constructor(private readonly newsService: NewsService) {}

	@AllowAnonymous()
	@Get("feed")
	feed(@Query() query: FeedQueryDto) {
		return this.newsService.findPublicFeed(query);
	}

	@AllowAnonymous()
	@Get("feed/:id")
	feedItem(@Param("id") id: string) {
		return this.newsService.findPublicById(id);
	}

	@Post()
	create(
		@Session() session: UserSession<typeof auth>,
		@Body() createNewsDto: CreateNewsDto,
	) {
		const authorId = session?.user?.id;

		if (!authorId) {
			throw new UnauthorizedException(
				"Authenticated user not found in session",
			);
		}

		return this.newsService.create(authorId, createNewsDto);
	}

	@Get()
	findAll(@Query() query: NewsQueryDto) {
		return this.newsService.findAll(query);
	}

	@Get(":id")
	findOne(@Param("id") id: string) {
		return this.newsService.findOne(id);
	}

	@Patch(":id")
	update(@Param("id") id: string, @Body() updateNewsDto: UpdateNewsDto) {
		return this.newsService.update(id, updateNewsDto);
	}

	@Delete(":id")
	remove(@Param("id") id: string) {
		return this.newsService.remove(id);
	}
}
```

- [ ] **Step 4: Run all unit tests**

```bash
bun run test
```

Expected: all unit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/news.controller.ts src/modules/news/news.controller.spec.ts
git commit -m "feat(news): update controller to accept query DTOs for feed and findAll"
```

---

## Task 6: Update E2E Tests

**Files:**
- Modify: `test/news.e2e-spec.ts`

The response shape for `GET /news/feed` and `GET /news` changed from `News[]` to `{ data: News[], nextCursor: string | null }`. Existing e2e assertions must be updated and new scenarios added.

- [ ] **Step 1: Replace test/news.e2e-spec.ts**

```ts
import { PrismaService } from "@db/prisma/prisma.service";
import { INestApplication } from "@nestjs/common";
import {
	FastifyAdapter,
	NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("News API (e2e)", () => {
	let app: INestApplication<App>;
	let prisma: PrismaService;

	beforeEach(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(
			new FastifyAdapter(),
		);
		await app.init();
		await app.getHttpAdapter().getInstance().ready();

		prisma = app.get(PrismaService);
		await prisma.news.deleteMany();
		await prisma.session.deleteMany();
		await prisma.account.deleteMany();
		await prisma.user.deleteMany();
	});

	afterEach(async () => {
		await app.close();
	});

	async function signUpAndGetCookie() {
		const email = `news-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
		const response = await request(app.getHttpServer())
			.post("/api/auth/sign-up/email")
			.send({
				name: "E2E User",
				email,
				password: "Passw0rd!123456",
			});

		expect([200, 201]).toContain(response.status);

		const setCookie = response.headers["set-cookie"];
		expect(setCookie).toBeDefined();

		return Array.isArray(setCookie)
			? setCookie.map((cookie: string) => cookie.split(";")[0]).join("; ")
			: setCookie.split(";")[0];
	}

	async function createNews(
		cookie: string,
		payload?: Partial<{
			title: string;
			content: Record<string, unknown>;
			published: boolean;
		}>,
	) {
		const response = await request(app.getHttpServer())
			.post("/news")
			.set("Cookie", cookie)
			.send({
				title: "Breaking",
				content: { blocks: [{ type: "paragraph", text: "content" }] },
				published: false,
				...payload,
			})
			.expect(201);

		return response.body as {
			id: string;
			title: string;
			content: Record<string, unknown>;
			published: boolean;
			authorId: string;
		};
	}

	it("GET /news/feed is public and returns only published items", async () => {
		const cookie = await signUpAndGetCookie();
		const draft = await createNews(cookie, {
			title: "Draft",
			published: false,
		});
		const published = await createNews(cookie, {
			title: "Public",
			published: true,
		});

		const response = await request(app.getHttpServer())
			.get("/news/feed")
			.expect(200);

		expect(response.body.data).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: published.id, published: true }),
			]),
		);
		expect(
			response.body.data.find((item: { id: string }) => item.id === draft.id),
		).toBeUndefined();
		expect(response.body.nextCursor).toBeDefined();
	});

	it("GET /news/feed/:id returns 404 for draft", async () => {
		const cookie = await signUpAndGetCookie();
		const draft = await createNews(cookie, { published: false });

		await request(app.getHttpServer())
			.get(`/news/feed/${draft.id}`)
			.expect(404);
	});

	it("GET /news requires authentication", () => {
		return request(app.getHttpServer()).get("/news").expect(401);
	});

	it("POST /news requires authentication", () => {
		return request(app.getHttpServer())
			.post("/news")
			.send({ title: "NoAuth", content: { body: "text" } })
			.expect(401);
	});

	it("authenticated user can create, update, list and delete news", async () => {
		const cookie = await signUpAndGetCookie();

		const created = await createNews(cookie, {
			title: "Created",
			published: false,
		});

		expect(created.id).toEqual(expect.any(String));
		expect(created.authorId).toEqual(expect.any(String));

		await request(app.getHttpServer())
			.patch(`/news/${created.id}`)
			.set("Cookie", cookie)
			.send({ published: true })
			.expect(200);

		const listResponse = await request(app.getHttpServer())
			.get("/news")
			.set("Cookie", cookie)
			.expect(200);

		expect(listResponse.body.data).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: created.id, published: true }),
			]),
		);

		await request(app.getHttpServer())
			.delete(`/news/${created.id}`)
			.set("Cookie", cookie)
			.expect(200);

		await request(app.getHttpServer())
			.get(`/news/${created.id}`)
			.set("Cookie", cookie)
			.expect(404);
	});

	it("GET /news/feed?q=<term> returns only matching published items", async () => {
		const cookie = await signUpAndGetCookie();

		await createNews(cookie, { title: "NestJS guide", published: true });
		await createNews(cookie, { title: "Prisma tips", published: true });

		const response = await request(app.getHttpServer())
			.get("/news/feed?q=NestJS")
			.expect(200);

		expect(response.body.data).toHaveLength(1);
		expect(response.body.data[0].title).toBe("NestJS guide");
	});

	it("GET /news/feed?limit=1 returns one item with non-null nextCursor", async () => {
		const cookie = await signUpAndGetCookie();

		await createNews(cookie, { title: "First", published: true });
		await createNews(cookie, { title: "Second", published: true });

		const response = await request(app.getHttpServer())
			.get("/news/feed?limit=1")
			.expect(200);

		expect(response.body.data).toHaveLength(1);
		expect(response.body.nextCursor).toBeTruthy();
	});

	it("GET /news/feed?limit=1&cursor=<id> returns the next item", async () => {
		const cookie = await signUpAndGetCookie();

		const first = await createNews(cookie, {
			title: "Older",
			published: true,
		});
		await createNews(cookie, { title: "Newer", published: true });

		const page1 = await request(app.getHttpServer())
			.get("/news/feed?limit=1")
			.expect(200);

		const cursor = page1.body.nextCursor as string;

		const page2 = await request(app.getHttpServer())
			.get(`/news/feed?limit=1&cursor=${cursor}`)
			.expect(200);

		expect(page2.body.data).toHaveLength(1);
		expect(page2.body.data[0].id).toBe(first.id);
	});

	it("GET /news/feed with limit larger than total returns nextCursor null", async () => {
		const cookie = await signUpAndGetCookie();
		await createNews(cookie, { title: "Only one", published: true });

		const response = await request(app.getHttpServer())
			.get("/news/feed?limit=50")
			.expect(200);

		expect(response.body.nextCursor).toBeNull();
	});

	it("GET /news?published=false returns only drafts", async () => {
		const cookie = await signUpAndGetCookie();

		await createNews(cookie, { title: "Draft", published: false });
		await createNews(cookie, { title: "Live", published: true });

		const response = await request(app.getHttpServer())
			.get("/news?published=false")
			.set("Cookie", cookie)
			.expect(200);

		expect(response.body.data.every((n: { published: boolean }) => !n.published)).toBe(true);
	});

	it("GET /news?authorId=<id> returns only that author's items", async () => {
		const cookie1 = await signUpAndGetCookie();
		const cookie2 = await signUpAndGetCookie();

		const mine = await createNews(cookie1, { title: "Mine", published: true });
		await createNews(cookie2, { title: "Theirs", published: true });

		const meResponse = await request(app.getHttpServer())
			.get("/news")
			.set("Cookie", cookie1)
			.expect(200);

		const myAuthorId = mine.authorId;

		const filtered = await request(app.getHttpServer())
			.get(`/news?authorId=${myAuthorId}`)
			.set("Cookie", cookie1)
			.expect(200);

		expect(
			filtered.body.data.every(
				(n: { authorId: string }) => n.authorId === myAuthorId,
			),
		).toBe(true);
		expect(filtered.body.data.length).toBeLessThanOrEqual(
			meResponse.body.data.length,
		);
	});
});
```

- [ ] **Step 2: Run e2e tests**

```bash
bun run test:e2e
```

Expected: all e2e tests PASS.

- [ ] **Step 3: Run full test suite**

```bash
bun run test && bun run test:e2e
```

Expected: all unit and e2e tests PASS.

- [ ] **Step 4: Commit**

```bash
git add test/news.e2e-spec.ts
git commit -m "test(news): update e2e tests for paginated response shape and add pagination/filter coverage"
```
