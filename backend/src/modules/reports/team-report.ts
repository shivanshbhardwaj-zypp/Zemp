import ExcelJS from 'exceljs';
import type { StoreService, SeedTeam, SeedTask, SeedUser } from '../../data/store.service.js';

export const TEAM_REPORT_DAYS = 30;

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0432B' } };
const STRIPE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF4F2' } };
const LINE = { style: 'thin' as const, color: { argb: 'FFD9D4D6' } };
const BORDER: Partial<ExcelJS.Borders> = { top: LINE, left: LINE, bottom: LINE, right: LINE };
const URL = /https?:\/\/[^\s<>"')\]]+/g;

/** Seed/demo accounts (e.g. test@example.com) are not real staff and never appear in reports. */
export const isTestAccount = (u: Pick<SeedUser, 'name' | 'email'> | undefined) =>
  !!u && (/test/i.test(`${u.name} ${u.email}`) || u.email.toLowerCase().endsWith('example.com'));

const nice = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

type Col = { header: string; width: number; wrap?: boolean; center?: boolean };

const TASK_COLUMNS: Col[] = [
  { header: 'Task Label', width: 11, center: true },
  { header: 'Employee', width: 20 },
  { header: 'Task Heading', width: 34, wrap: true },
  { header: 'Description', width: 45, wrap: true },
  { header: 'Task Status', width: 13, center: true },
  { header: 'Progress %', width: 11, center: true },
  { header: 'Priority', width: 10, center: true },
  { header: 'Uploaded Date', width: 14, center: true },
  { header: 'Uploaded Day', width: 13, center: true },
  { header: 'Uploaded Time', width: 12, center: true },
  { header: 'Due Date', width: 14, center: true },
  { header: 'Due Day', width: 13, center: true },
  { header: 'Completed Date', width: 15, center: true },
  { header: 'Completed Day', width: 14, center: true },
  { header: 'Completed Time', width: 14, center: true },
  { header: 'Assigned By', width: 18 },
  { header: 'Origin', width: 13, center: true },
  { header: 'Work Note / What They Did', width: 40, wrap: true },
  { header: 'Evidence Link', width: 36, wrap: true },
  { header: 'All Links Found', width: 42, wrap: true },
  { header: 'Review Status', width: 16, center: true },
  { header: 'Reviewer', width: 20 },
  { header: 'Reviewed On', width: 26, center: true },
  { header: 'Review Note', width: 30, wrap: true },
  { header: 'Comments', width: 50, wrap: true },
  { header: 'Activity History', width: 60, wrap: true },
];

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: Col[], freeze: number) {
  const sheet = workbook.addWorksheet(name.replace(/[*?:\\/[\]]/g, ' ').slice(0, 31), {
    views: [{ state: 'frozen', xSplit: freeze, ySplit: 1 }],
  });
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width }));
  const head = sheet.getRow(1);
  head.height = 32;
  head.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER;
  });
  return sheet;
}

function styleRow(row: ExcelJS.Row, columns: Col[], striped: boolean, tall: boolean) {
  columns.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.border = BORDER;
    cell.alignment = {
      horizontal: c.center ? 'center' : 'left',
      vertical: tall ? 'top' : 'middle',
      wrapText: !!c.wrap,
    };
    if (striped) cell.fill = STRIPE_FILL;
  });
}

/**
 * The team's detailed work report for the last 30 days: Summary, All Tasks, one sheet per
 * employee, and Logins. Times are in the organization's time zone. Test accounts are excluded as
 * people, and unfinished tasks they assigned are excluded as test entries.
 */
