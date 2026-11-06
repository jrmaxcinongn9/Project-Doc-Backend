import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailService } from '../mail/mail.service';
import { CreateSupportDto } from './dto/support.dto';
import { SupportStatus, SupportTicket, SupportTicketDocument } from './support.schema';

@Injectable()
export class SupportService {
  // แจ้งได้ไม่เกินเท่านี้ต่ออีเมลต่อชั่วโมง กันสแปมเพราะเส้นนี้ไม่ต้อง login
  static readonly MAX_PER_HOUR = 5;

  constructor(
    @InjectModel(SupportTicket.name)
    private readonly model: Model<SupportTicketDocument>,
    private readonly mail: MailService,
  ) {}

  async create(dto: CreateSupportDto, user?: { _id?: string; role?: string } | null) {
    const email = dto.email.trim().toLowerCase();

    const recent = await this.model.countDocuments({
      email,
      createdAt: { $gt: new Date(Date.now() - 3600_000) },
    });
    if (recent >= SupportService.MAX_PER_HOUR) {
      throw new HttpException('แจ้งปัญหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่', HttpStatus.TOO_MANY_REQUESTS);
    }

    const ticket = await this.model.create({
      name: dto.name.trim(),
      email,
      topic: dto.topic,
      message: dto.message.trim(),
      user_id: user?._id ?? undefined,
      user_role: user?.role ?? undefined,
    });

    return { _id: String(ticket._id), message: 'ได้รับเรื่องแล้ว ผู้ดูแลระบบจะตอบกลับทางอีเมล' };
  }

  async list(status?: string) {
    const filter: any = {};
    if (status === SupportStatus.OPEN || status === SupportStatus.RESOLVED) filter.status = status;
    return this.model.find(filter).sort({ status: 1, createdAt: -1 }).limit(200).lean();
  }

  private async get(id: string) {
    const t = Types.ObjectId.isValid(id) ? await this.model.findById(id) : null;
    if (!t) throw new NotFoundException('ไม่พบเรื่องที่แจ้ง');
    return t;
  }

  async setStatus(id: string, status: SupportStatus, adminEmail?: string) {
    const t = await this.get(id);
    t.status = status;
    t.resolvedBy = status === SupportStatus.RESOLVED ? adminEmail : undefined;
    t.resolvedAt = status === SupportStatus.RESOLVED ? new Date() : undefined;
    return t.save();
  }

  /**
   * admin ตอบเรื่อง ส่งคำตอบทางเมลไปหาคนแจ้ง
   * ส่งเมลไม่สำเร็จ คำตอบยังถูกเก็บ และบอก admin ว่ายังไม่ได้ส่ง
   */
  async reply(id: string, message: string, adminEmail: string, resolve = false) {
    const t = await this.get(id);

    let mailed = true;
    try {
      await this.mail.sendSupportReply(t.email, t.name, t.message, message);
    } catch (err) {
      mailed = false;
      console.error('ส่งเมลตอบเรื่องแจ้งปัญหาไม่สำเร็จ:', (err as Error).message);
    }

    t.replies.push({ by: adminEmail, message: message.trim(), at: new Date(), mailed });
    t.markModified('replies');
    if (resolve) {
      t.status = SupportStatus.RESOLVED;
      t.resolvedBy = adminEmail;
      t.resolvedAt = new Date();
    }
    await t.save();

    return { ticket: t, mailed };
  }

  async openCount() {
    return this.model.countDocuments({ status: SupportStatus.OPEN });
  }
}
