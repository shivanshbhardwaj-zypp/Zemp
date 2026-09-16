/**
 * Demo organization seeded from the customer's Demo_Data sheet. These are demo accounts for a local
 * environment — the shared password below is seed data and must never be used in a real deployment.
 */
import type { SystemRole } from '../enums.js';

export const ORGANIZATION = { name: 'ZEMP Demo Co.', timezone: 'Asia/Kolkata' };

export const DEMO_TEAM = { name: 'CXO', description: 'Leadership team.' };

export interface SeedPerson {
  name: string;
  email: string;
  employeeCode: string;
  phone: string | null;
  role: SystemRole;
  jobTitle: string;
  /** Members of the CXO team; the Super Admin who runs the platform has no team. */
  inTeam: boolean;
  /** The admin who owns the team. */
  ownsTeam?: boolean;
}

/**
 * From the sheet. "Super Admin/Admin" (Dipro) is seeded as a Super Admin who is also on the CXO
 * team: Super Admin already carries every admin power, so that one account both runs the
 * organization and works inside CXO. Shivansh is the team's own admin and owns it.
 */
export const PEOPLE: readonly SeedPerson[] = [
  {
    name: 'Test User',
    email: 'test@example.com',
    employeeCode: 'MOB0000',
    phone: '1111122222',
    role: 'SUPER_ADMIN',
    jobTitle: 'Super Admin',
    inTeam: false,
  },
  {
    name: 'Dipro',
    email: 'dipro@example.com',
    employeeCode: 'MOB0001',
    phone: '7003034813',
    role: 'SUPER_ADMIN',
    jobTitle: 'Super Admin · CXO',
    inTeam: true,
  },
  {
    name: 'Shivansh',
    email: 'shivansh@example.com',
    employeeCode: 'MOB0002',
    phone: '7895552243',
    role: 'ADMIN',
    jobTitle: 'Admin · CXO',
    inTeam: true,
    ownsTeam: true,
  },
  {
    name: 'Neeraj',
    email: 'neeraj@example.com',
    employeeCode: 'MOB0003',
    phone: '9915915136',
    role: 'EMPLOYEE',
    jobTitle: 'Team Member',
    inTeam: true,
  },
  {
    name: 'Saurav',
    email: 'saurav@example.com',
    employeeCode: 'MOB0004',
    phone: '1111122222',
    role: 'EMPLOYEE',
    jobTitle: 'Team Member',
    inTeam: true,
  },
];

/** Work the CXO team hands out day to day. */
export const TEAM_TASKS = [
  'Prepare the weekly leadership update',
  'Review the monthly operations report',
  'Follow up on pending vendor payments',
  'Collect headcount requests from each function',
  'Draft the quarterly board summary',
  'Check outstanding customer escalations',
  'Update the hiring tracker',
  'Reconcile last month’s expenses',
  'Plan the next town hall agenda',
  'Review the product roadmap changes',
  'Chase overdue partner agreements',
  'Summarise this week’s revenue numbers',
  'Prepare slides for the investor call',
  'Audit access for departing contractors',
  'Refresh the on-call rota',
];

export const ADMIN_TASKS = [
  'Prepare the Q4 headcount plan',
  'Review team workload balance',
  'Submit the monthly operations summary',
  'Nominate a lead for the onboarding revamp',
  'Agree quarterly goals with the team',
];

export const DESCRIPTIONS = [
  'Keep the scope tight and flag anything that needs a decision early.',
  'Share a short written update in the comments when this is done.',
  'Coordinate with the owner of the related work before starting.',
  'Use the latest version of the shared checklist.',
];

export const BLOCK_REASONS = [
  'Waiting for access from IT',
  'Blocked on vendor confirmation',
  'Needs a decision on scope',
  'Waiting on design review',
];

export const COMPLETION_NOTES = [
  'Done — details are in the shared folder.',
  'Completed and verified with the requester.',
  'Finished; follow-ups logged separately.',
];

/** Work employees logged themselves, for the review queue (demo data only). */
export const SELF_REPORTS: ReadonlyArray<{
  title: string;
  description: string;
  evidenceUrl: string | null;
  dayOffset: number;
  time: string;
  toSuperAdmin: boolean;
  decision?: { approved: boolean; note: string | null };
}> = [
  {
    title: 'Cleaned up the shared asset folder',
    description:
      'Nothing was assigned today, so I sorted the shared drive: archived last quarter’s files, fixed the naming, and wrote a short README for the team.',
    evidenceUrl: 'https://example.com/drive/shared-assets',
    dayOffset: 0,
    time: '11:20',
    toSuperAdmin: false,
  },
  {
    title: 'Drafted an onboarding checklist for new joiners',
    description:
      'Wrote a one-page checklist covering accounts, tools and the first-week intro calls, based on what was missing when I joined.',
    evidenceUrl: 'https://example.com/docs/onboarding-checklist',
    dayOffset: -1,
    time: '16:05',
    toSuperAdmin: true,
  },
  {
    title: 'Fixed the broken links on the help page',
    description: 'Found nine dead links while reading the help centre and corrected them.',
    evidenceUrl: null,
    dayOffset: -2,
    time: '14:40',
    toSuperAdmin: false,
    decision: { approved: true, note: 'Nice catch — thanks for picking this up.' },
  },
  {
    title: 'Reorganised the weekly report template',
    description: 'Rebuilt the template so the numbers pull through automatically instead of being typed in each week.',
    evidenceUrl: 'https://example.com/docs/weekly-report-template',
    dayOffset: -3,
    time: '10:15',
    toSuperAdmin: false,
    decision: { approved: false, note: 'Add a note on where the numbers come from, then resubmit.' },
  },
];

export const COMMENT_PAIRS: ReadonlyArray<readonly [assignee: string, assignor: string]> = [
  ['Started on this — I will share an update by end of day.', 'Thanks, keep me posted.'],
  ['Halfway there. Should wrap up tomorrow.', 'Great progress.'],
  ['Could you confirm the priority on this one?', 'Yes — please treat it as the next item.'],
  ['Found a small dependency; checking with the team.', 'Let me know if you need me to unblock anything.'],
];
