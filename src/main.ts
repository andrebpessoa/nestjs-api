import { NestFactory } from "@nestjs/core";
import {
	FastifyAdapter,
	NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { env } from "@/config/env";
import { setupOpenApiForEnv } from "@/lib/openapi";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create<NestFastifyApplication>(
		AppModule,
		new FastifyAdapter({ logger: true }),
		{
			bodyParser: false,
		},
	);

	app.enableShutdownHooks();
	setupOpenApiForEnv(app, env.NODE_ENV);

	await app.listen(env.PORT);
}
bootstrap();
