# OpenAPI + Scalar Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose OpenAPI in development with Scalar (`/docs` + `/openapi.json`) and enrich `news` endpoints with complete documentation metadata and cookie-session auth docs.

**Architecture:** Add a focused `setupOpenApi` helper in `src/lib/openapi.ts` and call it from `main.ts` only when `NODE_ENV !== "production"`. Generate the OpenAPI doc with `@nestjs/swagger`, post-process it with `cleanupOpenApiDoc` (`nestjs-zod`), serve JSON at `/openapi.json`, and mount Scalar UI at `/docs`. Then decorate `NewsController` with tags, operations, response metadata, and cookie-auth requirements using explicit response DTO classes.

**Tech Stack:** NestJS 11, Fastify adapter, `@nestjs/swagger`, `@scalar/nestjs-api-reference`, `nestjs-zod`, Vitest, Supertest, Bun

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `package.json` | Add OpenAPI/Scalar dependencies |
| Modify | `bun.lock` | Lockfile updates after dependency install |
| Create | `src/lib/openapi.ts` | Centralized OpenAPI + Scalar setup and env gate |
| Modify | `src/main.ts` | Call docs setup only outside production |
| Create | `test/openapi.e2e-spec.ts` | Verify docs route availability by environment |
| Create | `src/modules/news/dto/news-response.dto.ts` | Explicit Swagger response DTOs for single and paginated news |
| Modify | `src/modules/news/news.controller.ts` | Add rich Swagger decorators and cookie auth docs |
| Modify | `test/openapi.e2e-spec.ts` | Assert spec includes tags/summaries/security for `news` |

---

### Task 1: OpenAPI + Scalar Infrastructure (Environment-Gated)

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `src/lib/openapi.ts`
- Modify: `src/main.ts`
- Create: `test/openapi.e2e-spec.ts`

- [ ] **Step 1: Write failing e2e tests for docs route exposure**

Create `test/openapi.e2e-spec.ts`:

```ts
import { INestApplication } from "@nestjs/common";
import {
	FastifyAdapter,
	NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { setupOpenApiForEnv } from "@/lib/openapi";
import { AppModule } from "../src/app.module";

async function createAppForEnv(nodeEnv: string): Promise<INestApplication<App>> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();

	const app = moduleFixture.createNestApplication<NestFastifyApplication>(
		new FastifyAdapter(),
	);

	setupOpenApiForEnv(app, nodeEnv);

	await app.init();
	await app.getHttpAdapter().getInstance().ready();

	return app;
}

describe("OpenAPI docs (e2e)", () => {
	it("exposes /openapi.json and /docs in development", async () => {
		const app = await createAppForEnv("development");

		try {
			await request(app.getHttpServer()).get("/openapi.json").expect(200);
			await request(app.getHttpServer()).get("/docs").expect(200);
		} finally {
			await app.close();
		}
	});

	it("hides /openapi.json and /docs in production", async () => {
		const app = await createAppForEnv("production");

		try {
			await request(app.getHttpServer()).get("/openapi.json").expect(404);
			await request(app.getHttpServer()).get("/docs").expect(404);
		} finally {
			await app.close();
		}
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun run test:e2e -- test/openapi.e2e-spec.ts
```

Expected: FAIL with module resolution error for `@/lib/openapi` (file does not exist yet).

- [ ] **Step 3: Install OpenAPI + Scalar dependencies**

Run:

```bash
bun add @nestjs/swagger @scalar/nestjs-api-reference
```

Expected: install succeeds and updates `package.json` + `bun.lock`.

- [ ] **Step 4: Implement centralized OpenAPI setup helper**

Create `src/lib/openapi.ts`:

```ts
import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { cleanupOpenApiDoc } from "nestjs-zod";

export function shouldEnableOpenApi(nodeEnv = process.env.NODE_ENV): boolean {
	return nodeEnv !== "production";
}

export function setupOpenApi(app: INestApplication): void {
	const config = new DocumentBuilder()
		.setTitle("Nest API")
		.setDescription("API documentation")
		.setVersion("1.0.0")
		.addCookieAuth("session")
		.build();

	const document = cleanupOpenApiDoc(
		SwaggerModule.createDocument(app, config),
	);

	app.getHttpAdapter().get("/openapi.json", (_req: unknown, res: any) => {
		if (typeof res.header === "function") {
			res.header("Content-Type", "application/json; charset=utf-8");
		}

		if (typeof res.send === "function") {
			return res.send(document);
		}

		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.end(JSON.stringify(document));
	});

	app.use(
		"/docs",
		apiReference({
			url: "/openapi.json",
		}),
	);
}

export function setupOpenApiForEnv(
	app: INestApplication,
	nodeEnv = process.env.NODE_ENV,
): void {
	if (!shouldEnableOpenApi(nodeEnv)) {
		return;
	}

	setupOpenApi(app);
}
```

- [ ] **Step 5: Wire helper into bootstrap**

Replace `src/main.ts` with:

```ts
import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ZodValidationPipe } from "nestjs-zod";
import { setupOpenApiForEnv } from "@/lib/openapi";
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
	setupOpenApiForEnv(app);

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 6: Run e2e tests to verify docs gating works**

Run:

```bash
bun run test:e2e -- test/openapi.e2e-spec.ts
```

Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock src/lib/openapi.ts src/main.ts test/openapi.e2e-spec.ts
git commit -m "feat(docs): add OpenAPI and Scalar setup for development"
```

---

### Task 2: Rich News Endpoint Documentation (Tags, Responses, Cookie Auth)

