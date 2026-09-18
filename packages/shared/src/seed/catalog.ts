/**
 * Live organization roster, from the customer's Demo_Data sheet (updated 18 Sep 2026 — now Zypp's
 * CXO and Content teams, not the earlier single-team fixture). These are the real accounts people
 * sign in with; the shared password below is seed data and must never be used in a real deployment.
 * The sheet's own per-person passwords are intentionally not committed to source control.
 */
import type { SystemRole } from '../enums.js';

export const ORGANIZATION = { name: 'ZEMP Demo Co.', timezone: 'Asia/Kolkata' };

export interface SeedTeamDef {
  name: string;
  description: string | null;
}

export const DEMO_TEAMS: readonly SeedTeamDef[] = [
  { name: 'CXO', description: 'Leadership team.' },
  { name: 'Content', description: 'Content team.' },
];

export interface SeedPerson {
  name: string;
  email: string;
  employeeCode: string;
  phone: string | null;
  role: SystemRole;
  jobTitle: string;
  /** A name from DEMO_TEAMS, or null for the platform Super Admin, who has no team. */
  team: string | null;
  /** The admin who owns the team. */
  ownsTeam?: boolean;
}

/** From the sheet: 1 Super Admin, and two teams each led by their own Admin. */
export const PEOPLE: readonly SeedPerson[] = [
  { name: 'Test User', email: 'test@example.com', employeeCode: 'MOB0000', phone: '1111122222', role: 'SUPER_ADMIN', jobTitle: 'Super Admin', team: null },
  { name: 'Dipro Pathak', email: 'dipro.pathak@zypp.app', employeeCode: 'MOB7681', phone: '7003034813', role: 'ADMIN', jobTitle: 'Admin · CXO', team: 'CXO', ownsTeam: true },
  { name: 'Shivansh Bhardwaj', email: 'shivansh.bhardwaj@zypp.app', employeeCode: 'MOBC1658', phone: '7895552243', role: 'EMPLOYEE', jobTitle: 'Team Member', team: 'CXO' },
  { name: 'Neeraj Ranwal', email: 'neeraj.ranwal@zypp.app', employeeCode: 'MOB8099', phone: '9915915136', role: 'EMPLOYEE', jobTitle: 'Team Member', team: 'CXO' },
  { name: 'Saurav', email: 'saurav.chaudhary@zypp.in', employeeCode: 'MOB0004', phone: '7827226062', role: 'EMPLOYEE', jobTitle: 'Team Member', team: 'Content' },
  { name: 'Faisal Maqbool', email: 'faisal.maqbool1@zypp.app', employeeCode: 'MOB7272', phone: '8377007183', role: 'ADMIN', jobTitle: 'Admin · Content', team: 'Content', ownsTeam: true },
  { name: 'Deepesh Dev Pandey', email: 'deepesh.pandey@zypp.app', employeeCode: 'MOB6375', phone: '8840131369', role: 'EMPLOYEE', jobTitle: 'Team Member', team: 'Content' },
  { name: 'Janit Jaiswal', email: 'janit.jaiswal@zypp.app', employeeCode: 'MOB6969', phone: '9818480730', role: 'EMPLOYEE', jobTitle: 'Team Member', team: 'Content' },
  { name: 'Ayushi Ojha', email: 'ayushi.ojha@zypp.app', employeeCode: 'MOB6374', phone: '9044611292', role: 'EMPLOYEE', jobTitle: 'Team Member', team: 'Content' },
];