export async function buildTeamReport(store: StoreService, team: SeedTeam, now: Date): Promise<ExcelJS.Buffer> {
  const tz = store.timeZone;
  const from = new Date(now.getTime() - TEAM_REPORT_DAYS * 24 * 60 * 60 * 1000);
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts });
  const dateF = fmt({ day: '2-digit', month: 'short', year: 'numeric' });
  const dayF = fmt({ weekday: 'long' });
  const timeF = fmt({ hour: '2-digit', minute: '2-digit', hour12: true });
  const keyF = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
  const d = (v: Date | null) => (v ? dateF.format(v) : '—');
  const day = (v: Date | null) => (v ? dayF.format(v) : '—');
  const time = (v: Date | null) => (v ? timeF.format(v).toUpperCase() : '—');
  const full = (v: Date) => `${d(v)} (${day(v)}) ${time(v)}`;
  const inRange = (v: Date) => v >= from && v <= now;

  const userById = new Map(store.users.map((u) => [u.id, u]));
  const nameOf = (id: string) => userById.get(id)?.name ?? '—';
  const members = store
    .staffOfTeams([team.id])
    .filter((u) => !isTestAccount(u))
    .sort((a, b) => a.name.localeCompare(b.name));
  const memberIds = new Set(members.map((m) => m.id));

  const isTestEntry = (t: SeedTask) => isTestAccount(userById.get(t.assignorId)) && t.status !== 'COMPLETED';
  const tasks = store.tasks
    .filter((t) => memberIds.has(t.assigneeId) && inRange(t.createdAt) && !isTestEntry(t))
    .sort((a, b) => nameOf(a.assigneeId).localeCompare(nameOf(b.assigneeId)) || +a.createdAt - +b.createdAt);
  const taskIds = new Set(tasks.map((t) => t.id));
  const commentsOf = new Map<string, typeof store.comments>();
  for (const c of store.comments) if (taskIds.has(c.taskId)) commentsOf.set(c.taskId, [...(commentsOf.get(c.taskId) ?? []), c]);
  const activityOf = new Map<string, typeof store.activities>();
  for (const a of store.activities) if (taskIds.has(a.taskId)) activityOf.set(a.taskId, [...(activityOf.get(a.taskId) ?? []), a]);
  const logins = store.auditLogs
    .filter((a) => a.action === 'AUTH_LOGIN' && a.actorId && memberIds.has(a.actorId) && inRange(a.createdAt))
    .sort((a, b) => nameOf(a.actorId!).localeCompare(nameOf(b.actorId!)) || +a.createdAt - +b.createdAt);

  const records = tasks.map((t, n) => {
    const comments = [...(commentsOf.get(t.id) ?? [])].sort((a, b) => +a.createdAt - +b.createdAt);
    const acts = [...(activityOf.get(t.id) ?? [])].sort((a, b) => +a.createdAt - +b.createdAt);
    const texts = [t.description, t.completionNote, t.evidenceUrl, t.reviewNote, ...comments.map((c) => c.body), ...acts.map((a) => a.note)];
    const links = [...new Set(texts.flatMap((s) => (s ?? '').match(URL) ?? []).map((u) => u.replace(/[.,;]+$/, '')))];
    const activity = acts.map((a) => {
      const change = [a.fromValue, a.toValue].filter(Boolean).join(' → ');
      return `• ${full(a.createdAt)} — ${nameOf(a.actorId)}: ${nice(a.type)}${change ? ` (${change})` : ''}${a.note ? ` — ${a.note}` : ''}`;
    });
    return {
      assigneeId: t.assigneeId,
      status: t.status,
      links,
      values: [
        `Task ${n + 1}`,
        nameOf(t.assigneeId),
        t.title,
        t.description || '—',
        nice(t.status),
        t.progress,
        nice(t.priority),
        d(t.createdAt),
        day(t.createdAt),
        time(t.createdAt),
        d(t.dueAt),
        day(t.dueAt),
        d(t.completedAt),
        day(t.completedAt),
        time(t.completedAt),
        nameOf(t.assignorId),
        t.origin === 'SELF_REPORTED' ? 'Self-reported' : 'Assigned',
        t.completionNote || '—',
        t.evidenceUrl || '—',
        links.join('\n') || '—',
        // Assigned work has no review step; only self-reported work is reviewed.
        t.reviewStatus ? nice(t.reviewStatus) : 'No review needed',
        t.reviewerId ? nameOf(t.reviewerId) : '—',
        t.reviewedAt ? full(t.reviewedAt) : t.reviewStatus === 'PENDING' ? 'Not reviewed yet' : '—',
        t.reviewNote || '—',
        comments.map((c) => `• ${full(c.createdAt)} — ${nameOf(c.authorId)}: ${c.body}`).join('\n') || '—',
        activity.join('\n') || '—',
      ] as (string | number)[],
    };
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ZEMP';
  workbook.created = now;

  const summaryCols: Col[] = [
    { header: 'Employee', width: 24 },
    { header: 'Tasks Uploaded', width: 15, center: true },
    { header: 'Completed', width: 12, center: true },
    { header: 'In Progress', width: 12, center: true },
    { header: 'To Do', width: 9, center: true },
    { header: 'Other', width: 9, center: true },
    { header: 'Tasks With Links', width: 16, center: true },
    { header: 'Days Logged In', width: 15, center: true },
    { header: 'Total Logins', width: 13, center: true },
  ];
  const summary = addSheet(workbook, 'Summary', summaryCols, 0);
  members.forEach((m, i) => {
    const mine = records.filter((r) => r.assigneeId === m.id);
    const count = (s: string) => mine.filter((r) => r.status === s).length;
    const theirLogins = logins.filter((l) => l.actorId === m.id);
    const row = summary.addRow([
      m.name,
      mine.length,
      count('COMPLETED'),
      count('IN_PROGRESS'),
      count('TODO'),
      mine.length - count('COMPLETED') - count('IN_PROGRESS') - count('TODO'),
      mine.filter((r) => r.links.length).length,
      new Set(theirLogins.map((l) => keyF.format(l.createdAt))).size,
      theirLogins.length,
    ]);
    styleRow(row, summaryCols, i % 2 === 1, false);
  });
  summary.addRow([]);
  const note = (text: string) => (summary.addRow([text]).getCell(1).font = { italic: true, color: { argb: 'FF6F6A72' } });
  note(`Team: ${team.name} · Period: ${d(from)} – ${d(now)} (last ${TEAM_REPORT_DAYS} days, ${tz}).`);
  note('Test accounts and test entries excluded. Each employee has their own sheet; "All Tasks" has everyone.');

  const taskSheet = (name: string, rows: typeof records) => {
    const sheet = addSheet(workbook, name, TASK_COLUMNS, 3);
    const evidenceCol = TASK_COLUMNS.findIndex((c) => c.header === 'Evidence Link') + 1;
    const linksCol = TASK_COLUMNS.findIndex((c) => c.header === 'All Links Found') + 1;
    rows.forEach((r, i) => {
      const row = sheet.addRow(r.values);
      const lines = Math.max(
        ...TASK_COLUMNS.map((c, k) => (c.wrap ? String(r.values[k]).split('\n').length + Math.floor(String(r.values[k]).length / 55) : 1)),
      );
      row.height = Math.min(Math.max(20, 15 * lines), 300);
      styleRow(row, TASK_COLUMNS, i % 2 === 1, true);
      for (const col of [evidenceCol, linksCol]) {
        const cell = row.getCell(col);
        const first = String(cell.value).split('\n')[0] ?? '';
        if (first.startsWith('http')) {
          cell.value = { text: String(cell.value), hyperlink: first };
          cell.font = { color: { argb: 'FF0563C1' }, underline: true };
        }
      }
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: TASK_COLUMNS.length } };
  };
  taskSheet('All Tasks', records);
  for (const m of members) {
    const mine = records.filter((r) => r.assigneeId === m.id);
    if (mine.length) taskSheet(m.name, mine);
  }

  const loginCols: Col[] = [
    { header: 'Employee', width: 22 },
    { header: 'Email', width: 32 },
    { header: 'Login Date', width: 14, center: true },
    { header: 'Day', width: 13, center: true },
    { header: 'Login Time', width: 13, center: true },
  ];
  const loginSheet = addSheet(workbook, 'Logins', loginCols, 0);
  logins.forEach((l, i) => {
    const u = userById.get(l.actorId!);
    styleRow(loginSheet.addRow([u?.name ?? '—', u?.email ?? '—', d(l.createdAt), day(l.createdAt), time(l.createdAt)]), loginCols, i % 2 === 1, false);
  });

  return workbook.xlsx.writeBuffer();
}
