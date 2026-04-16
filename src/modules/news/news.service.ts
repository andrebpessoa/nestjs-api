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
