import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Classroom } from './schemas/classroom.schema';
import { AccountStatus, User, UserRole } from '../user/schema/user.schema';
import { CreateClassroomDto } from './dto/create-classroom.dto';
import { UpdateClassroomDto } from './dto/update-classroom.dto';

@Injectable()
export class ClassroomService {
  constructor(
    @InjectModel(Classroom.name)
    private classroomModel: Model<Classroom>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async create(dto: CreateClassroomDto, userId: string) {
    const classroom = await this.classroomModel.create({
      ...dto,
      createdBy: new Types.ObjectId(userId),
      students: [],
    });

    await this.autoAddStudents(classroom._id.toString());
    return this.findOne(classroom._id.toString());
  }

  async findAll(query?: { major?: string; academicYear?: string; ownerId?: string }) {
    const filter: any = {};
    if (query?.ownerId) {
      filter.createdBy = Types.ObjectId.isValid(query.ownerId)
        ? new Types.ObjectId(query.ownerId)
        : query.ownerId;
    }
    if (query?.major) filter.major = { $regex: query.major, $options: 'i' };
    if (query?.academicYear) filter.academicYear = query.academicYear;

    // หน้าห้องเรียนของครูอ่านจากเส้นนี้ เติมนักศึกษาที่เพิ่งอนุมัติเข้าห้องก่อนคืนค่า
    await this.syncStudentsByMajor(filter);

    return this.classroomModel.find(filter);
  }

  async findOne(id: string) {
    const classroom = await this.classroomModel
      .findById(id)
      .populate('students', '-password');

    if (!classroom) throw new NotFoundException('Classroom not found');
    return classroom;
  }

  // 🔹 Find classroom พร้อม assignments
 async findOneWithAssignments(classroomId: string) {
  const classroom = await this.classroomModel
    .findById(classroomId)
    .populate('students', '-password')
    .populate('assignments') // 🔹 populate virtual
    .exec();

  if (!classroom) throw new NotFoundException('Classroom not found');
  return classroom;
}
  async update(id: string, dto: UpdateClassroomDto) {
    const classroom = await this.classroomModel.findByIdAndUpdate(id, dto, { new: true });
    if (!classroom) throw new NotFoundException('Classroom not found');
    await this.autoAddStudents(id);
    return this.findOne(id);
  }

  async remove(id: string) {
    const deleted = await this.classroomModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Classroom not found');
    return { message: 'Deleted successfully' };
  }

  // เพิ่มนักศึกษาเข้าห้องอัตโนมัติตามสาขาวิชา
  //
  // เดิมเลือกนักศึกษาที่สาขาวิชาและปีการศึกษาตรงกับห้อง
  // แต่ปีการศึกษาถูกเอาออกจากบัญชีนักศึกษาแล้ว (ข้อ 4 ของอาจารย์)
  // จึงไม่มีใครตรงเลย ห้องที่ครูสร้างว่างเปล่าเสมอ นักศึกษาไม่เห็นห้อง
  //
  // ตอนนี้ใช้สาขาวิชาอย่างเดียว และนับเฉพาะบัญชีที่อนุมัติแล้ว
  async autoAddStudents(classroomId: string) {
    const classroom = await this.classroomModel.findById(classroomId);
    if (!classroom) throw new NotFoundException('Classroom not found');

    const before = classroom.students.length;
    await this.syncStudentsByMajor({ _id: classroom._id });
    const after = await this.classroomModel.findById(classroomId);
    const total = after?.students.length ?? before;

    return {
      success: true,
      message: 'Students synced successfully',
      data: {
        classroomId: classroom._id,
        classroomName: classroom.name,
        major: classroom.major,
        academicYear: classroom.academicYear,
        addedStudents: total - before,
        totalStudents: total,
      },
    };
  }

  // เติมนักศึกษาที่สาขาวิชาตรงกันเข้าห้องที่ตรงกับ filter
  //
  // เรียกทุกครั้งที่มีคนเปิดดูห้อง ไม่ใช่แค่ตอนสร้างห้อง
  // นักศึกษาที่ได้รับอนุมัติหลังครูสร้างห้องจึงเข้าห้องเองโดยไม่ต้องมีใครกด
  // ใช้ $addToSet คนที่อยู่แล้วไม่ถูกเพิ่มซ้ำ
  async syncStudentsByMajor(roomFilter: Record<string, unknown> = {}) {
    const rooms = await this.classroomModel
      .find({ ...roomFilter, isActive: { $ne: false } })
      .select('_id major')
      .lean();

    const majors = [...new Set(rooms.map((r: any) => r.major).filter(Boolean))];
    if (majors.length === 0) return;

    const students = await this.userModel
      .find({ role: UserRole.USER, status: AccountStatus.APPROVED, major: { $in: majors } })
      .select('_id major')
      .lean();

    for (const major of majors) {
      const ids = students.filter((s: any) => s.major === major).map((s: any) => s._id);
      if (ids.length === 0) continue;

      await this.classroomModel.updateMany(
        { _id: { $in: rooms.filter((r: any) => r.major === major).map((r: any) => r._id) } },
        { $addToSet: { students: { $each: ids } } },
      );
    }
  }

  async removeStudent(classroomId: string, studentId: string) {
    const classroom = await this.classroomModel.findById(classroomId);
    if (!classroom) throw new NotFoundException('Classroom not found');

    classroom.students = classroom.students.filter(id => id.toString() !== studentId);
    await classroom.save();
    return classroom;
  }

  // ห้องเรียนที่นักศึกษาคนนี้อยู่ พร้อมงานของแต่ละห้อง
  //
  // คืนเฉพาะสิ่งที่นักศึกษาควรเห็น ไม่มีรายชื่อเพื่อนในห้อง
  // และไม่มีคะแนนหรือ feedback ของคนอื่น ซึ่งอยู่ใน students ของเอกสารงาน
  // ของตัวเองใส่ไว้ใน my แทน
  async findMyClassroom(studentId: string) {
    if (!studentId || !Types.ObjectId.isValid(studentId)) {
      return [];
    }

    // ห้องที่เปิดหลังนักศึกษาได้รับอนุมัติ ให้เข้าห้องตอนที่นักศึกษาเปิดดู
    const me: any = await this.userModel.findById(studentId).select('major').lean();
    if (me?.major) {
      await this.syncStudentsByMajor({ major: me.major });
    }

    const rooms: any[] = await this.classroomModel
      .find({ students: new Types.ObjectId(studentId), isActive: { $ne: false } })
      .populate('createdBy', 'name email')
      .populate({
        path: 'assignments',
        select: 'assignment_name publish_date due_date max_score students',
      })
      .sort({ createdAt: -1 })
      .lean();

    return rooms.map((room) => ({
      _id: String(room._id),
      name: room.name,
      major: room.major,
      academicYear: room.academicYear,
      teacher: room.createdBy
        ? { name: room.createdBy.name ?? null, email: room.createdBy.email ?? null }
        : null,
      student_count: (room.students ?? []).length,
      assignments: (room.assignments ?? [])
        .filter(Boolean)
        .map((a: any) => {
          const mine = (a.students ?? []).find(
            (s: any) => String(s.student_id) === String(studentId),
          );

          return {
            _id: String(a._id),
            assignment_name: a.assignment_name,
            publish_date: a.publish_date ?? null,
            due_date: a.due_date ?? null,
            max_score: a.max_score ?? null,
            my: {
              score: mine?.score ?? null,
              feedback: mine?.feedback ?? null,
            },
          };
        }),
    }));
  }

}