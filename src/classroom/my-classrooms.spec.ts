// นักศึกษาเห็นห้องเรียนและงานของตัวเอง แบบเดียวกับที่ครูเห็น
// แต่ต้องไม่เห็นรายชื่อเพื่อน และคะแนนหรือ feedback ของคนอื่น
import { ClassroomService } from './classroom.service';
import { ClassroomController } from './classroom.controller';

const STUDENT = '64b000000000000000000001';
const OTHER = '64b000000000000000000002';

describe('ห้องเรียนของนักศึกษา', () => {
  let find: jest.Mock;
  let service: ClassroomService;

  const room = {
    _id: 'r1',
    name: 'ห้อง A',
    major: 'ครุศาสตร์ไฟฟ้า',
    academicYear: '2569',
    createdBy: { _id: 't1', name: 'Teacher One', email: 't@mail.kmutt.ac.th', password: 'hash' },
    students: [STUDENT, OTHER],
    assignments: [
      {
        _id: 'a1',
        assignment_name: 'งาน 1',
        due_date: '2026-11-13',
        max_score: 10,
        students: [
          { student_id: STUDENT, score: 8, feedback: 'ดี' },
          { student_id: OTHER, score: 3, feedback: 'ของเพื่อน' },
        ],
      },
    ],
  };

  let updateMany: jest.Mock;
  let userFind: jest.Mock;

  beforeEach(() => {
    const chain: any = {
      populate: jest.fn(() => chain),
      sort: jest.fn(() => chain),
      select: jest.fn(() => chain),
      lean: jest.fn().mockResolvedValue([room]),
    };
    find = jest.fn(() => chain);
    updateMany = jest.fn().mockResolvedValue({});

    const leanOf = (v: any) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });
    userFind = jest.fn(() => leanOf([{ _id: STUDENT, major: 'ครุศาสตร์ไฟฟ้า' }]));

    service = new ClassroomService(
      { find, updateMany } as any,
      { find: userFind, findById: () => leanOf({ major: 'ครุศาสตร์ไฟฟ้า' }) } as any,
    );
  });

  it('หาเฉพาะห้องที่นักศึกษาคนนี้อยู่', async () => {
    await service.findMyClassroom(STUDENT);

    const last = find.mock.calls[find.mock.calls.length - 1][0];
    expect(String(last.students)).toBe(STUDENT);
  });

  it('เปิดดูแล้วถูกเพิ่มเข้าห้องของสาขาวิชาตัวเองก่อน', async () => {
    await service.findMyClassroom(STUDENT);

    expect(find.mock.calls[0][0]).toMatchObject({ major: 'ครุศาสตร์ไฟฟ้า' });
    expect(updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['r1'] } },
      { $addToSet: { students: { $each: [STUDENT] } } },
    );
  });

  it('เพิ่มเฉพาะนักศึกษาที่อนุมัติแล้วและสาขาวิชาตรงกัน ไม่ดูปีการศึกษา', async () => {
    await service.syncStudentsByMajor({});

    const filter = userFind.mock.calls[0][0];
    expect(filter).toEqual({
      role: 'USER',
      status: 'APPROVED',
      major: { $in: ['ครุศาสตร์ไฟฟ้า'] },
    });
    expect(filter.academicYear).toBeUndefined();
  });

  it('ไม่มีนักศึกษาสาขานั้น ไม่แตะห้อง', async () => {
    userFind.mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) });

    await service.syncStudentsByMajor({});

    expect(updateMany).not.toHaveBeenCalled();
  });

  it('ไม่ส่งรายชื่อเพื่อนในห้องออกไป ส่งแค่จำนวน', async () => {
    const [r] = await service.findMyClassroom(STUDENT);

    expect((r as any).students).toBeUndefined();
    expect(r.student_count).toBe(2);
  });

  it('ไม่ส่งคะแนนของคนอื่น ส่งแค่ของตัวเองใน my', async () => {
    const [r] = await service.findMyClassroom(STUDENT);
    const a: any = r.assignments[0];

    expect(a.students).toBeUndefined();
    expect(a.my).toEqual({ score: 8, feedback: 'ดี' });
    expect(JSON.stringify(r)).not.toContain('ของเพื่อน');
  });

  it('ข้อมูลครูมีแค่ชื่อและอีเมล', async () => {
    const [r] = await service.findMyClassroom(STUDENT);

    expect(r.teacher).toEqual({ name: 'Teacher One', email: 't@mail.kmutt.ac.th' });
  });

  it('id ที่ไม่ถูกต้องได้รายการว่าง ไม่ใช่สุ่ม ObjectId ใหม่', async () => {
    expect(await service.findMyClassroom(undefined as any)).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });

  it('controller อ่าน id จาก _id ที่ JwtStrategy คืนมา', () => {
    const findMyClassroom = jest.fn();
    const controller = new ClassroomController({ findMyClassroom } as any);

    controller.findMy({ user: { _id: STUDENT } });

    expect(findMyClassroom).toHaveBeenCalledWith(STUDENT);
  });
});
