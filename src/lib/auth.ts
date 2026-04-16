import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaService } from "@/database/prisma/prisma.service";

const prisma = new PrismaService();

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "sqlite",
	}),
	emailAndPassword: {
		enabled: true,
	},
});
