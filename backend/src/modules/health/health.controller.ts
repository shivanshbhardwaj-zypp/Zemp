import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth.js';
import { StoreService } from '../../data/store.service.js';

/**
 * Liveness answers "is the process up"; readiness answers "can it serve traffic" by checking the
 * dependencies a request actually needs. Orchestrators poll these constantly, so neither is
 * throttled and neither requires a session.
 */
@ApiTags('health')
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly store: StoreService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: 'ok'; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — verifies the data layer answers' })
  ready(): { status: 'ready' | 'degraded'; checks: Record<string, 'ok' | 'failed'> } {
    // Phase C swaps this for a real `SELECT 1` against PostgreSQL.
    let store: 'ok' | 'failed' = 'failed';
    try {
      store = this.store.users.length > 0 ? 'ok' : 'failed';
    } catch {
      store = 'failed';
    }
    const checks = { store };
    const ready = Object.values(checks).every((value) => value === 'ok');
    return { status: ready ? 'ready' : 'degraded', checks };
  }
}
