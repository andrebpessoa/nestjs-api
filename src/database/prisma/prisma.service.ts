import { Injectable } from "@nestjs/common";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient {
	constructor() {
		const url = process.env.DATABASE_URL;

		if (!url) {
			throw new Error("DATABASE_URL is not set");
		}

		const adapter = new PrismaLibSql({ url });
		super({ adapter });
	}
}
