import {
	IsBoolean,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
} from "class-validator";

export class CreateNewsDto {
	@IsString()
	@IsNotEmpty()
	title!: string;

	@IsObject()
	content!: Record<string, unknown>;

	@IsOptional()
	@IsBoolean()
	published?: boolean;
}
