import {
  Injectable,
  NestMiddleware,
  Inject,
  LoggerService,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService, // ✅ FIX ตรงนี้
  ) {}

  use(req: Request, res: Response, next: NextFunction) {

    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      // ✅ ใช้ log() แทน info()
      this.logger.log({
        type: 'REQUEST',
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ip: req.ip,
        duration: `${duration}ms`,
        user: (req as any).user?.userId || 'guest',
      });
    });

    next();
  }
}