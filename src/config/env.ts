import * as z from "zod";

export const envSchema = z.object({
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	BETTER_AUTH_SECRET: z
		.string()
		.min(32, "BETTER_AUTH_SECRET must be >= 32 chars"),
	BETTER_AUTH_URL: z.url(),
	PORT: z.coerce.number().int().positive().default(3000),
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
