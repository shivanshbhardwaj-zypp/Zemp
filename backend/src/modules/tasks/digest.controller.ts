import { Controller, Get, Headers, Inject, NotFoundException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { DAY_MS, isOpenStatus, toDateTimeInput } from '@zemp/shared';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '../../common/auth.js';
import { CONFIG, type AppConfig } from '../../config/env.js';
import { StoreService, type SeedTask } from '../../data/store.service.js';

interface DigestEmail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Read-only feed for the Google Apps Script that emails deadline digests from a Zypp mailbox:
 * one email per assignee (their overdue / due-within-24h tasks) and one per admin (the same for
 * work they assigned or whose team they own). Protected by DIGEST_SECRET in the
 * `x-digest-secret` header; unset secret = endpoint disabled.
 */
@ApiExcludeController()
@Controller('digest')
export class DigestController {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly store: StoreService,
  ) {}

  @Public()
  @Get('deadlines')
  deadlines(@Headers('x-digest-secret') secret?: string): DigestEmail[] {
    const expected = this.config.DIGEST_SECRET;
    const ok =
      !!expected && !!secret && secret.length === expected.length && timingSafeEqual(Buffer.from(secret), Buffer.from(expected));
    if (!ok) throw new NotFoundException();

    const now = Date.now();
    const tz = this.store.timeZone;
    const flagged = this.store.tasks.filter((t) => isOpenStatus(t.status) && t.dueAt.getTime() - now < DAY_MS);
    const name = (id: string) => this.store.findUser(id)?.name ?? 'Someone';
    const line = (t: SeedTask, withAssignee: boolean) =>
      `- ${t.title}${withAssignee ? ` (${name(t.assigneeId)})` : ''} — ${t.dueAt.getTime() < now ? 'OVERDUE' : 'due'} ${toDateTimeInput(t.dueAt, tz).replace('T', ' ')}`;

    const own = new Map<string, SeedTask[]>();
    const oversee = new Map<string, SeedTask[]>();
    const add = (m: Map<string, SeedTask[]>, id: string, t: SeedTask) => m.set(id, [...(m.get(id) ?? []), t]);
    for (const t of flagged) {
      add(own, t.assigneeId, t);
      const ownerId = t.teamId ? this.store.findTeam(t.teamId)?.ownerId : null;
      for (const adminId of new Set([t.assignorId, ownerId])) {
        if (adminId && adminId !== t.assigneeId) add(oversee, adminId, t);
      }
    }

    const emails: DigestEmail[] = [];
    const push = (userId: string, subject: string, intro: string, lines: string[]) => {
      const user = this.store.findUser(userId);
      if (!user?.isActive) return;
      emails.push({ to: user.email, subject, body: `Hi ${user.name},\n\n${intro}\n\n${lines.join('\n')}\n\n— ZEMP (automated, please don't reply)` });
    };
    for (const [id, tasks] of own) {
      push(id, `ZEMP: ${tasks.length} task(s) overdue or due soon`, 'These tasks of yours are overdue or due within 24 hours:', tasks.map((t) => line(t, false)));
    }
    for (const [id, tasks] of oversee) {
      push(id, `ZEMP: ${tasks.length} team task(s) overdue or due soon`, 'These tasks you assigned or whose team you lead are overdue or due within 24 hours:', tasks.map((t) => line(t, true)));
    }
    return emails;
  }
}
