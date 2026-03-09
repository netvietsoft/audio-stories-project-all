import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { MailModule } from '@/mail/mail.module';

@Module({
    imports: [PrismaModule, MailModule],
    controllers: [MembershipsController],
    providers: [MembershipsService],
})
export class MembershipsModule { }
