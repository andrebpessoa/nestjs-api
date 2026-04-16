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

type OpenApiOperation = {
	tags?: string[];
	summary?: string;
	security?: Array<Record<string, unknown>>;
};

type OpenApiDoc = {
	paths?: Record<string, { get?: OpenApiOperation; post?: OpenApiOperation }>;
	components?: {
		securitySchemes?: Record<string, unknown>;
	};
};

async function createAppForEnv(
	nodeEnv: string,
): Promise<INestApplication<App>> {
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

			const doc = response.body as OpenApiDoc;
			const feedOperation = doc.paths?.["/news/feed"]?.get;
			const adminListOperation = doc.paths?.["/news"]?.get;
			const postOperation = doc.paths?.["/news"]?.post;
			const securitySchemes = doc.components?.securitySchemes ?? {};

			expect(feedOperation?.tags).toContain("news");
			expect(feedOperation?.summary).toBe("List published news");
			expect(postOperation?.summary).toBe("Create a news item");

			const adminSecurity = adminListOperation?.security ?? [];
			expect(Array.isArray(adminSecurity)).toBe(true);
			expect(adminSecurity.length).toBeGreaterThan(0);
			expect(Object.keys(securitySchemes).length).toBeGreaterThan(0);
		} finally {
			await app.close();
		}
	});
});
