// Starts (and initialises, on first run) a local embedded Postgres cluster for development —
// no Docker/WSL required. Prints its own DATABASE_URL and stays running until Ctrl+C.
import EmbeddedPostgres from 'embedded-postgres';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const databaseDir = join(here, '..', '.pgdata');
const port = 55432;
const database = 'zemp';

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: 'zemp',
  password: 'zemp_local_dev',
  persistent: true,
});

const firstRun = !existsSync(databaseDir);
if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase(database);

const url = `postgresql://zemp:zemp_local_dev@localhost:${port}/${database}`;
console.log(`Local Postgres ready: ${url}`);
console.log('Press Ctrl+C to stop.');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
}
