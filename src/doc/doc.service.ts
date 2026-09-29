import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocEntity, DocDocument } from './schema/doc.schema';
import { Classroom } from '../classroom/schemas/classroom.schema';
import { CreateDocDto } from './dto/create-doc.dto';

@Injectable()
export class DocService {
  constructor(
    @InjectModel(DocEntity.name)
    private readonly docModel: Model<DocDocument>,
    @InjectModel(Classroom.name)
    private readonly classroomModel: Model<Classroom>,
  ) {}

  // ===================================================
  // ✅ 1. สร้าง Assignment ชิ้นเดี่ยว
  // ===================================================
  async create(dto: CreateDocDto, user: any) {
    // ดึง classroom + students
    const classroom = await this.classroomModel
      .findById(dto.classroom)
      .populate('students');

    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    // map รายชื่อนักเรียน
    const students = (classroom.students as any[]).map(s => ({
      student_id: s._id,
      name: s.name,
      status: 'PENDING',
    }));

    // สร้าง assignment พร้อมนักเรียน และวันที่กำหนดส่ง
    const doc = await this.docModel.create({
      assignment_name: dto.assignment_name,
      classroom: dto.classroom,
      user_id: user.userId,
      user_name: user.name,
      publish_date: dto.publish_date ? new Date(dto.publish_date) : null, // 📅 เพิ่มฟิลด์วันประกาศ (เผื่อใช้งาน)
      due_date: dto.due_date ? new Date(dto.due_date) : null,             // 📅 ตัวนี้บันทึกวันสิ้นสุดกำหนดส่ง
      students,
    });

    // push assignment เข้า classroom
    const assignmentId = doc._id as unknown as Types.ObjectId;

    (classroom as Classroom & {
      assignments: Types.ObjectId[];
    }).assignments.push(assignmentId);

    await classroom.save();

    return doc;
  }

  // ===================================================
  // ✅ 2. สร้าง Assignment ทีละหลายชิ้น (createMultiple)
  // ===================================================
  async createMultiple(
    dtos: CreateDocDto[],
    user: { userId: string; name: string },
  ) {
    if (!dtos.length) {
      throw new BadRequestException('ต้องส่ง assignments อย่างน้อย 1 งาน');
    }

    const classroom = await this.classroomModel
      .findById(dtos[0].classroom)
      .populate('students');

    if (!classroom) {
      throw new NotFoundException('Classroom not found');
    }

    const students = (classroom.students as any[]).map(s => ({
      student_id: s._id,
      name: s.name,
      status: 'PENDING',
    }));

    // 🛠️ แก้ไข: จับแมปตัวแปรวันที่ยัดเข้าไปในชุดอาร์เรย์ตอนทำ insertMany ด้วยครับ
    const docs = await this.docModel.insertMany(
      dtos.map(dto => ({
        assignment_name: dto.assignment_name,
        classroom: dto.classroom,
        user_id: user.userId,
        user_name: user.name,
        publish_date: dto.publish_date ? new Date(dto.publish_date) : null, // 📅 ยัดข้อมูลเพิ่มตรงนี้
        due_date: dto.due_date ? new Date(dto.due_date) : null,             // 📅 ยัดข้อมูลเพิ่มตรงนี้
        students,
      })),
    );

    (classroom as Classroom & {
      assignments: Types.ObjectId[];
    }).assignments.push(
      ...docs.map(d => d._id as unknown as Types.ObjectId),
    );

    await classroom.save();

    return docs;
  }

  // DOC ของ user
  async findByUserId(user_id: string) {
    return this.docModel.find({ user_id }).populate('classroom').exec();
  }

  // DOC ทั้งหมด
  async findAll() {
    return this.docModel.find().populate('classroom').exec();
  }

  // DOC ของ classroom
  async findByClassroom(classroomId: string) {
    return this.docModel.find({ classroom: classroomId }).populate('classroom').exec();
  }

  // หา doc ตาม id
  async findOneById(id: string) {
    const doc = await this.docModel.findById(id).populate('classroom');
    if (!doc) throw new NotFoundException('Doc not found');
    return doc;
  }

  // UPDATE
  async update(id: string, updateData: Partial<DocEntity>) {
    const updated = await this.docModel.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) throw new NotFoundException('Doc not found');
    return updated;
  }

  // DELETE
  async delete(id: string) {
    const deleted = await this.docModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Doc not found');
    return { message: 'Deleted successfully' };
  }

  async findOneWithAssignments(classroomId: string) {
    const classroom = await this.classroomModel
      .findById(classroomId)
      .populate('assignments') // join assignment
      .populate('students', '-password') // พร้อม students
      .exec();

    if (!classroom) throw new NotFoundException('Classroom not found');

    return classroom;
  }
}