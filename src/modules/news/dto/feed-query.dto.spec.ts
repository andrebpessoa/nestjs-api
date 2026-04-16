import { feedQuerySchema } from "./feed-query.dto";

describe("feedQuerySchema", () => {
	it("applies defaults when no params given", () => {
		const result = feedQuerySchema.parse({});

		expect(result).toEqual({
			limit: 20,
			sortBy: "createdAt",
			order: "desc",
		});
	});

	it("coerces limit from string to number", () => {
		const result = feedQuerySchema.parse({ limit: "5" });

		expect(result.limit).toBe(5);
	});

	it("coerces dateFrom from ISO string to Date", () => {
		const result = feedQuerySchema.parse({ dateFrom: "2026-01-01" });

		expect(result.dateFrom).toBeInstanceOf(Date);
	});

	it("rejects limit above 50", () => {
		expect(() => feedQuerySchema.parse({ limit: "51" })).toThrow();
	});

	it("rejects limit below 1", () => {
		expect(() => feedQuerySchema.parse({ limit: "0" })).toThrow();
	});

	it("rejects unknown keys", () => {
		expect(() => feedQuerySchema.parse({ unknown: "field" })).toThrow();
	});

	it("rejects invalid sortBy value", () => {
		expect(() => feedQuerySchema.parse({ sortBy: "invalid" })).toThrow();
	});
});
