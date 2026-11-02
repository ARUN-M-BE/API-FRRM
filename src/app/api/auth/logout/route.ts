import { NextResponse } from 'next/server';
import { createClearSessionCookieHeader } from '@/lib/session';

export async function POST() {
  const cookieHeader = createClearSessionCookieHeader();
  return NextResponse.json(
    { message: 'Logged out successfully' },
    {
      status: 200,
      headers: {
        'Set-Cookie': cookieHeader,
      },
    }
  );
}

