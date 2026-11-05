// นักศึกษาต้องดูคะแนนและ feedback ของตัวเองได้
// แต่ต้องเห็นเฉพาะของตัวเอง ไม่ใช่ทั้งห้อง
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

import { DocService } from './doc.service';
import { DocEntity } from './schema/doc.schema';
import { Classroom } from '../classroom/schemas/classroom.schema';

describe('คะแนนของนักศึกษาคนที่ login', () => {
  let service: DocService;
  let lastFilter: any;

  const docs = [
    {
      _id: 'doc1',
      assignment_name: 'รายงานสัปดาห์ที่ 1',
      due_date: null,
      max_score: 10,
      students: [
        {
          student_id: 'stu1',
          status: 'SUBMITTED',
          score: 8,
          feedback: 'ทำได้ดี',
          feedback_by: 'teacher@mail.kmutt.ac.th',
          feedback_at: null,
        },
        { student_id: 'stu2', status: 'PENDING', score: 3, feedback: 'ขาดบทสรุป' },
      ],
    },
    {
      _id: 'doc2',
      assignment_name: 'รายงานสัปดาห์ที่ 2',
      max_score: null,
      students: [{ student_id: 'stu1', status: 'PENDING' }],
    },
  ];

  beforeEach(async () => {
    lastFilter = undefined;

    const docModel = {
      findById: jest.fn(),
      find: jest.fn((filter: any) => {
        lastFilter = filter;
        return { populate: () => ({ exec: () => Promise.resolve(docs) }) };
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocService,
        { provide: getModelToken(DocEntity.name), useValue: docModel },
        { provide: getModelToken(Classroom.name), useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(DocService);
  });

  it('ถามฐานข้อมูลเฉพาะงานที่มีชื่อเราอยู่', async () => {
    await service.findMyScores('stu1');

    expect(lastFilter).toEqual({ 'students.student_id': 'stu1' });
  });

  it('คืนคะแนนของตัวเอง', async () => {
    const result = await service.findMyScores('stu1');

    expect(result[0].score).toBe(8);
    expect(result[0].max_score).toBe(10);
  });

  it('คืน feedback ของตัวเอง', async () => {
    const result = await service.findMyScores('stu1');

    expect(result[0].feedback).toBe('ทำได้ดี');
    expect(result[0].feedback_by).toBe('teacher@mail.kmutt.ac.th');
  });

  it('ไม่มีคะแนนของเพื่อนปนออกมา', async () => {
    const result = await service.findMyScores('stu1');

    expect(JSON.stringify(result)).not.toContain('ขาดบทสรุป');
    expect(JSON.stringify(result)).not.toContain('stu2');
  });

  it('งานที่ยังไม่ได้ตรวจ คืนค่าว่างไม่ใช่พัง', async () => {
    const result = await service.findMyScores('stu1');

    expect(result[1].score).toBeNull();
    expect(result[1].feedback).toBeNull();
    expect(result[1].max_score).toBeNull();
  });

  it('มีชื่องานติดมาด้วย ไม่ใช่แค่ตัวเลข', async () => {
    const result = await service.findMyScores('stu1');

    expect(result[0].assignment_name).toBe('รายงานสัปดาห์ที่ 1');
  });

  it('คืนครบทุกงานที่มีชื่อเรา', async () => {
    const result = await service.findMyScores('stu1');

    expect(result).toHaveLength(2);
  });
});
