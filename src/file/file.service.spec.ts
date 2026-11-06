// ไฟล์ที่อัปโหลดต้องไม่อยู่บนดิสก์ของ Render ซึ่งถูกล้างทุกครั้งที่ deploy
// FileService ส่งตัวไฟล์ให้ FileStorageService (GridFS) และอ่านกลับจากที่นั่น
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Readable } from 'stream';

import { FileService, isPreviewable } from './file.service';
import { FileStorageService } from './file-storage.service';
import { FileEntity } from './schema/file.schema';

describe('FileService เก็บไฟล์ใน GridFS', () => {
  let service: FileService;
  let storage: Record<string, jest.Mock>;
  let saved: any[];
  let records: Record<string, any>;

  const upload = (over: Partial<Express.Multer.File> = {}) =>
    ({
      originalname: 'รายงาน.pdf',
      mimetype: 'application/pdf',
      size: 4,
      buffer: Buffer.from('%PDF'),
      ...over,
    }) as Express.Multer.File;

  const uploader = { userId: 'u1', email: 's@mail.kmutt.ac.th', assignmentId: 'a1' };

  beforeEach(async () => {
    saved = [];
    records = {};

    storage = {
      save: jest.fn().mockResolvedValue('64b000000000000000000001'),
      exists: jest.fn().mockResolvedValue(true),
      open: jest.fn().mockImplementation(async () => Readable.from(['data'])),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    // จำลอง mongoose model พอให้ new, save, findById, deleteOne ทำงาน
    function FileModel(this: any, data: any) {
      Object.assign(this, data);
      this.save = jest.fn(async () => {
        saved.push(this);
        return this;
      });
    }
    (FileModel as any).findById = jest.fn((id: string) => {
      const q: any = Promise.resolve(records[id] ?? null);
      q.exec = () => Promise.resolve(records[id] ?? null);
      return q;
    });
    (FileModel as any).deleteOne = jest.fn(() => ({ exec: () => Promise.resolve({}) }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: getModelToken(FileEntity.name), useValue: FileModel },
        { provide: FileStorageService, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(FileService);
  });

  it('เขียนตัวไฟล์ลง GridFS ไม่ใช่ดิสก์', async () => {
    const file = upload();
    await service.create(file, uploader);

    expect(storage.save).toHaveBeenCalledWith(
      file.buffer,
      expect.stringMatching(/^u1-\d+-\d+\.pdf$/),
      expect.objectContaining({ original_name: 'รายงาน.pdf' }),
    );
  });

  it('record เก็บ id ของ GridFS ไว้อ่านกลับ', async () => {
    await service.create(upload(), uploader);

    expect(saved[0].gridfs_id).toBe('64b000000000000000000001');
    expect(saved[0].file_path).toBe('gridfs:64b000000000000000000001');
    expect(saved[0].original_name).toBe('รายงาน.pdf');
  });

  it('บันทึก record ไม่ได้ ต้องลบไฟล์ใน GridFS ทิ้ง ไม่ทิ้งไฟล์กำพร้า', async () => {
    const FileModel: any = (service as any).fileModel;
    const original = FileModel.prototype;
    (service as any).fileModel = function (this: any, data: any) {
      Object.assign(this, data);
      this.save = jest.fn().mockRejectedValue(new Error('duplicate'));
    };
    (service as any).fileModel.prototype = original;

    await expect(service.create(upload(), uploader)).rejects.toThrow('duplicate');
    expect(storage.remove).toHaveBeenCalledWith({ gridfs_id: '64b000000000000000000001' });
  });

  it('ลบไฟล์แล้วลบตัวไฟล์ใน GridFS ด้วย', async () => {
    records.f1 = { _id: 'f1', uploaded_by_id: 'u1', gridfs_id: 'g1' };

    await service.remove('f1', 'u1', 'USER');

    expect(storage.remove).toHaveBeenCalledWith(records.f1);
  });

  it('คนอื่นลบไฟล์ของนักศึกษาไม่ได้', async () => {
    records.f1 = { _id: 'f1', uploaded_by_id: 'u1', gridfs_id: 'g1' };

    await expect(service.remove('f1', 'u2', 'USER')).rejects.toThrow(ForbiddenException);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('ดาวน์โหลดอ่านจาก storage และตั้งชื่อไฟล์เดิม', async () => {
    records.f1 = {
      _id: 'f1',
      uploaded_by_id: 'u1',
      gridfs_id: 'g1',
      original_name: 'รายงาน.pdf',
      mimetype: 'application/pdf',
    };
    const res: any = {
      attachment: jest.fn(),
      type: jest.fn(),
      getHeader: jest.fn(),
      setHeader: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      removeListener: jest.fn(),
    };

    await service.downloadFile('f1', 'teacher', 'TEACHER', res);

    expect(storage.open).toHaveBeenCalledWith(records.f1);
    expect(res.attachment).toHaveBeenCalledWith('รายงาน.pdf');
    expect(res.type).toHaveBeenCalledWith('application/pdf');
  });

  it('นักศึกษาดาวน์โหลดไฟล์ของคนอื่นไม่ได้', async () => {
    records.f1 = { _id: 'f1', uploaded_by_id: 'u1', gridfs_id: 'g1' };

    await expect(service.downloadFile('f1', 'u2', 'USER', {} as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(storage.open).not.toHaveBeenCalled();
  });

  it('ไฟล์หายไปแล้ว ตอบ 404', async () => {
    records.f1 = { _id: 'f1', uploaded_by_id: 'u1', file_path: '/gone' };
    storage.open.mockRejectedValue(new NotFoundException('ไฟล์ไม่พบหรือถูกลบไปแล้ว'));

    await expect(service.downloadFile('f1', 'u1', 'USER', {} as any)).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('เปิดดูไฟล์ในเบราว์เซอร์', () => {
    const fakeRes = () => {
      const headers: Record<string, string> = {};
      return {
        headers,
        attachment: jest.fn((name: string) => {
          headers['Content-Disposition'] = `attachment; filename="${name}"`;
        }),
        type: jest.fn(),
        getHeader: (k: string) => headers[k],
        setHeader: jest.fn((k: string, v: string) => {
          headers[k] = v;
        }),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        removeListener: jest.fn(),
      } as any;
    };

    const fileOf = (mimetype: string) => ({
      _id: 'f1',
      uploaded_by_id: 'u1',
      gridfs_id: 'g1',
      original_name: 'งาน',
      mimetype,
    });

    it('PDF เปิดแบบ inline ได้', async () => {
      records.f1 = fileOf('application/pdf');
      const res = fakeRes();

      await service.downloadFile('f1', 't', 'TEACHER', res, true);

      expect(res.headers['Content-Disposition']).toMatch(/^inline/);
    });

    it('HTML ไม่เปิดแบบ inline เพราะรันสคริปต์ได้ ยังเป็นดาวน์โหลด', async () => {
      records.f1 = fileOf('text/html');
      const res = fakeRes();

      await service.downloadFile('f1', 't', 'TEACHER', res, true);

      expect(res.headers['Content-Disposition']).toMatch(/^attachment/);
    });

    it('ไม่ขอ inline ก็ยังเป็นดาวน์โหลดเหมือนเดิม', async () => {
      records.f1 = fileOf('application/pdf');
      const res = fakeRes();

      await service.downloadFile('f1', 't', 'TEACHER', res);

      expect(res.headers['Content-Disposition']).toMatch(/^attachment/);
    });

    it('ใส่ nosniff ทุกครั้ง กันเบราว์เซอร์เดาชนิดไฟล์เอง', async () => {
      records.f1 = fileOf('application/pdf');
      const res = fakeRes();

      await service.downloadFile('f1', 't', 'TEACHER', res, true);

      expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('SVG ไม่นับเป็นชนิดที่เปิดดูได้', () => {
      expect(isPreviewable('image/svg+xml')).toBe(false);
      expect(isPreviewable('image/png')).toBe(true);
    });
  });
});
