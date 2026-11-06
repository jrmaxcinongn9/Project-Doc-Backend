// ครูแก้ได้เฉพาะห้องและงานของตัวเอง admin แก้ได้ทุกอย่าง
import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

import { assertOwnsAssignment, assertOwnsRoom, ownsAssignment, ownsRoom } from './ownership';
import { ClassroomController } from '../classroom/classroom.controller';
import { DocController } from '../doc/doc.controller';
import { FileController } from '../file/file.controller';

const ME = '64b000000000000000000001';
const OTHER = '64b000000000000000000002';

const teacher = { _id: ME, role: 'TEACHER' };
const admin = { _id: OTHER, role: 'ADMIN' };

const myRoom = { _id: 'r1', createdBy: new Types.ObjectId(ME) };
const otherRoom = { _id: 'r2', createdBy: OTHER };

describe('ครูแก้ได้เฉพาะของตัวเอง', () => {
  it('เจ้าของห้องผ่าน ห้องคนอื่นไม่ผ่าน', () => {
    expect(ownsRoom(teacher, myRoom)).toBe(true);
    expect(ownsRoom(teacher, otherRoom)).toBe(false);
  });

  it('ห้องที่ populate createdBy มาเป็น object ก็เทียบได้', () => {
    expect(ownsRoom(teacher, { createdBy: { _id: ME, name: 'x' } })).toBe(true);
  });

  it('admin ผ่านทุกห้อง', () => {
    expect(ownsRoom(admin, otherRoom)).toBe(true);
  });

  it('งานในห้องตัวเองผ่าน แม้ admin เป็นคนสร้างงาน', () => {
    expect(ownsAssignment(teacher, { user_id: OTHER, classroom: myRoom })).toBe(true);
  });

  it('งานที่ตัวเองสร้างผ่าน', () => {
    expect(ownsAssignment(teacher, { user_id: ME, classroom: otherRoom })).toBe(true);
  });

  it('งานของครูคนอื่นในห้องคนอื่นไม่ผ่าน', () => {
    expect(() => assertOwnsAssignment(teacher, { user_id: OTHER, classroom: otherRoom })).toThrow(
      ForbiddenException,
    );
  });

  it('ไม่มี id ใน token ไม่ผ่าน', () => {
    expect(() => assertOwnsRoom({ role: 'TEACHER' }, myRoom)).toThrow(ForbiddenException);
  });
});

describe('เส้นที่แก้ข้อมูลตรวจเจ้าของจริง', () => {
  it('แก้ห้องของคนอื่นไม่ได้ และไม่แตะข้อมูล', async () => {
    const update = jest.fn();
    const c = new ClassroomController({ findOne: jest.fn().mockResolvedValue(otherRoom), update } as any);

    await expect(c.update('r2', {} as any, { user: teacher })).rejects.toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('ลบห้องของคนอื่นไม่ได้', async () => {
    const remove = jest.fn();
    const c = new ClassroomController({ findOne: jest.fn().mockResolvedValue(otherRoom), remove } as any);

    await expect(c.remove('r2', { user: teacher })).rejects.toThrow(ForbiddenException);
    expect(remove).not.toHaveBeenCalled();
  });

  it('ห้องตัวเองแก้ได้', async () => {
    const update = jest.fn().mockResolvedValue('ok');
    const c = new ClassroomController({ findOne: jest.fn().mockResolvedValue(myRoom), update } as any);

    await expect(c.update('r1', {} as any, { user: teacher })).resolves.toBe('ok');
  });

  it('สร้างงานในห้องคนอื่นไม่ได้', async () => {
    const create = jest.fn();
    const c = new DocController({ findClassroom: jest.fn().mockResolvedValue(otherRoom), create } as any);

    await expect(c.create({ classroom: 'r2' } as any, { user: teacher })).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('ให้คะแนนงานในห้องคนอื่นไม่ได้', async () => {
    const gradeStudent = jest.fn();
    const c = new DocController({
      findOneById: jest.fn().mockResolvedValue({ user_id: OTHER, classroom: otherRoom }),
      gradeStudent,
    } as any);

    await expect(c.gradeStudent('a1', 's1', { score: 5 } as any, { user: teacher })).rejects.toThrow(
      ForbiddenException,
    );
    expect(gradeStudent).not.toHaveBeenCalled();
  });

  it('แก้หรือลบงานในห้องคนอื่นไม่ได้', async () => {
    const svc = {
      findOneById: jest.fn().mockResolvedValue({ user_id: OTHER, classroom: otherRoom }),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const c = new DocController(svc as any);

    await expect(c.update('a1', {}, { user: teacher })).rejects.toThrow(ForbiddenException);
    await expect(c.delete('a1', { user: teacher })).rejects.toThrow(ForbiddenException);
    expect(svc.update).not.toHaveBeenCalled();
    expect(svc.delete).not.toHaveBeenCalled();
  });

  it('ครูลบไฟล์นักศึกษาในห้องคนอื่นไม่ได้ แต่ห้องตัวเองได้', async () => {
    const fileService = {
      findOne: jest.fn().mockResolvedValue({ uploaded_by_id: 'stu', assignment_id: '64b0000000000000000000aa' }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    const docService = { findOneById: jest.fn().mockResolvedValue({ user_id: OTHER, classroom: otherRoom }) };
    const c = new FileController(fileService as any, docService as any);

    await expect(c.removeFile('f1', { user: teacher } as any)).rejects.toThrow(ForbiddenException);
    expect(fileService.remove).not.toHaveBeenCalled();

    docService.findOneById.mockResolvedValue({ user_id: OTHER, classroom: myRoom });
    await expect(c.removeFile('f1', { user: teacher } as any)).resolves.toEqual({ message: 'ok' });
  });

  it('นักศึกษาลบไฟล์ของตัวเองได้เหมือนเดิม', async () => {
    const fileService = {
      findOne: jest.fn().mockResolvedValue({ uploaded_by_id: ME }),
      remove: jest.fn().mockResolvedValue({ message: 'ok' }),
    };
    const c = new FileController(fileService as any, {} as any);

    await expect(c.removeFile('f1', { user: { _id: ME, role: 'USER' } } as any)).resolves.toEqual({ message: 'ok' });
  });
});
