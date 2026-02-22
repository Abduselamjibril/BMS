import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminActivityLog } from './entities/admin-activity-log.entity';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(AdminActivityLog)
    private readonly auditRepo: Repository<AdminActivityLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    if (method === 'GET') return next.handle();
    const user = request.user;
    const ip = request.ip;
    return next.handle().pipe(
      tap(async (data) => {
        if (!user) return;
        await this.auditRepo.save({
          user_id: user.id,
          action: `${method} ${request.originalUrl}`,
          entity_type: request.route?.path || '',
          entity_id: data?.id || '',
          ip_address: ip,
        });
      }),
    );
  }
}
