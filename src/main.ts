import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { env } from "@/config/env";
import { setupOpenApiForEnv } from "@/lib/openapi";
import { AppModule } from "./app.module";

async function bootstrap() {
	const adapter = new FastifyAdapter({ logger: true });

	adapter.enableCors({
		origin: ["http://localhost:3000"],
		credentials: true,
		methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["Set-Cookie"],
	});

	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		adapter,
		{
			bodyParser: false,
		},
	);

	app.enableShutdownHooks();
	setupOpenApiForEnv(app, env.NODE_ENV);

	await app.listen(env.PORT);
}

bootstrap();