**Files:**
- Create: `src/modules/news/dto/news-response.dto.ts`
- Modify: `src/modules/news/news.controller.ts`
- Modify: `test/openapi.e2e-spec.ts`

- [ ] **Step 1: Extend OpenAPI e2e test with metadata assertions (failing first)**

Replace `test/openapi.e2e-spec.ts` with:

```ts
import { INestApplication } from "@nestjs/common";
import {
	FastifyAdapter,
	NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { setupOpenApiForEnv } from "@/lib/openapi";
import { AppModule } from "../src/app.module";

async function createAppForEnv(nodeEnv: string): Promise<INestApplication<App>> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();

	const app = moduleFixture.createNestApplication<NestFastifyApplication>(
		new FastifyAdapter(),
	);

	setupOpenApiForEnv(app, nodeEnv);

	await app.init();
	await app.getHttpAdapter().getInstance().ready();

	return app;
}

describe("OpenAPI docs (e2e)", () => {
	it("exposes /openapi.json and /docs in development", async () => {
		const app = await createAppForEnv("development");

		try {
			await request(app.getHttpServer()).get("/openapi.json").expect(200);
			await request(app.getHttpServer()).get("/docs").expect(200);
		} finally {
			await app.close();
		}
	});

	it("hides /openapi.json and /docs in production", async () => {
		const app = await createAppForEnv("production");

		try {
			await request(app.getHttpServer()).get("/openapi.json").expect(404);
			await request(app.getHttpServer()).get("/docs").expect(404);
		} finally {
			await app.close();
		}
	});

	it("documents news routes with tags, summaries and cookie auth", async () => {
		const app = await createAppForEnv("development");

		try {
			const response = await request(app.getHttpServer())
				.get("/openapi.json")
				.expect(200);

			const doc = response.body as Record<string, any>;
			const feedOperation = doc.paths?.["/news/feed"]?.get;
			const adminListOperation = doc.paths?.["/news"]?.get;
			const postOperation = doc.paths?.["/news"]?.post;
			const securitySchemes = doc.components?.securitySchemes ?? {};

			expect(feedOperation?.tags).toContain("news");
			expect(feedOperation?.summary).toBe("List published news");
			expect(postOperation?.summary).toBe("Create a news item");

			expect(Array.isArray(adminListOperation?.security)).toBe(true);
			expect(adminListOperation.security.length).toBeGreaterThan(0);
			expect(Object.keys(securitySchemes).length).toBeGreaterThan(0);
		} finally {
			await app.close();
		}
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun run test:e2e -- test/openapi.e2e-spec.ts
```

Expected: FAIL on summary/tag/security assertions because controller metadata is not enriched yet.

- [ ] **Step 3: Create explicit Swagger response DTOs**

Create `src/modules/news/dto/news-response.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";

export class NewsResponseDto {
	@ApiProperty({ example: "cm9zhf3lg00008v3f07aq8bxz" })
	id!: string;

	@ApiProperty({ example: "Breaking news" })
	title!: string;

	@ApiProperty({
		type: "object",
		additionalProperties: true,
		example: {
			blocks: [{ type: "paragraph", text: "Lorem ipsum" }],
		},
	})
	content!: Record<string, unknown>;

	@ApiProperty({ example: false })
	published!: boolean;

	@ApiProperty({ example: "cm9zhf3lg00018v3f2n2h4k0n" })
	authorId!: string;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: string;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: string;
}

export class PaginatedNewsResponseDto {
	@ApiProperty({ type: [NewsResponseDto] })
	data!: NewsResponseDto[];

	@ApiProperty({
		type: String,
		nullable: true,
		example: "cm9zhf3lg00048v3fngmc4o9f",
	})
	nextCursor!: string | null;
}
```

- [ ] **Step 4: Add rich Swagger decorators to NewsController**

Replace `src/modules/news/news.controller.ts` with:

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
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiUnauthorizedResponse,
	ApiTags,
} from "@nestjs/swagger";
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
export class NewsController {
	constructor(private readonly newsService: NewsService) {}

	@AllowAnonymous()
	@Get("feed")
	@ApiOperation({ summary: "List published news" })
	@ApiOkResponse({ type: PaginatedNewsResponseDto })
	feed(@Query() query: FeedQueryDto) {
		return this.newsService.findPublicFeed(query);
	}

	@AllowAnonymous()
	@Get("feed/:id")
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

- [ ] **Step 5: Re-run OpenAPI e2e test to verify documentation metadata**

Run:

```bash
bun run test:e2e -- test/openapi.e2e-spec.ts
```

Expected: PASS (3 tests), including tags/summaries/security assertions.

- [ ] **Step 6: Run regression tests for existing news behavior**

Run:

```bash
bun run test -- src/modules/news/news.controller.spec.ts src/modules/news/news.service.spec.ts
bun run test:e2e -- test/news.e2e-spec.ts
```

Expected: PASS (no behavior regressions in existing endpoints).

- [ ] **Step 7: Commit**

```bash
git add src/modules/news/dto/news-response.dto.ts src/modules/news/news.controller.ts test/openapi.e2e-spec.ts
git commit -m "docs(news): enrich OpenAPI metadata and cookie auth docs"
```

---

## Final Verification

- [ ] Run formatting/lint checks:

```bash
bun run ci:lint
```

Expected: PASS.

- [ ] Run full automated suite:

```bash
bun run test
bun run test:e2e
```

Expected: PASS with the new OpenAPI/Scalar tests included.
