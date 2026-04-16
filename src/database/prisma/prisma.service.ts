import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { env } from "@/config/env";
import { PrismaClient } from "./generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
	constructor() {
		super({ adapter: new PrismaLibSql({ url: env.DATABASE_URL }) });
	}

	async onModuleDestroy(): Promise<void> {
		await this.$disconnect();
	}
}

export const prisma = new PrismaService();
