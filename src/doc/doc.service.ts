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
      // คะแนนเต็มของงานชิ้นนี้ ครูกรอกตอนสร้าง แล้วค่อยให้คะแนนรายคนทีหลัง
      max_score: dto.max_score ?? null,
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
        max_score: dto.max_score ?? null,
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

  // ===================================================
  // ✅ ครูให้คะแนนและเขียน feedback ของนักศึกษาหนึ่งคน
  // ===================================================
  //
  // ฟิลด์ score, feedback, max_score มีอยู่ในฐานข้อมูลมานานแล้ว
  // แต่ไม่มีเส้นไหนเขียนลงไปได้เลย ครูจึงให้คะแนนไม่ได้จริง
  async gradeStudent(
    docId: string,
    studentId: string,
    data: { score?: number | null; feedback?: string | null },
    teacherEmail?: string,
  ) {
    const doc = await this.docModel.findById(docId);

    if (!doc) {
      throw new NotFoundException('ไม่พบงานชิ้นนี้');
    }

    const row = (doc.students ?? []).find(
      (s: any) => String(s.student_id) === String(studentId),
    );

    if (!row) {
      throw new NotFoundException('ไม่พบนักศึกษาคนนี้ในงานชิ้นนี้');
    }

    if (data.score !== undefined && data.score !== null) {
      // คะแนนเกินคะแนนเต็มคือกรอกผิด ไม่ใช่ความตั้งใจ
      // ปล่อยผ่านแล้วตัวเลขสรุปทั้งห้องจะเพี้ยนตามไปด้วย
      const max = (doc as any).max_score;

      if (max === null || max === undefined) {
        throw new BadRequestException(
          'งานชิ้นนี้ยังไม่ได้ตั้งคะแนนเต็ม ให้ตั้งก่อนจึงจะให้คะแนนได้',
        );
      }

      if (data.score > max) {
        throw new BadRequestException(
          `คะแนนต้องไม่เกินคะแนนเต็มของงานชิ้นนี้ ซึ่งคือ ${max}`,
        );
      }

      row.score = data.score;
    }

    if (data.score === null) {
      row.score = null as any;
    }

    if (data.feedback !== undefined) {
      row.feedback = data.feedback as any;
    }

    // บันทึกว่าใครให้และให้เมื่อไหร่ เฉพาะตอนที่มีการแก้จริง
    if (data.score !== undefined || data.feedback !== undefined) {
      row.feedback_by = teacherEmail as any;
      row.feedback_at = new Date() as any;
    }

    doc.markModified('students');
    await doc.save();

    return {
      assignment_name: (doc as any).assignment_name,
      max_score: (doc as any).max_score ?? null,
      student: row,
    };
  }

  // ===================================================
  // ✅ คะแนนและ feedback ของนักศึกษาคนที่ login
  // ===================================================
  //
  // คืนเฉพาะแถวของตัวเอง ไม่ใช่ทั้งห้อง
  // นักศึกษาไม่ควรเห็นคะแนนของเพื่อน
  async findMyScores(studentId: string) {
    const docs = await this.docModel
      .find({ 'students.student_id': studentId })
      .populate('classroom')
      .exec();

    return docs.map((doc: any) => {
      const row = (doc.students ?? []).find(
        (s: any) => String(s.student_id) === String(studentId),
      );

      return {
        assignment_id: doc._id,
        assignment_name: doc.assignment_name,
        due_date: doc.due_date ?? null,
        max_score: doc.max_score ?? null,
        status: row?.status ?? 'PENDING',
        score: row?.score ?? null,
        feedback: row?.feedback ?? null,
        feedback_by: row?.feedback_by ?? null,
        feedback_at: row?.feedback_at ?? null,
      };
    });
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