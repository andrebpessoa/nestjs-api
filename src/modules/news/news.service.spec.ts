import { PrismaService } from "@db/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
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

	it("findPublicFeed should query only published news", async () => {
		prismaMock.news.findMany.mockResolvedValue([]);

		await service.findPublicFeed();

		expect(prismaMock.news.findMany).toHaveBeenCalledWith({
			where: { published: true },
			orderBy: { createdAt: "desc" },
		});
	});

	it("findPublicById should throw NotFoundException for draft or missing item", async () => {
		prismaMock.news.findFirst.mockResolvedValue(null);

		await expect(service.findPublicById("news_1")).rejects.toThrow(
			NotFoundException,
		);
	});

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

	it("findOne should throw NotFoundException when item does not exist", async () => {
		prismaMock.news.findUnique.mockResolvedValue(null);

		await expect(service.findOne("news_1")).rejects.toThrow(NotFoundException);
	});
});
