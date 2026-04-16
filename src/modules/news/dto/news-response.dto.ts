import { ApiProperty } from "@nestjs/swagger";

export class NewsResponseDto {
	@ApiProperty({ example: "cm9zhf3lg00008v3f07aq8bxz" })
	id!: string;

	@ApiProperty({ example: "Breaking news" })
	title!: string;

	@ApiProperty({
		type: "object",
		additionalProperties: true,
		example: {
			blocks: [{ type: "paragraph", text: "Lorem ipsum" }],
		},
	})
	content!: Record<string, unknown>;

	@ApiProperty({ example: false })
	published!: boolean;

	@ApiProperty({ example: "cm9zhf3lg00018v3f2n2h4k0n" })
	authorId!: string;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: string;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: string;
}

export class PaginatedNewsResponseDto {
	@ApiProperty({ type: [NewsResponseDto] })
	data!: NewsResponseDto[];

	@ApiProperty({
		type: String,
		nullable: true,
		example: "cm9zhf3lg00048v3fngmc4o9f",
	})
	nextCursor!: string | null;
}
