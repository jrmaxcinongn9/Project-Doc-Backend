// สาขาที่ใช้จับคู่ครูกับนักเรียน
// ครูเลือกเป็นความเชี่ยวชาญ นักเรียนเลือกตามสถานประกอบการที่ไปฝึก
export enum Category {
  SOFTWARE = 'SOFTWARE',
  NETWORK = 'NETWORK',
  DATA = 'DATA',
  HARDWARE = 'HARDWARE',
  DESIGN = 'DESIGN',
  BUSINESS = 'BUSINESS',
  OTHER = 'OTHER',
}

export const CATEGORY_VALUES = Object.values(Category);
