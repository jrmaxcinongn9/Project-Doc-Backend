import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDTO } from './user/dto/register.dto';
import { RegisterTeacherDTO } from './teacher/dto/register-teacher';
import { RegisterAdminDTO } from './admin/dto/register-admin.dto';

const emailErrors = (cls: any, email: string) => {
  const base =
    cls === RegisterDTO
      ? { name: 'Somchai Jai', password: 'secret1', academicYear: 2569, major: 'CPE', student_id: '65130500001' }
      : { name: 'Somchai Jai', password: 'secret1' };
  const errs = validateSync(plainToInstance(cls, { ...base, email }), { whitelist: true });
  return errs.filter(e => e.property === 'email');
};

const good = ['65130500001@mail.kmutt.ac.th', 'Somchai@MAIL.KMUTT.AC.TH'];
const bad = ['somchai@gmail.com', 'somchai@kmutt.ac.th', 'a@mail.kmutt.ac.th.evil.com'];

for (const [label, cls] of [['USER', RegisterDTO], ['TEACHER', RegisterTeacherDTO], ['ADMIN', RegisterAdminDTO]] as const) {
  describe(label, () => {
    for (const e of good) it(`accepts ${e}`, () => expect(emailErrors(cls, e)).toHaveLength(0));
    for (const e of bad) it(`rejects ${e}`, () => expect(emailErrors(cls, e).length).toBeGreaterThan(0));
  });
}
