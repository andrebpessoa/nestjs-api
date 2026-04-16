import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./lib/auth";
import { NewsModule } from "./modules/news/news.module";

@Module({
	imports: [AuthModule.forRoot({ auth, isGlobal: true }), NewsModule],
})
export class AppModule {}
