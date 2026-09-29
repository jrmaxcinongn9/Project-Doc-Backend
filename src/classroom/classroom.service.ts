import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Classroom } from './schemas/classroom.schema';
import { User, UserRole } from '../user/schema/user.schema';
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

  async findAll(query?: { major?: string; academicYear?: string }) {
    const filter: any = {};
    if (query?.major) filter.major = { $regex: query.major, $options: 'i' };
    if (query?.academicYear) filter.academicYear = query.academicYear;
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

  async autoAddStudents(classroomId: string) {
    const classroom = await this.classroomModel.findById(classroomId);
    if (!classroom) throw new NotFoundException('Classroom not found');

    const students = await this.userModel.find({
      role: UserRole.USER,
      major: classroom.major,
      academicYear: classroom.academicYear,
    });

    const existingIds = classroom.students.map(id => id.toString());
    const newStudents = students.filter(s => !existingIds.includes(s._id.toString()));

    classroom.students.push(...newStudents.map(s => s._id));
    await classroom.save();

    return {
      success: true,
      message: 'Students synced successfully',
      data: {
        classroomId: classroom._id,
        classroomName: classroom.name,
        major: classroom.major,
        academicYear: classroom.academicYear,
        matchedStudents: students.length,
        addedStudents: newStudents.length,
        totalStudents: classroom.students.length,
      },
    };
  }

  async removeStudent(classroomId: string, studentId: string) {
    const classroom = await this.classroomModel.findById(classroomId);
    if (!classroom) throw new NotFoundException('Classroom not found');

    classroom.students = classroom.students.filter(id => id.toString() !== studentId);
    await classroom.save();
    return classroom;
  }

  async findMyClassroom(studentId: string) {
    return this.classroomModel
      .find({ students: new Types.ObjectId(studentId) })
      .populate('students', '-password');
  }
}