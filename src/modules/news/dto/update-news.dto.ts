import { createZodDto } from "nestjs-zod";
import { createNewsSchema } from "./create-news.dto";

export const updateNewsSchema = createNewsSchema.partial().strict();

export class UpdateNewsDto extends createZodDto(updateNewsSchema) {}
