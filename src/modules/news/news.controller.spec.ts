import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { auth } from "@/lib/auth";
import { FeedQueryDto } from "./dto/feed-query.dto";
import { feedQuerySchema } from "./dto/feed-query.dto";
import { NewsQueryDto } from "./dto/news-query.dto";
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
