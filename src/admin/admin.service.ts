import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Admin } from './schema/admin.schema';
import { RegisterAdminDTO } from './dto/register-admin.dto';
import { UserService } from '../user/user.service';
import { AccountStatus, UserRole } from '../user/schema/user.schema';

/**
 * admin เคยถูกเก็บแยกไว้ใน collection ของตัวเอง ซึ่งไม่มีเส้น login ไหนอ่านเลย
 * ทุกเส้น login อ่านจาก users ทั้งหมด บัญชี admin ที่สร้างไว้จึงเข้าระบบไม่ได้
 *
 * ตอนนี้ admin ถูกสร้างลง users พร้อม role ADMIN เหมือน teacher
 * collection เดิมยังอ่านได้อยู่ เพื่อให้ script ย้ายข้อมูลเก่าทำงานได้
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private readonly userService: UserService,
  ) {}

  async create(registerAdminDTO: RegisterAdminDTO) {
    // admin ไม่ต้องยืนยันอีเมลและไม่ต้องรอใครอนุมัติ
    // จึงตั้งสถานะให้ผ่านด่านทั้งสองชั้นตั้งแต่สร้าง
    return this.userService.create({
      name: registerAdminDTO.name,
      email: registerAdminDTO.email,
      password: registerAdminDTO.password,
      role: UserRole.ADMIN,
      isVerified: true,
      status: AccountStatus.APPROVED,
    });
  }

  // มี admin อยู่แล้วหรือยัง ใช้ตัดสินว่าเส้นสร้าง admin ยังเปิดให้คนนอกได้ไหม
  async hasAnyAdmin(): Promise<boolean> {
    const admins = await this.userService.findByRole(UserRole.ADMIN);
    return admins.length > 0;
  }

  async findByEmail(email: string) {
    return this.userService.findByEmail(email);
  }

  async findAll() {
    return this.userService.findByRole(UserRole.ADMIN);
  }

  async delete(id: string) {
    return this.userService.delete(id);
  }

  // อ่านจาก collection เดิม ใช้เฉพาะตอนย้ายข้อมูล
  async findLegacyAdmins(): Promise<Admin[]> {
    return this.adminModel.find().exec();
  }
}
