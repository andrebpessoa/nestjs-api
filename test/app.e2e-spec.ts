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

		if (!setCookie) {
			throw new Error("No auth cookie returned by sign-up endpoint");
		}

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

		expect(response.body).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: published.id, published: true }),
			]),
		);
		expect(
			response.body.find((item: { id: string }) => item.id === draft.id),
		).toBeUndefined();
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

		expect(listResponse.body).toEqual(
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
});
