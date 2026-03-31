import type { NextRequest } from 'next/server';
import { methodNotAllowed, routeTradingPost } from '@/lib/trading/server';

export const dynamic = 'force-dynamic';

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const p = await params;
  const key = p.path.join('/');
  try {
    return await routeTradingPost(req, key);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(message, 500);
  }
}

export async function GET(): Promise<Response> {
  return methodNotAllowed();
}

export async function PUT(): Promise<Response> {
  return methodNotAllowed();
}

export async function PATCH(): Promise<Response> {
  return methodNotAllowed();
}

export async function DELETE(): Promise<Response> {
  return methodNotAllowed();
}
