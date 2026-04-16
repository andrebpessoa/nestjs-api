import { createZodDto } from "nestjs-zod";
import * as z from "zod";

export const newsResponseSchema = z.object({
	id: z.string(),
	title: z.string(),
	content: z.record(z.string(), z.unknown()),
	published: z.boolean(),
	authorId: z.string(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export class NewsResponseDto extends createZodDto(newsResponseSchema) {}

export const paginatedNewsResponseSchema = z.object({
	data: z.array(newsResponseSchema),
	nextCursor: z.string().nullable(),
});

export class PaginatedNewsResponseDto extends createZodDto(
	paginatedNewsResponseSchema,
) {}
