import { Module } from "@nestjs/common";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "nestjs-zod";
import { auth } from "./lib/auth";
import { NewsModule } from "./modules/news/news.module";

@Module({
	imports: [
		AuthModule.forRoot({ auth, isGlobal: true }),
		ThrottlerModule.forRoot([
			{ name: "auth", ttl: 60000, limit: 20 },
			{ name: "news", ttl: 60000, limit: 100 },
			{ name: "feed", ttl: 60000, limit: 200 },
		]),
		NewsModule,
	],
	providers: [
		{
			provide: APP_PIPE,
			useClass: ZodValidationPipe,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
	],
})
export class AppModule {}
