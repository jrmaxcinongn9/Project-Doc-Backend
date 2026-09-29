import { Test, TestingModule } from '@nestjs/testing';
import { Backproject15Service } from './backproject1_5.service';

describe('Backproject15Service', () => {
  let service: Backproject15Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Backproject15Service],
    }).compile();

    service = module.get<Backproject15Service>(Backproject15Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
