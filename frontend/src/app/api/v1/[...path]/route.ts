// PHASE A MOCK API — replaced by a proxy to the NestJS backend in Phase D.
import { handle } from '@/mocks/http';
import '@/mocks/handlers';

export const dynamic = 'force-dynamic';

async function handler(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return handle(request, path);
}

export { handler as GET, handler as PATCH, handler as POST };
