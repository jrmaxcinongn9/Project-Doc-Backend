import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';

// รวม MailService ไว้ที่เดียว ไม่งั้นแต่ละ module ที่ประกาศเองจะสร้าง
// transporter ซ้ำ และยิง verify ซ้ำทุกครั้งที่ boot
@Module({
  imports: [ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
