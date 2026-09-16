/** Synthetic demo organization. Every name, email and task here is invented seed data. */

export const ORGANIZATION = { name: 'ZEMP Demo Co.', timezone: 'Asia/Kolkata' };

export const SUPER_ADMIN = { name: 'John Carter', email: 'john@zemp.test', jobTitle: 'Head of Operations' };

interface TeamDefinition {
  key: 'engineering' | 'marketing' | 'operations';
  name: string;
  description: string;
  admin: { name: string; email: string; jobTitle: string };
  members: ReadonlyArray<readonly [name: string, jobTitle: string]>;
  tasks: readonly string[];
}

export const TEAMS: readonly TeamDefinition[] = [
  {
    key: 'engineering',
    name: 'Product Engineering',
    description: 'Builds and maintains the customer apps and internal tools.',
    admin: { name: 'Rock Alvarez', email: 'rock@zemp.test', jobTitle: 'Engineering Manager' },
    members: [
      ['Aarav Shah', 'Software Engineer'],
      ['Priya Nair', 'QA Engineer'],
      ['Daniel Kim', 'Software Engineer'],
      ['Meera Iyer', 'Frontend Engineer'],
      ['Lucas Ferreira', 'Backend Engineer'],
      ['Hana Sato', 'Mobile Engineer'],
      ['Omar Haddad', 'DevOps Engineer'],
      ['Ishita Rao', 'QA Engineer'],
      ['Noah Williams', 'Software Engineer'],
      ['Zara Ahmed', 'Product Designer'],
    ],
    tasks: [
      'Fix pagination on the invoices list',
      'Write API tests for the payments flow',
      'Refactor the notification service',
      'Review pull requests for the release branch',
      'Add CSV export to the reports screen',
      'Improve dashboard load time',
      'Set up error monitoring alerts',
      'Document the local development setup',
      'Migrate nightly jobs to the scheduler',
      'Accessibility pass on the checkout form',
      'Harden rate limiting on the login endpoint',
      'Update the mobile app splash screen',
      'Investigate slow search queries',
      'Clean up unused feature flags',
      'Prepare release notes for v2.4',
    ],
  },
  {
    key: 'marketing',
    name: 'Marketing',
    description: 'Campaigns, content, brand and partnerships.',
    admin: { name: 'Bruce Tan', email: 'bruce@zemp.test', jobTitle: 'Marketing Manager' },
    members: [
      ['Sofia Rossi', 'Content Strategist'],
      ['Arjun Mehta', 'Performance Marketer'],
      ['Chloe Martin', 'Brand Designer'],
      ['Kabir Singh', 'Social Media Executive'],
      ['Emily Johnson', 'Copywriter'],
      ['Ravi Kumar', 'SEO Specialist'],
      ['Aisha Bello', 'Marketing Analyst'],
      ['Mateo Garcia', 'Video Editor'],
      ['Nisha Patel', 'Events Coordinator'],
      ["Liam O'Brien", 'Partnerships Executive'],
    ],
    tasks: [
      'Draft the October newsletter',
      'Plan the festive campaign calendar',
      'Refresh landing page copy',
      'Compile a competitor pricing review',
      'Schedule social posts for the week',
      'Brief the designer on the product video',
      'Analyze last month’s campaign performance',
      'Update the brand guidelines deck',
      'Coordinate the partner webinar',
      'Write a customer case study',
      'Audit website SEO metadata',
      'Edit the testimonial video cut',
      'Prepare the trade show booth checklist',
      'Review ad spend against budget',
      'Collect quotes for the product brochure',
    ],
  },
  {
    key: 'operations',
    name: 'Customer Operations',
    description: 'Support, logistics, billing and vendor relationships.',
    admin: { name: 'Clark Mensah', email: 'clark@zemp.test', jobTitle: 'Operations Manager' },
    members: [
      ['Ananya Das', 'Support Lead'],
      ['Ethan Brooks', 'Support Specialist'],
      ['Fatima Khan', 'Operations Associate'],
      ['Rohan Verma', 'Logistics Coordinator'],
      ['Grace Lee', 'Support Specialist'],
      ['Vikram Joshi', 'Vendor Manager'],
      ['Maya Cohen', 'Quality Analyst'],
      ['Samuel Okafor', 'Operations Associate'],
      ['Leila Nasser', 'Billing Specialist'],
      ['Tomás Silva', 'Field Coordinator'],
    ],
    tasks: [
      'Resolve escalated support tickets',
      'Audit this month’s vendor invoices',
      'Update the service SLA document',
      'Prepare the weekly operations report',
      'Train new support hires on refunds',
      'Reconcile warehouse inventory counts',
      'Merge duplicate customer records',
      'Review pending refund requests',
      'Plan next week’s shift roster',
      'Call back customers who cancelled',
      'Renew the courier contract',
      'Update support macros for new pricing',
      'Check delivery delays in the north region',
      'Verify billing addresses for enterprise accounts',
      'Prepare the quarterly vendor scorecard',
    ],
  },
];

/** Moved from Marketing to Product Engineering ten days ago — demonstrates team history. */
export const MOVED_EMPLOYEE = 'Zara Ahmed';
/** Deactivated five days ago with unfinished work still assigned. */
export const INACTIVE_EMPLOYEE = "Liam O'Brien";
/** The 30-task, 5-day sprint from requirements §10, assigned to the first three engineers. */
export const SPRINT_EMPLOYEES = ['Aarav Shah', 'Priya Nair', 'Daniel Kim'] as const;
/** Completions per day of the sprint (day 1, 2, 3, today) — cumulative 4/10/18, 2/7/13, 0/4/9. */
export const SPRINT_DAILY_COMPLETIONS: readonly (readonly number[])[] = [
  [4, 6, 8, 3],
  [2, 5, 6, 2],
  [0, 4, 5, 2],
];
export const SPRINT_AREAS = ['Login', 'Checkout', 'Invoices', 'Reports', 'Settings', 'Notifications'];

export const UNOWNED_TEAM = {
  name: 'Design Studio',
  description: 'New team being set up — no admin or members yet.',
};

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
