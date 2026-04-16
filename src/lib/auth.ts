import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/database/prisma/prisma.service";

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "sqlite",
	}),
	trustedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
	emailAndPassword: {
		enabled: true,
	},
});
