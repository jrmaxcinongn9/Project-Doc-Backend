import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schema/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // ==========================
  // ✅ CREATE USER
  // ==========================
 async create(data: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  academicYear?: number; // ✅ แก้ตรงนี้
  major?: string;
  student_id?: string;
}) {
    // ✅ check email ซ้ำ
    const emailExists = await this.userModel.findOne({
      email: data.email,
    });

    if (emailExists) {
      throw new BadRequestException('Email already exists');
    }

    // ✅ check student_id ซ้ำ (สำคัญ)
    const studentExists = await this.userModel.findOne({
      student_id: data.student_id,
    });

    if (studentExists) {
      throw new BadRequestException('Student ID already exists');
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
}