import { PrismaPg } from '@prisma/adapter-pg';
import { defineConfig } from 'prisma/config';
import 'dotenv/config';

// Prisma 7 reads the connection URL through a driver adapter rather than a schema `url`, both for
// the CLI (migrate/studio) and — separately — for PrismaClient at runtime (see prisma.service.ts).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env.DATABASE_URL },
  migrations: { adapter: async () => new PrismaPg({ connectionString: process.env.DATABASE_URL }) },
});
