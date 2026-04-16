import { PrismaService } from "@db/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { News, Prisma } from "@/generated/prisma/client";
import { CreateNewsDto } from "./dto/create-news.dto";
import { UpdateNewsDto } from "./dto/update-news.dto";

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

	async findPublicFeed(): Promise<News[]> {
		return this.prisma.news.findMany({
			where: { published: true },
			orderBy: { createdAt: "desc" },
		});
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

	async findAll(): Promise<News[]> {
		return this.prisma.news.findMany({
			orderBy: { createdAt: "desc" },
		});
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
				...(dto.title !== undefined ? { title: dto.title } : {}),
				...(dto.content !== undefined
					? { content: dto.content as Prisma.InputJsonValue }
					: {}),
				...(dto.published !== undefined ? { published: dto.published } : {}),
			},
		});
	}

	async remove(id: string): Promise<News> {
		await this.assertExists(id);
		return this.prisma.news.delete({ where: { id } });
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
