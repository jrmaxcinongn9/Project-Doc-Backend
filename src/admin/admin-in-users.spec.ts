import { ForbiddenException } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AccountStatus, UserRole } from '../user/schema/user.schema';

/**
 * admin เคยถูกเก็บใน collection ของตัวเอง ซึ่งไม่มีเส้น login ไหนอ่าน
 * บัญชีที่สร้างไว้จึงเข้าระบบไม่ได้เลย เทสต์ชุดนี้ยึดไว้ว่า admin ต้องอยู่ใน users
 * และเส้นสร้าง admin ต้องไม่เปิดทิ้งไว้ให้คนนอกหลังมีผู้ดูแลคนแรกแล้ว
 */
describe('admin อยู่ใน users', () => {
  describe('การสร้าง', () => {
    let userService: any;
    let service: AdminService;

    beforeEach(() => {
      userService = {
        create: jest.fn().mockResolvedValue({ role: UserRole.ADMIN }),
        findByRole: jest.fn().mockResolvedValue([]),
      };
      service = new AdminService({} as any, userService);
    });

    it('สร้างลง users ด้วย role ADMIN', async () => {
      await service.create({
        name: 'Admin',
        email: 'a@mail.kmutt.ac.th',
        password: 'secret1',
      });

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'a@mail.kmutt.ac.th',
          role: UserRole.ADMIN,
        }),
      );
    });

    it('admin ผ่านด่านยืนยันอีเมลและด่านอนุมัติตั้งแต่สร้าง', async () => {
      await service.create({
        name: 'Admin',
        email: 'a@mail.kmutt.ac.th',
        password: 'secret1',
      });

      expect(userService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerified: true,
          status: AccountStatus.APPROVED,
        }),
      );
    });

    it('ไม่ส่งรหัสผ่านที่ hash เองไปซ้ำ ปล่อยให้ schema จัดการ', async () => {
      await service.create({
        name: 'Admin',
        email: 'a@mail.kmutt.ac.th',
        password: 'secret1',
      });

      const passed = userService.create.mock.calls[0][0];
      expect(passed.password).toBe('secret1');
    });
  });

  describe('สิทธิ์ในการสร้าง admin', () => {
    function controllerWith(hasAdmin: boolean) {
      const service = {
        hasAnyAdmin: jest.fn().mockResolvedValue(hasAdmin),
        create: jest.fn().mockResolvedValue({ role: UserRole.ADMIN }),
      } as any;

      return { controller: new AdminController(service), service };
    }

    const body = {
      name: 'Admin',
      email: 'a@mail.kmutt.ac.th',
      password: 'secret1',
    };

    it('ยังไม่มี admin เลย คนที่ยังไม่ login สร้างคนแรกได้', async () => {
      const { controller, service } = controllerWith(false);

      await controller.create(body, {} as any);

      expect(service.create).toHaveBeenCalled();
    });

    it('มี admin แล้ว คนที่ยังไม่ login สร้างไม่ได้', async () => {
      const { controller, service } = controllerWith(true);

      await expect(controller.create(body, {} as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it('มี admin แล้ว คนที่ login ด้วย role อื่นก็สร้างไม่ได้', async () => {
      const { controller, service } = controllerWith(true);

      await expect(
        controller.create(body, { user: { role: UserRole.USER } } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('มี admin แล้ว admin ที่ login อยู่สร้างเพิ่มได้', async () => {
      const { controller, service } = controllerWith(true);

      await controller.create(body, {
        user: { role: UserRole.ADMIN },
      } as any);

      expect(service.create).toHaveBeenCalled();
    });
  });
});
