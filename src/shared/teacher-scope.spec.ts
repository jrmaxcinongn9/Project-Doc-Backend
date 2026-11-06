// ครูแต่ละคนดูได้เฉพาะห้อง งาน ไฟล์ และนักศึกษาของตัวเอง admin ดูได้ทั้งหมด
import { ForbiddenException } from '@nestjs/common';

import { ClassroomController } from '../classroom/classroom.controller';
import { DocController } from '../doc/doc.controller';
import { FileController } from '../file/file.controller';
import { UserController } from '../user/user.controller';

const ME = '64b000000000000000000001';
const OTHER = '64b000000000000000000002';
const teacher = { _id: ME, role: 'TEACHER' };
const admin = { _id: OTHER, role: 'ADMIN' };

describe('ครูดูได้เฉพาะของตัวเอง', () => {
  it('รายการห้องกรองด้วยผู้สร้าง', async () => {
    const findAll = jest.fn().mockResolvedValue([]);
    const c = new ClassroomController({ findAll } as any);

    await c.findAll(undefined, undefined, { user: teacher });
    expect(findAll.mock.calls[0][0].ownerId).toBe(ME);

    await c.findAll(undefined, undefined, { user: admin });
    expect(findAll.mock.calls[1][0].ownerId).toBeUndefined();
  });

  it('เปิดห้องของคนอื่นไม่ได้', async () => {
    const c = new ClassroomController({ findOne: jest.fn().mockResolvedValue({ createdBy: OTHER }) } as any);

    await expect(c.findOne('r2', { user: teacher })).rejects.toThrow(ForbiddenException);
  });

  it('รายการงานเป็นของห้องตัวเอง admin ได้ทั้งหมด', async () => {
    const svc = { findAll: jest.fn().mockResolvedValue(['all']), findForTeacher: jest.fn().mockResolvedValue(['mine']) };
    const c = new DocController(svc as any);

    expect(await c.findAll({ user: teacher })).toEqual(['mine']);
    expect(svc.findForTeacher).toHaveBeenCalledWith(ME);
    expect(await c.findAll({ user: admin })).toEqual(['all']);
  });

  it('รายการไฟล์เฉพาะงานของห้องตัวเอง', async () => {
    const fileService = { findAll: jest.fn(), findByAssignmentIds: jest.fn().mockResolvedValue(['mine']) };
    const docService = { teacherAssignmentIds: jest.fn().mockResolvedValue(['a1']) };
    const c = new FileController(fileService as any, docService as any);

    expect(await c.findAll({ user: teacher } as any)).toEqual(['mine']);
    expect(fileService.findByAssignmentIds).toHaveBeenCalledWith(['a1']);
    expect(fileService.findAll).not.toHaveBeenCalled();
  });

  it('ดาวน์โหลดไฟล์ของงานห้องคนอื่นไม่ได้', async () => {
    const fileService = {
      findOne: jest.fn().mockResolvedValue({ uploaded_by_id: 'stu', assignment_id: '64b0000000000000000000aa' }),
      downloadFile: jest.fn(),
    };
    const docService = { findOneById: jest.fn().mockResolvedValue({ user_id: OTHER, classroom: { createdBy: OTHER } }) };
    const c = new FileController(fileService as any, docService as any);

    await expect(c.downloadFile('f1', '1', {} as any, { user: teacher } as any)).rejects.toThrow(ForbiddenException);
    expect(fileService.downloadFile).not.toHaveBeenCalled();
  });

  it('รายชื่อผู้ใช้ของครูมาจากเส้นที่กรองแล้ว', async () => {
    const userService = { findAll: jest.fn(), findVisibleToTeacher: jest.fn().mockResolvedValue([]) };
    const c = new UserController(userService as any, { get: () => undefined } as any);

    await c.findAll({ user: teacher });
    expect(userService.findVisibleToTeacher).toHaveBeenCalledWith(ME);
    expect(userService.findAll).not.toHaveBeenCalled();
  });
});
