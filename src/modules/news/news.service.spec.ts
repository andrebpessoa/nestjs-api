import { PrismaService } from "@db/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { CreateNewsDto } from "./dto/create-news.dto";
import { feedQuerySchema } from "./dto/feed-query.dto";
import { newsQuerySchema } from "./dto/news-query.dto";
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

		const firstCall = prismaMock.news.findMany.mock.calls[0];
		expect(firstCall).toBeDefined();

		const callArgs = firstCall?.[0];
		expect(callArgs?.where.createdAt).toBeDefined();
		expect(callArgs?.where.createdAt?.gte).toBeInstanceOf(Date);
		expect(callArgs?.where.createdAt?.lte).toBeInstanceOf(Date);
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
