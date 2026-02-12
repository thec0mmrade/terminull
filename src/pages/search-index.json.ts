import { buildSearchIndex } from '../lib/search-index';

export async function GET() {
  const index = await buildSearchIndex();
  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
}
