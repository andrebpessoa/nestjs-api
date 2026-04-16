import { News, Prisma } from "@db/prisma/generated/prisma/client";
import { PrismaService } from "@db/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateNewsDto } from "./dto/create-news.dto";
import { FeedQueryDto } from "./dto/feed-query.dto";
import { NewsQueryDto } from "./dto/news-query.dto";
import { UpdateNewsDto } from "./dto/update-news.dto";

export interface PaginatedResult<T> {
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
				content: dto.content,
				published: dto.published ?? false,
				authorId,
			},
		});
	}

	async findPublicFeed(query: FeedQueryDto): Promise<PaginatedResult<News>> {
		const { q, cursor, limit, dateFrom, dateTo, sortBy, order } = query;
		const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
		const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

		const where: Prisma.NewsWhereInput = {
			published: true,
			deletedAt: null,
			...(q && { title: { contains: q } }),
			...((parsedDateFrom || parsedDateTo) && {
				createdAt: { gte: parsedDateFrom, lte: parsedDateTo },
			}),
		};

		const items = await this.prisma.news.findMany({
			where,
			orderBy: this.buildOrderBy(sortBy, order),
			take: limit + 1,
			...this.buildCursorArgs(cursor),
		});

		return this.paginateResult(items, limit);
	}

	async findPublicById(id: string): Promise<News> {
		const news = await this.prisma.news.findFirst({
			where: { id, published: true, deletedAt: null },
		});

		if (!news) {
			throw new NotFoundException("News not found");
		}

		return news;
	}

	async findAll(query: NewsQueryDto): Promise<PaginatedResult<News>> {
		const {
			q,
			cursor,
			limit,
			dateFrom,
			dateTo,
			sortBy,
			order,
			published,
			authorId,
		} = query;
		const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
		const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

		const where: Prisma.NewsWhereInput = {
			...(published !== undefined && { published }),
			...(authorId && { authorId }),
			...(q && { title: { contains: q } }),
			...((parsedDateFrom || parsedDateTo) && {
				createdAt: { gte: parsedDateFrom, lte: parsedDateTo },
			}),
		};

		const items = await this.prisma.news.findMany({
			where,
			orderBy: this.buildOrderBy(sortBy, order),
			take: limit + 1,
			...this.buildCursorArgs(cursor),
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
				content: dto.content,
				published: dto.published,
			},
		});
	}

	async remove(id: string): Promise<News> {
		await this.assertExists(id);
		return this.prisma.news.delete({ where: { id } });
	}

	private buildCursorArgs(
		cursor: string | undefined,
	): Pick<Prisma.NewsFindManyArgs, "skip" | "cursor"> {
		return cursor ? { skip: 1, cursor: { id: cursor } } : {};
	}

	private buildOrderBy(
		sortBy: "createdAt" | "updatedAt" | "title",
		order: "asc" | "desc",
	): Prisma.NewsOrderByWithRelationInput[] {
		const primary: Prisma.NewsOrderByWithRelationInput =
			sortBy === "title"
				? { title: order }
				: sortBy === "updatedAt"
					? { updatedAt: order }
					: { createdAt: order };
		return [primary, { id: order }];
	}

	private paginateResult<T extends { id: string }>(
		items: T[],
		limit: number,
	): PaginatedResult<T> {
		const hasNextPage = items.length > limit;
		const data = hasNextPage ? items.slice(0, limit) : items;
		const last = data.at(-1);
		return {
			data,
			nextCursor: hasNextPage && last ? last.id : null,
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
