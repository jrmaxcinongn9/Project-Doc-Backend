import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from '../mail/mail.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportTicket, SupportTicketSchema } from './support.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: SupportTicket.name, schema: SupportTicketSchema }]), MailModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
