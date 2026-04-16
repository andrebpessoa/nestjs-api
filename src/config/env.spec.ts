import { envSchema } from "./env";

describe("envSchema", () => {
	const validEnv = {
		DATABASE_URL: "file:./dev.db",
		BETTER_AUTH_SECRET: "a".repeat(32),
		BETTER_AUTH_URL: "http://localhost:3000",
	};

	it("parses a valid env with defaults", () => {
		const parsed = envSchema.parse(validEnv);

		expect(parsed.PORT).toBe(3000);
		expect(parsed.NODE_ENV).toBe("development");
		expect(parsed.DATABASE_URL).toBe("file:./dev.db");
	});

	it("coerces PORT from string", () => {
		const parsed = envSchema.parse({ ...validEnv, PORT: "4000" });
		expect(parsed.PORT).toBe(4000);
	});

	it("rejects missing DATABASE_URL", () => {
		const { DATABASE_URL: _omit, ...rest } = validEnv;
		expect(() => envSchema.parse(rest)).toThrow();
	});

	it("rejects short BETTER_AUTH_SECRET", () => {
		expect(() =>
			envSchema.parse({ ...validEnv, BETTER_AUTH_SECRET: "short" }),
		).toThrow();
	});

	it("rejects invalid NODE_ENV", () => {
		expect(() =>
			envSchema.parse({ ...validEnv, NODE_ENV: "staging" }),
		).toThrow();
	});
});
