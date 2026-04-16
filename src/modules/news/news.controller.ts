import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UnauthorizedException,
} from "@nestjs/common";
import {
	AllowAnonymous,
	Session,
	UserSession,
} from "@thallesp/nestjs-better-auth";
import { auth } from "@/lib/auth";
import { CreateNewsDto } from "./dto/create-news.dto";
import { UpdateNewsDto } from "./dto/update-news.dto";
import { NewsService } from "./news.service";

@Controller("news")
export class NewsController {
	constructor(private readonly newsService: NewsService) {}

	@AllowAnonymous()
	@Get("feed")
	feed() {
		return this.newsService.findPublicFeed();
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
	findAll() {
		return this.newsService.findAll();
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
