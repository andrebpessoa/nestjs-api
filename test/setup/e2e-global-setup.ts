import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";

const TEST_DB_FILES = ["test.db", "test.db-journal"];

export default function setup(): void {
	for (const file of TEST_DB_FILES) {
		if (existsSync(file)) {
			rmSync(file);
		}
	}

	// Prisma requires the SQLite file to exist before running migrate deploy.
	writeFileSync("test.db", "");

	execFileSync("bunx", ["prisma", "migrate", "deploy"], {
		env: { ...process.env, DATABASE_URL: "file:./test.db" },
		stdio: "inherit",
	});
}
