import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Admin } from './schema/admin.schema';
import { RegisterAdminDTO } from './dto/register-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(@InjectModel(Admin.name) private adminModel: Model<Admin>) {}

  async create(registerAdminDTO: RegisterAdminDTO): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(registerAdminDTO.password, 10);
    const admin = new this.adminModel({
      ...registerAdminDTO,
      password: hashedPassword,
    });
    return admin.save();
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.adminModel.findOne({ email }).exec();
  }

  async findAll(): Promise<Admin[]> {
    return this.adminModel.find().select('-password').exec();
  }

  async delete(id: string): Promise<Admin | null> {
    return this.adminModel.findByIdAndDelete(id).exec();
  }
  
}