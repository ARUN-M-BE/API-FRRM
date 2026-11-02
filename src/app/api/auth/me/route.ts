import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session';
import { sql } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const users = await sql<
      { id: string; email: string; created_at: string }[]
    >`SELECT id, email, created_at FROM users WHERE id = ${userId} LIMIT 1`;

    if (!users || users.length === 0) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user: users[0] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

