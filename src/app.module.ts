import { Module } from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { ZodValidationPipe } from "nestjs-zod";
import { auth } from "./lib/auth";
import { NewsModule } from "./modules/news/news.module";

@Module({
	imports: [AuthModule.forRoot({ auth, isGlobal: true }), NewsModule],
	providers: [
		{
			provide: APP_PIPE,
			useClass: ZodValidationPipe,
		},
	],
})
export class AppModule {}
