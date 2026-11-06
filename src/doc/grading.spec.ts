// ครูต้องให้ feedback และให้คะแนนกลับได้ ไม่ใช่รับงานเฉย ๆ
// ฟิลด์ max_score, score, feedback มีในฐานข้อมูลมานานแล้ว
// แต่ไม่มีเส้นไหนเขียนลงไปได้ ครูจึงให้คะแนนไม่ได้จริง
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { DocService } from './doc.service';
import { DocEntity } from './schema/doc.schema';
import { Classroom } from '../classroom/schemas/classroom.schema';

describe('ให้คะแนนและ feedback', () => {
  let service: DocService;
  let doc: any;
  let classroomStudents: any[];

  const buildDoc = (over: any = {}) => ({
    _id: 'doc1',
    classroom: 'room1',
    assignment_name: 'รายงานสัปดาห์ที่ 1',
    max_score: 10,
    students: [
      { student_id: 'stu1', name: 'A', status: 'PENDING', score: null, feedback: null },
      { student_id: 'stu2', name: 'B', status: 'PENDING', score: null, feedback: null },
    ],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    ...over,
  });

  beforeEach(async () => {
    doc = buildDoc();
    // stu3 อยู่ในห้อง แต่ถูกเพิ่มเข้ามาหลังจากสร้างงานแล้ว
    classroomStudents = [
      { _id: 'stu1', name: 'A' },
      { _id: 'stu2', name: 'B' },
      { _id: 'stu3', name: 'C' },
    ];

    const classroomModel = {
      findById: jest.fn(() => ({
        populate: jest.fn().mockResolvedValue({ _id: 'room1', students: classroomStudents }),
      })),
    };

    const docModel = {
      findById: jest.fn().mockResolvedValue(doc),
      find: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocService,
        { provide: getModelToken(DocEntity.name), useValue: docModel },
        { provide: getModelToken(Classroom.name), useValue: classroomModel },
      ],
    }).compile();

    service = moduleRef.get(DocService);
  });

  it('บันทึกคะแนนลงแถวของนักศึกษาคนนั้น', async () => {
    await service.gradeStudent('doc1', 'stu1', { score: 8 }, 'teacher@mail.kmutt.ac.th');

    expect(doc.students[0].score).toBe(8);
  });

  it('ไม่ไปแตะคะแนนของคนอื่น', async () => {
    await service.gradeStudent('doc1', 'stu1', { score: 8 }, 'teacher@mail.kmutt.ac.th');

    expect(doc.students[1].score).toBeNull();
  });

  it('บันทึกข้อความ feedback', async () => {
    await service.gradeStudent(
      'doc1',
      'stu1',
      { feedback: 'เขียนสรุปได้ดี เพิ่มตัวอย่างอีกหน่อย' },
      'teacher@mail.kmutt.ac.th',
    );

    expect(doc.students[0].feedback).toContain('เขียนสรุปได้ดี');
  });

  it('บันทึกว่าใครเป็นคนให้', async () => {
    await service.gradeStudent('doc1', 'stu1', { score: 5 }, 'teacher@mail.kmutt.ac.th');

    expect(doc.students[0].feedback_by).toBe('teacher@mail.kmutt.ac.th');
    expect(doc.students[0].feedback_at).toBeInstanceOf(Date);
  });

  it('คะแนนเกินคะแนนเต็มไม่ผ่าน', async () => {
    await expect(
      service.gradeStudent('doc1', 'stu1', { score: 11 }, 'teacher@mail.kmutt.ac.th'),
    ).rejects.toThrow(BadRequestException);
  });

  it('คะแนนเท่าคะแนนเต็มพอดีผ่าน', async () => {
    await service.gradeStudent('doc1', 'stu1', { score: 10 }, 'teacher@mail.kmutt.ac.th');

    expect(doc.students[0].score).toBe(10);
  });

  it('งานที่ยังไม่ตั้งคะแนนเต็ม ให้คะแนนไม่ได้ และบอกให้ไปตั้งก่อน', async () => {
    doc.max_score = null;

    await expect(
      service.gradeStudent('doc1', 'stu1', { score: 5 }, 'teacher@mail.kmutt.ac.th'),
    ).rejects.toThrow(/ยังไม่ได้ตั้งคะแนนเต็ม/);
  });

  it('งานที่ยังไม่ตั้งคะแนนเต็ม ยังเขียน feedback ได้', async () => {
    doc.max_score = null;

    await service.gradeStudent('doc1', 'stu1', { feedback: 'ดีมาก' }, 'teacher@mail.kmutt.ac.th');

    expect(doc.students[0].feedback).toBe('ดีมาก');
  });

  it('ไม่มีนักศึกษาคนนั้นในงาน ต้องบอกให้ชัด', async () => {
    await expect(
      service.gradeStudent('doc1', 'ไม่มีคนนี้', { score: 5 }, 'teacher@mail.kmutt.ac.th'),
    ).rejects.toThrow(NotFoundException);
  });

  it('นักศึกษาที่เข้าห้องหลังสร้างงาน ให้คะแนนได้ และถูกเพิ่มแถวในงาน', async () => {
    await service.gradeStudent('doc1', 'stu3', { score: 9 }, 'teacher@mail.kmutt.ac.th');

    expect(doc.students).toHaveLength(3);
    expect(doc.students[2]).toMatchObject({ student_id: 'stu3', name: 'C', score: 9 });
    expect(doc.save).toHaveBeenCalled();
  });

  it('คนที่ไม่ได้อยู่ในห้อง ไม่ถูกเพิ่มเข้างาน', async () => {
    await expect(
      service.gradeStudent('doc1', 'stu9', { score: 5 }, 'teacher@mail.kmutt.ac.th'),
    ).rejects.toThrow(NotFoundException);

    expect(doc.students).toHaveLength(2);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('ส่ง score เป็น null คือลบคะแนนเดิมทิ้ง', async () => {
    doc.students[0].score = 7;

    await service.gradeStudent('doc1', 'stu1', { score: null }, 'teacher@mail.kmutt.ac.th');

    expect(doc.students[0].score).toBeNull();
  });

  it('สั่ง markModified เพื่อให้ mongoose บันทึกอาเรย์จริง', async () => {
    await service.gradeStudent('doc1', 'stu1', { score: 5 }, 'teacher@mail.kmutt.ac.th');

    expect(doc.markModified).toHaveBeenCalledWith('students');
    expect(doc.save).toHaveBeenCalled();
  });
});
