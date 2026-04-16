import { createZodDto } from "nestjs-zod";
import * as z from "zod";

const dateInputSchema = z
	.string()
	.trim()
	.refine((value) => !Number.isNaN(Date.parse(value)), {
		message: "Invalid date",
	});

export const feedQuerySchema = z
	.object({
		q: z.string().trim().min(1).optional(),
		cursor: z.string().optional(),
		limit: z.coerce.number().int().min(1).max(50).default(20),
		dateFrom: dateInputSchema.optional(),
		dateTo: dateInputSchema.optional(),
		sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
		order: z.enum(["asc", "desc"]).default("desc"),
	})
	.strict();

export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
