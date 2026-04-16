import { Injectable } from "@nestjs/common";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient {
	constructor() {
		const url = process.env.DATABASE_URL;

		if (!url) {
			throw new Error("DATABASE_URL is not set");
		}

		const adapter = process.versions.bun
			? new PrismaLibSql({ url })
			: new PrismaBetterSqlite3({ url });
		super({ adapter });
	}
}
