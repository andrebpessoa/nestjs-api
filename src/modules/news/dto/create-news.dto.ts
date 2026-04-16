import { createZodDto } from "nestjs-zod";
import * as z from "zod";

export const createNewsSchema = z
	.object({
		title: z.string().trim().min(1),
		content: z.record(z.string(), z.unknown()),
		published: z.boolean().optional(),
	})
	.strict();

export class CreateNewsDto extends createZodDto(createNewsSchema) {}
