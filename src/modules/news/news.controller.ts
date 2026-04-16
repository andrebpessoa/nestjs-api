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
