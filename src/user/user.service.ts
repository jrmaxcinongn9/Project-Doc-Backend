import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { MailService } from '../mail/mail.service';
import {
  AccountStatus,
  User,
  UserDocument,
  UserRole,
} from './schema/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  // ==========================
  // ✅ CREATE USER
  // ==========================
 async create(data: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  major?: string;
  student_id?: string;
  category?: string;
  isVerified?: boolean;
  status?: AccountStatus;
}) {
    // ✅ check email ซ้ำ
    const emailExists = await this.userModel.findOne({
      email: data.email,
    });

    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    // ✅ check student_id ซ้ำ (เช็คเฉพาะตอนมีค่า ครูกับ admin ไม่มีรหัสนักศึกษา)
    if (data.student_id) {
      const studentExists = await this.userModel.findOne({
        student_id: data.student_id,
      });

      if (studentExists) {
        throw new BadRequestException('Student ID already exists');
      }
    }

    try {
      const created = new this.userModel({
        ...data,
        role: data.role ?? UserRole.USER,
      });

      const saved = await created.save();

      // ❌ ไม่ส่ง password กลับ
      const { password, ...result } = saved.toObject();

      return result;
    } catch (err: any) {
      // ✅ กัน Mongo duplicate index error (code 11000)
      if (err.code === 11000) {
        throw new BadRequestException('Duplicate data detected');
      }

      throw err;
    }
  }

  // ==========================
  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findByRole(role: UserRole): Promise<UserDocument[]> {
    return this.userModel.find({ role }).exec();
  }

  // จับคู่ครูกับนักศึกษาด้วย category ที่ตรงกัน
  // นักศึกษาเลือกตามสถานประกอบการที่ไปฝึก ครูเลือกตามความเชี่ยวชาญ
  //
  // นับเฉพาะบัญชีที่อนุมัติแล้ว คนที่ยังรออนุมัติยังไม่ใช่นักศึกษาในระบบ
  // ถ้านับมาด้วย ครูจะเห็นคนที่ admin ยังไม่รับเข้ามาปนอยู่ในห้องตัวเอง
  async findStudentsByCategory(category?: string): Promise<UserDocument[]> {
    // ครูที่ยังไม่มี category จับคู่กับใครไม่ได้
    // ถ้าปล่อยผ่านไป ตัวกรองจะกลายเป็นหาคนที่ category ว่าง ซึ่งไม่ใช่ความหมายที่ต้องการ
    if (!category) {
      return [];
    }

    return this.userModel
      .find({
        role: UserRole.USER,
        category,
        status: AccountStatus.APPROVED,
      })
      .select('-password')
      .exec();
  }

  // นักศึกษาที่อนุมัติแล้วแต่ไม่มีครูคนไหนถือ category เดียวกัน
  // ใช้ให้ admin เห็นว่าต้องหาครูเพิ่มสาขาไหน ไม่ให้มีคนตกหล่น
  async findStudentsWithoutTeacher(): Promise<UserDocument[]> {
    const teachers = await this.findByRole(UserRole.TEACHER);
    const covered = teachers
      .map((t) => (t as any).category)
      .filter((c): c is string => Boolean(c));

    return this.userModel
      .find({
        role: UserRole.USER,
        status: AccountStatus.APPROVED,
        $or: [
          { category: { $nin: covered } },
          { category: { $exists: false } },
          { category: null },
        ],
      })
      .select('-password')
      .exec();
  }

  async updateUser(
    id: string,
    updates: Partial<User>,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(id, updates, { new: true })
      .exec();
  }

  async delete(id: string) {
    const res = await this.userModel.findByIdAndDelete(id).exec();

    if (!res) {
      throw new NotFoundException('User not found');
    }

    return { message: 'Deleted successfully' };
  }

  // หา user จาก token ยืนยันอีเมล
  async findByVerifyToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ verifyToken: token }).exec();
  }

  // รายชื่อที่รอ admin อนุมัติ
  async findPending(): Promise<UserDocument[]> {
    // บัญชีที่สมัครไว้ก่อนมีฟิลด์ status ไม่มีคีย์นี้อยู่ในเอกสารเลย
    // ด่าน login ถือว่าบัญชีพวกนั้นยังไม่ได้รับอนุมัติและปิดกั้นไว้
    // ถ้ากรองแค่ status เท่ากับ PENDING บัญชีเหล่านั้นจะไม่โผล่มาให้ admin เห็น
    // กลายเป็นเข้าระบบไม่ได้และไม่มีใครกดอนุมัติให้ได้เลย จึงต้องนับรวมมาด้วย
    // ส่วน ADMIN ข้ามด่านอนุมัติอยู่แล้ว ไม่ต้องมารอในรายการนี้
    return this.userModel
      .find({
        role: { $ne: UserRole.ADMIN },
        $or: [
          { status: AccountStatus.PENDING },
          { status: { $exists: false } },
          { status: null },
        ],
      })
      .select('-password')
      .exec();
  }

  // admin กดอนุมัติหรือปฏิเสธ
  async setStatus(
    id: string,
    status: AccountStatus,
    approvedBy?: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.status = status;
    (user as any).approvedBy = approvedBy;
    (user as any).approvedAt = new Date();

    return user.save();
  }

  // สร้าง token ยืนยันอีเมลแล้วส่งลิงก์ให้ผู้สมัคร
  // คืนลิงก์เสมอ แม้ส่งเมลไม่สำเร็จ เพราะกรณีที่ส่งไม่ได้คือกรณีที่ต้องใช้ลิงก์นี้
  async sendVerifyMail(id: string): Promise<string> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    (user as any).verifyToken = token;
    (user as any).verifyTokenExpires = expires;
    await user.save();

    const base =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:8000';

    const link = `${base}/verify-email?token=${token}`;

    // token ถูกบันทึกไปแล้ว ลิงก์จึงใช้ได้ไม่ว่าการส่งเมลจะสำเร็จหรือไม่
    // ปล่อยให้ error ของเมลล้มทั้งฟังก์ชันจะทำให้ผู้เรียกไม่ได้ลิงก์ไปด้วย
    // ซึ่งตัดทางออกทิ้งพอดีในสถานการณ์ที่ต้องการมันที่สุด
    try {
      await this.mailService.sendVerifyMail(user.email, link);
    } catch (err) {
      console.error('ส่งเมลยืนยันไม่สำเร็จ:', err);
    }

    return link;
  }

  // admin กดยืนยันอีเมลแทนผู้ใช้
  // จำเป็นเมื่อเมลส่งไม่ถึง ซึ่งเกิดได้ทั้งจากผู้ให้บริการเมลและจากกล่องปลายทาง
  // ผู้ใช้จึงไม่ควรถูกขังไว้นอกระบบเพราะเหตุที่เขาแก้เองไม่ได้
  async markVerifiedByAdmin(
    id: string,
    adminEmail?: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    (user as any).isVerified = true;
    (user as any).verifyToken = undefined;
    (user as any).verifyTokenExpires = undefined;
    (user as any).verifiedBy = adminEmail;

    return user.save();
  }

  // ผู้ใช้กดลิงก์ในเมล
  async verifyEmail(token: string): Promise<void> {
    if (!token) {
      throw new BadRequestException('ไม่พบ token สำหรับยืนยันอีเมล');
    }

    const user = await this.userModel.findOne({ verifyToken: token }).exec();
    if (!user) {
      throw new BadRequestException('ลิงก์ยืนยันไม่ถูกต้องหรือถูกใช้ไปแล้ว');
    }

    const expires = (user as any).verifyTokenExpires as Date | undefined;
    if (!expires || expires.getTime() < Date.now()) {
      throw new BadRequestException('ลิงก์ยืนยันหมดอายุแล้ว กรุณาขอลิงก์ใหม่');
    }

    (user as any).isVerified = true;
    (user as any).verifyToken = undefined;
    (user as any).verifyTokenExpires = undefined;
    await user.save();
  }
}
