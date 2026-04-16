# Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-route rate limiting using `@nestjs/throttler`, protecting auth endpoints (20 req/min), authenticated news routes (100 req/min), and public feed endpoints (200 req/min).

**Architecture:** Register `ThrottlerModule.forRoot` with three named throttlers (`auth`, `news`, `feed`) in `AppModule` and apply `APP_GUARD` with `ThrottlerGuard` globally. Auth routes are covered by the global default. `NewsController` uses `@Throttle` and `@SkipThrottle` at the controller and method level to apply the correct throttler per route.

**Tech Stack:** `@nestjs/throttler` v6, NestJS 11, Fastify, Vitest, `@nestjs/testing`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `@nestjs/throttler` to dependencies |
| `src/app.module.ts` | Modify | Import ThrottlerModule, register APP_GUARD |
| `src/modules/news/news.controller.ts` | Modify | Add `@Throttle`/`@SkipThrottle` decorators |
| `src/modules/news/news.controller.spec.ts` | Modify | Add ThrottlerModule to test module setup |

## Throttler Summary

| Throttler | Limit | Applied to |
|-----------|-------|------------|
| `auth` | 20 req/min | Global default -- covers `/api/auth/*` and all undecorated routes |
| `news` | 100 req/min | All authenticated NewsController routes (controller-level override, skips `auth` and `feed`) |
| `feed` | 200 req/min | `GET /news/feed` and `GET /news/feed/:id` (method-level override, skips `auth` and `news`) |

---

### Task 1: Install @nestjs/throttler

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
bun add @nestjs/throttler
```

Expected: `@nestjs/throttler` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @nestjs/throttler dependency"
```

---

### Task 2: Configure ThrottlerModule in AppModule

**Files:**
- Modify: `src/app.module.ts`

- [ ] **Step 1: Update AppModule**

Full file content for `src/app.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "nestjs-zod";
import { auth } from "./lib/auth";
import { NewsModule } from "./modules/news/news.module";

@Module({
	imports: [
		AuthModule.forRoot({ auth, isGlobal: true }),
		ThrottlerModule.forRoot([
			{ name: "auth", ttl: 60000, limit: 20 },
			{ name: "news", ttl: 60000, limit: 100 },
			{ name: "feed", ttl: 60000, limit: 200 },
		]),
		NewsModule,
	],
	providers: [
		{
			provide: APP_PIPE,
			useClass: ZodValidationPipe,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
	],
})
export class AppModule {}
```

- [ ] **Step 2: Run existing tests to confirm nothing broke**

```bash
bun test
```

Expected: all tests pass. Unit tests use `Test.createTestingModule` which does not inherit `APP_GUARD`, so they are unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: register ThrottlerModule and global ThrottlerGuard in AppModule"
```

---

### Task 3: Apply throttle decorators to NewsController

**Files:**
- Modify: `src/modules/news/news.controller.ts`
- Modify: `src/modules/news/news.controller.spec.ts`

- [ ] **Step 1: Add ThrottlerModule to the controller test setup**

Full file content for `src/modules/news/news.controller.spec.ts`:

```typescript
import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { auth } from "@/lib/auth";
import { CreateNewsDto } from "./dto/create-news.dto";
import { FeedQueryDto, feedQuerySchema } from "./dto/feed-query.dto";
import { NewsQueryDto, newsQuerySchema } from "./dto/news-query.dto";
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
			imports: [
				ThrottlerModule.forRoot([
					{ name: "auth", ttl: 60000, limit: 20 },
					{ name: "news", ttl: 60000, limit: 100 },
					{ name: "feed", ttl: 60000, limit: 200 },
				]),
			],
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

- [ ] **Step 2: Run tests to confirm they still pass**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 3: Apply decorators to NewsController**

Full file content for `src/modules/news/news.controller.ts`:

