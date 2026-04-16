import { resolve } from "node:path";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

const root = process.cwd();

export default defineConfig({
	esbuild: false,
	oxc: false,
	test: {
		coverage: {
			provider: "istanbul",
		},
		globals: true,
		include: ["src/**/*.spec.ts"],
		root: "./",
	},
	resolve: {
		alias: {
			"@": resolve(root, "src"),
			"@db": resolve(root, "src/database"),
			"@lib": resolve(root, "src/lib"),
			"@modules": resolve(root, "src/modules"),
		},
	},
	plugins: [
		swc.vite({
			module: { type: "es6" },
		}),
	],
});
