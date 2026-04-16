import { PrismaModule } from "@db/prisma/prisma.module";
import { Module } from "@nestjs/common";
import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";

@Module({
	imports: [PrismaModule],
	controllers: [NewsController],
	providers: [NewsService],
})
export class NewsModule {}
