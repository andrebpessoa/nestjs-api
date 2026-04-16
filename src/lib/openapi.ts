import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { cleanupOpenApiDoc } from "nestjs-zod";

export function shouldEnableOpenApi(nodeEnv = process.env.NODE_ENV): boolean {
	return nodeEnv !== "production";
}

export function setupOpenApi(app: INestApplication): void {
	const config = new DocumentBuilder()
		.setTitle("Nest API")
		.setDescription("API documentation")
		.setVersion("1.0.0")
		.addCookieAuth("session")
		.build();

	const document = cleanupOpenApiDoc(
		SwaggerModule.createDocument(app, config),
	);

	app.getHttpAdapter().get("/openapi.json", (_req: unknown, res: any) => {
		if (typeof res.header === "function") {
			res.header("Content-Type", "application/json; charset=utf-8");
		}

		if (typeof res.send === "function") {
			return res.send(document);
		}

		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.end(JSON.stringify(document));
	});

	app.use(
		"/docs",
		apiReference({
			url: "/openapi.json",
			withFastify: true,
		}),
	);
}

export function setupOpenApiForEnv(
	app: INestApplication,
	nodeEnv = process.env.NODE_ENV,
): void {
	if (!shouldEnableOpenApi(nodeEnv)) {
		return;
	}

	setupOpenApi(app);
}
