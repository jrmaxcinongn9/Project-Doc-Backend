import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, mongo } from 'mongoose';
import { Readable } from 'stream';
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
        // บอกให้ชัดว่าฟิลด์ไหนชน ข้อความเดิมคือ Duplicate data detected เฉย ๆ
        // ซึ่งอ่านแล้วเดาสาเหตุไม่ถูกเลย และเสียเวลาไล่หานาน
        const field = Object.keys(err.keyPattern ?? {})[0];

        if (field === 'student_id') {
          throw new BadRequestException(
            'รหัสนักศึกษาซ้ำกับบัญชีอื่น ถ้าเป็นบัญชีครูหรือผู้ดูแลที่ไม่มีรหัสนักศึกษา แปลว่า index ของ student_id ในฐานข้อมูลยังไม่ใช่ sparse ให้รัน scripts/fix-student-id-index.js',
          );
        }

        throw new BadRequestException(
          field ? `ข้อมูลซ้ำที่ฟิลด์ ${field}` : 'Duplicate data detected',
        );
      }

      throw err;
    }
  }

  // ==========================
  // ผู้ใช้ที่ครูคนนี้เห็นได้
  //   ตัวเอง
  //   นักศึกษาในห้องที่ตัวเองสร้าง
  //   นักศึกษาที่จับคู่ด้วย category (หน้านักศึกษาของฉัน)
  // ครูไม่เห็นนักศึกษาของห้องอื่น และไม่เห็นบัญชีครูหรือ admin คนอื่น
  async findVisibleToTeacher(teacherId: string): Promise<UserDocument[]> {
    if (!Types.ObjectId.isValid(teacherId)) return [];
    const me = new Types.ObjectId(teacherId);

    // อ่าน collection ห้องตรง ๆ เลี่ยงการพึ่งพา ClassroomModule ที่พึ่ง UserModule อยู่แล้ว
    const rooms = await this.userModel.db
      .collection('classrooms')
      .find({ createdBy: me }, { projection: { students: 1 } })
      .toArray();
    const roomStudentIds = rooms.flatMap((r: any) => r.students ?? []);

    const teacher: any = await this.userModel.findById(me).select('category').lean();
    const or: any[] = [{ _id: me }, { _id: { $in: roomStudentIds } }];
    if (teacher?.category) {
      or.push({ role: UserRole.USER, status: AccountStatus.APPROVED, category: teacher.category });
    }

    return this.userModel.find({ $or: or }).exec();
  }

  // ----------------------- รูปโปรไฟล์ -----------------------
  // เก็บใน GridFS เหมือนไฟล์งาน ดิสก์ของ Render ล้างทุกครั้งที่ deploy
  static readonly AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  static readonly AVATAR_MAX_BYTES = 2 * 1024 * 1024;

  private avatarBucket() {
    return new mongo.GridFSBucket(this.userModel.db.db as any, { bucketName: 'avatars' });
  }

  async setAvatar(userId: string, file: { buffer: Buffer; mimetype: string; originalname?: string }) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const upload = this.avatarBucket().openUploadStream(`avatar-${userId}`, {
      metadata: { user_id: userId, mimetype: file.mimetype },
    });
    await new Promise<void>((resolve, reject) => {
      Readable.from(file.buffer).pipe(upload).on('error', reject).on('finish', () => resolve());
    });

    const old = (user as any).avatar_id;
    (user as any).avatar_id = String(upload.id);
    await user.save();

    // รูปเดิมไม่มีใครใช้แล้ว ลบทิ้ง ไม่ให้ค้างกินพื้นที่
    if (old) await this.deleteAvatarFile(old);

    return { avatar_id: String(upload.id) };
  }

  async getAvatar(userId: string): Promise<{ stream: Readable; mimetype: string } | null> {
    const user: any = await this.userModel.findById(userId).select('avatar_id').lean();
    const id = user?.avatar_id;
    if (!id || !Types.ObjectId.isValid(id)) return null;

    const [meta] = await this.avatarBucket().find({ _id: new Types.ObjectId(id) as any }).limit(1).toArray();
    if (!meta) return null;

    return {
      stream: this.avatarBucket().openDownloadStream(new Types.ObjectId(id) as any),
      mimetype: (meta.metadata as any)?.mimetype ?? 'image/png',
    };
  }

  async removeAvatar(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    const old = (user as any).avatar_id;
    (user as any).avatar_id = undefined;
    await user.save();
    if (old) await this.deleteAvatarFile(old);

    return { message: 'ลบรูปโปรไฟล์แล้ว' };
  }

  private async deleteAvatarFile(id: string) {
    try {
      if (Types.ObjectId.isValid(id)) await this.avatarBucket().delete(new Types.ObjectId(id) as any);
    } catch {
      // ไม่มีไฟล์อยู่แล้ว ไม่ต้องทำอะไร
    }
  }

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

    const wasApproved = user.status === AccountStatus.APPROVED;
    user.status = status;
    (user as any).approvedBy = approvedBy;
    (user as any).approvedAt = new Date();

    const saved = await user.save();

    if (status === AccountStatus.APPROVED && !wasApproved) {
      await this.sendApprovedLoginLink(saved);
    }

    return saved;
  }

  // สร้าง token ยืนยันอีเมลแล้วส่งลิงก์ให้ผู้สมัคร
  // คืนลิงก์เสมอ แม้ส่งเมลไม่สำเร็จ เพราะกรณีที่ส่งไม่ได้คือกรณีที่ต้องใช้ลิงก์นี้
  async sendVerifyMail(id: string): Promise<string> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ใช้รหัสเดิมถ้ายังไม่หมดอายุ ลิงก์ในเมลทุกฉบับที่ส่งไปแล้วจึงใช้ได้เหมือนกัน
    // เดิมสร้างรหัสใหม่ทุกครั้ง รวมถึงตอนกด Login ด้วยบัญชีที่ยังไม่ยืนยัน
    // ผู้ใช้กดลิงก์ในเมลฉบับแรกแล้วเจอว่าลิงก์ไม่ถูกต้อง ทั้งที่เพิ่งได้รับเมล
    const current = (user as any).verifyToken as string | undefined;
    const currentExpires = (user as any).verifyTokenExpires as Date | undefined;
    const stillValid = !!current && !!currentExpires && currentExpires.getTime() > Date.now() + 60 * 60 * 1000;

    const token = stillValid ? (current as string) : randomBytes(32).toString('hex');
    if (!stillValid) {
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);
      (user as any).verifyToken = token;
      (user as any).verifyTokenExpires = expires;
      await user.save();
    }

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

    const wasVerified = !!(user as any).isVerified;
    (user as any).isVerified = true;
    (user as any).verifyToken = undefined;
    (user as any).verifyTokenExpires = undefined;
    (user as any).verifiedBy = adminEmail;

    const saved = await user.save();

    // อนุมัติไปก่อนแล้วเพิ่งยืนยันอีเมลทีหลัง ส่งลิงก์เข้าระบบตอนนี้
    if (!wasVerified) {
      await this.sendApprovedLoginLink(saved);
    }

    return saved;
  }

  // ผู้ใช้กดลิงก์ในเมล
  async verifyEmail(token: string): Promise<{ approved: boolean; loginToken: string | null; already: boolean; status?: string }> {
    if (!token) {
      throw new BadRequestException('ไม่พบ token สำหรับยืนยันอีเมล');
    }

    const user = await this.userModel.findOne({ verifyToken: token }).exec();
    if (!user) {
      // กดลิงก์ที่ยืนยันไปแล้วซ้ำ ไม่ใช่ความผิดพลาด บอกให้ชัดว่ายืนยันแล้ว
      const done: any = await this.userModel.findOne({ usedVerifyToken: token }).exec();
      if (done?.isVerified) {
        return { approved: false, loginToken: null, already: true, status: done.status };
      }
      throw new BadRequestException('ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุแล้ว กรุณาเข้าสู่ระบบเพื่อขอลิงก์ใหม่');
    }

    const expires = (user as any).verifyTokenExpires as Date | undefined;
    if (!expires || expires.getTime() < Date.now()) {
      throw new BadRequestException('ลิงก์ยืนยันหมดอายุแล้ว กรุณาขอลิงก์ใหม่');
    }

    (user as any).isVerified = true;
    (user as any).usedVerifyToken = token;
    (user as any).verifyToken = undefined;
    (user as any).verifyTokenExpires = undefined;

    // บัญชีที่อนุมัติแล้ว กดลิงก์ยืนยันแล้วเข้าระบบได้เลย
    // บัญชีที่ยังรออนุมัติ จะได้ลิงก์เข้าระบบทางเมลตอน admin อนุมัติ
    let loginToken: string | null = null;
    if ((user as any).status === AccountStatus.APPROVED) {
      loginToken = this.newLoginToken(user);
    }
    await user.save();

    return { approved: loginToken !== null, loginToken, already: false, status: (user as any).status };
  }

  // ----------------------- ลิงก์เข้าสู่ระบบครั้งเดียว -----------------------
  static readonly LOGIN_TOKEN_HOURS = 48;

  private newLoginToken(user: UserDocument): string {
    const token = randomBytes(32).toString('hex');
    (user as any).loginToken = token;
    (user as any).loginTokenExpires = new Date(Date.now() + UserService.LOGIN_TOKEN_HOURS * 3600 * 1000);
    return token;
  }

  private frontendUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') || 'https://project-doc-fontend.vercel.app'
    ).replace(/\/+$/, '');
  }

  /**
   * แลกลิงก์เข้าสู่ระบบเป็นผู้ใช้ ใช้ได้ครั้งเดียว
   * บัญชีต้องยืนยันอีเมลและได้รับอนุมัติแล้ว เงื่อนไขเดียวกับการ login ด้วยรหัสผ่าน
   */
  async consumeLoginToken(token: string): Promise<UserDocument> {
    if (!token) throw new BadRequestException('ลิงก์เข้าสู่ระบบไม่ถูกต้อง');

    const user = await this.userModel.findOne({ loginToken: token }).exec();
    if (!user) throw new BadRequestException('ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือถูกใช้ไปแล้ว');

    const expires = (user as any).loginTokenExpires as Date | undefined;

    // ใช้แล้วทิ้งทันที ไม่ว่าจะผ่านหรือไม่ผ่าน
    (user as any).loginToken = undefined;
    (user as any).loginTokenExpires = undefined;
    await user.save();

    if (!expires || expires.getTime() < Date.now()) {
      throw new BadRequestException('ลิงก์เข้าสู่ระบบหมดอายุแล้ว กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน');
    }
    if (!(user as any).isVerified || (user as any).status !== AccountStatus.APPROVED) {
      throw new BadRequestException('บัญชียังไม่พร้อมใช้งาน');
    }

    return user;
  }

  /**
   * ส่งเมลแจ้งว่าอนุมัติแล้ว พร้อมลิงก์เข้าระบบครั้งเดียว
   * ส่งเฉพาะบัญชีที่ยืนยันอีเมลแล้ว ถ้ายังไม่ยืนยัน จะได้เข้าระบบตอนกดลิงก์ยืนยันแทน
   * ส่งไม่สำเร็จไม่ทำให้การอนุมัติล้ม
   */
  async sendApprovedLoginLink(user: UserDocument): Promise<string | null> {
    if (!(user as any).isVerified || (user as any).status !== AccountStatus.APPROVED) return null;

    const token = this.newLoginToken(user);
    await user.save();

    const link = `${this.frontendUrl()}/login/magic?token=${token}`;
    try {
      await this.mailService.sendApprovedMail(user.email, link);
    } catch (err) {
      console.error('ส่งเมลแจ้งอนุมัติไม่สำเร็จ:', (err as Error).message);
    }
    return link;
  }
}
