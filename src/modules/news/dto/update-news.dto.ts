import { createZodDto } from "nestjs-zod";
import * as z from "zod";
import { createNewsSchema } from "./create-news.dto";

export const updateNewsSchema = createNewsSchema
	.partial()
	.extend({ deleted: z.boolean().optional() })
	.strict();

export class UpdateNewsDto extends createZodDto(updateNewsSchema) {}
