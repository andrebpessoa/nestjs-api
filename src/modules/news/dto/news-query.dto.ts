import { createZodDto } from "nestjs-zod";
import * as z from "zod";
import { feedQuerySchema } from "./feed-query.dto";

export const newsQuerySchema = feedQuerySchema
	.extend({
		published: z
			.enum(["true", "false"])
			.transform((v) => v === "true")
			.optional(),
		authorId: z.string().optional(),
	})
	.strict();

export class NewsQueryDto extends createZodDto(newsQuerySchema) {}
