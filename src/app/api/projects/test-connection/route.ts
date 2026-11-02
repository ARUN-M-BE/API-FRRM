import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/middleware';
import { testDbConnection } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { database_url } = body;

    if (!database_url || typeof database_url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Database URL is required' },
        { status: 400 }
      );
    }

    const result = await testDbConnection(database_url.trim());
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to test connection' },
      { status: 500 }
    );
  }
}
