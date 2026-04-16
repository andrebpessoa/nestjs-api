import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { cleanupOpenApiDoc } from "nestjs-zod";

export function setupOpenApi(app: INestApplication): void {
	const config = new DocumentBuilder()
		.setTitle("Nest API")
		.setDescription("API documentation")
		.setVersion("1.0.0")
		.addCookieAuth("session")
		.build();

	const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));

	app.getHttpAdapter().get("/openapi.json", (_, res) => {
		res.header("Content-Type", "application/json; charset=utf-8");
		res.send(document);
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
	if (nodeEnv === "production") {
		return;
	}

	setupOpenApi(app);
}
