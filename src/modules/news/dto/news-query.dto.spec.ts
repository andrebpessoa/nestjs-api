import { newsQuerySchema } from "./news-query.dto";

describe("newsQuerySchema", () => {
	it("applies defaults from feedQuerySchema", () => {
		const result = newsQuerySchema.parse({});

		expect(result.limit).toBe(20);
		expect(result.sortBy).toBe("createdAt");
		expect(result.order).toBe("desc");
	});

	it("parses published=true string to boolean true", () => {
		const result = newsQuerySchema.parse({ published: "true" });

		expect(result.published).toBe(true);
	});

	it("parses published=false string to boolean false", () => {
		const result = newsQuerySchema.parse({ published: "false" });

		expect(result.published).toBe(false);
	});

	it("accepts authorId as string", () => {
		const result = newsQuerySchema.parse({ authorId: "user_1" });

		expect(result.authorId).toBe("user_1");
	});

	it("rejects unknown keys", () => {
		expect(() => newsQuerySchema.parse({ unknown: "field" })).toThrow();
	});

	it("rejects invalid published value", () => {
		expect(() => newsQuerySchema.parse({ published: "yes" })).toThrow();
	});
});
