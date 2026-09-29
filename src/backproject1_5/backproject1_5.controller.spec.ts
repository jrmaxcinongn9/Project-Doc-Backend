import { Test, TestingModule } from '@nestjs/testing';
import { Backproject15Controller } from './backproject1_5.controller';
import { Backproject15Service } from './backproject1_5.service';

describe('Backproject15Controller', () => {
  let controller: Backproject15Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Backproject15Controller],
      providers: [Backproject15Service],
    }).compile();

    controller = module.get<Backproject15Controller>(Backproject15Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