```typescript
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
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import {
	AllowAnonymous,
	Session,
	type UserSession,
} from "@thallesp/nestjs-better-auth";
import { auth } from "@/lib/auth";
import { CreateNewsDto } from "./dto/create-news.dto";
import { FeedQueryDto } from "./dto/feed-query.dto";
import { NewsQueryDto } from "./dto/news-query.dto";
import {
	NewsResponseDto,
	PaginatedNewsResponseDto,
} from "./dto/news-response.dto";
import { UpdateNewsDto } from "./dto/update-news.dto";
import { NewsService } from "./news.service";

@ApiTags("news")
@Controller("news")
@Throttle({ news: { ttl: 60000, limit: 100 } })
@SkipThrottle({ auth: true, feed: true })
export class NewsController {
	constructor(private readonly newsService: NewsService) {}

	@AllowAnonymous()
	@Get("feed")
	@SkipThrottle({ auth: true, news: true })
	@Throttle({ feed: { ttl: 60000, limit: 200 } })
	@ApiOperation({ summary: "List published news" })
	@ApiOkResponse({ type: PaginatedNewsResponseDto })
	feed(@Query() query: FeedQueryDto) {
		return this.newsService.findPublicFeed(query);
	}

	@AllowAnonymous()
	@Get("feed/:id")
	@SkipThrottle({ auth: true, news: true })
	@Throttle({ feed: { ttl: 60000, limit: 200 } })
	@ApiOperation({ summary: "Get a published news item by id" })
	@ApiOkResponse({ type: NewsResponseDto })
	@ApiNotFoundResponse({ description: "News not found" })
	feedItem(@Param("id") id: string) {
		return this.newsService.findPublicById(id);
	}

	@Post()
	@ApiCookieAuth()
	@ApiOperation({ summary: "Create a news item" })
	@ApiCreatedResponse({ type: NewsResponseDto })
	@ApiUnauthorizedResponse({ description: "Authentication required" })
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
	@ApiCookieAuth()
	@ApiOperation({ summary: "List news for authenticated users" })
	@ApiOkResponse({ type: PaginatedNewsResponseDto })
	@ApiUnauthorizedResponse({ description: "Authentication required" })
	findAll(@Query() query: NewsQueryDto) {
		return this.newsService.findAll(query);
	}

	@Get(":id")
	@ApiCookieAuth()
	@ApiOperation({ summary: "Get a news item by id" })
	@ApiOkResponse({ type: NewsResponseDto })
	@ApiNotFoundResponse({ description: "News not found" })
	@ApiUnauthorizedResponse({ description: "Authentication required" })
	findOne(@Param("id") id: string) {
		return this.newsService.findOne(id);
	}

	@Patch(":id")
	@ApiCookieAuth()
	@ApiOperation({ summary: "Update a news item by id" })
	@ApiOkResponse({ type: NewsResponseDto })
	@ApiNotFoundResponse({ description: "News not found" })
	@ApiUnauthorizedResponse({ description: "Authentication required" })
	update(@Param("id") id: string, @Body() updateNewsDto: UpdateNewsDto) {
		return this.newsService.update(id, updateNewsDto);
	}

	@Delete(":id")
	@ApiCookieAuth()
	@ApiOperation({ summary: "Delete a news item by id" })
	@ApiOkResponse({ type: NewsResponseDto })
	@ApiNotFoundResponse({ description: "News not found" })
	@ApiUnauthorizedResponse({ description: "Authentication required" })
	remove(@Param("id") id: string) {
		return this.newsService.remove(id);
	}
}
```

Note on decorator order: `@SkipThrottle({ auth: true, feed: true })` at the controller level ensures authenticated routes only count against the `news` throttler. The feed methods override this with `@SkipThrottle({ auth: true, news: true })` + `@Throttle({ feed: ... })` at the method level, so they only count against `feed`.

- [ ] **Step 4: Run all tests**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/news/news.controller.ts src/modules/news/news.controller.spec.ts
git commit -m "feat: apply rate limit decorators to NewsController"
```
