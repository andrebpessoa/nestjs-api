import { createZodDto } from "nestjs-zod";
import * as z from "zod";
import type { Prisma } from "@/generated/prisma/client";

export const createNewsSchema = z
	.object({
		title: z.string().trim().min(1),
		content: z
			.record(z.string(), z.unknown())
			.transform((value) => value as Prisma.InputJsonObject),
		published: z.boolean().optional(),
	})
	.strict();

export class CreateNewsDto extends createZodDto(createNewsSchema) {}
