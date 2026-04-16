import { resolve } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const root = process.cwd();

const alias = {
	"@": resolve(root, "src"),
	"@db": resolve(root, "src/database"),
	"@lib": resolve(root, "src/lib"),
	"@modules": resolve(root, "src/modules"),
};

export default defineConfig({
	esbuild: false,
	oxc: false,
	resolve: { alias },
	plugins: [
		swc.vite({
			module: { type: "es6" },
		}),
	],
	test: {
		globals: true,
		coverage: {
			provider: "istanbul",
		},
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["src/**/*.spec.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "e2e",
					include: ["test/**/*.e2e-spec.ts"],
					globalSetup: ["./test/setup/e2e-global-setup.ts"],
					env: {
						DATABASE_URL: "file:./test.db",
						NODE_ENV: "test",
					},
				},
			},
		],
	},
});
