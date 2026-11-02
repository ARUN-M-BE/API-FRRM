import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { createSessionCookieHeader } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const users = await sql<
      { id: string; email: string; password_hash: string; password_salt: string }[]
    >`SELECT id, email, password_hash, password_salt FROM users WHERE email = ${normalizedEmail} LIMIT 1`;

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users[0];
    const isValid = await verifyPassword(password, user.password_hash, user.password_salt);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const cookieHeader = await createSessionCookieHeader(user.id);

    return NextResponse.json(
      { message: 'Logged in successfully', user: { id: user.id, email: user.email } },
      {
        status: 200,
        headers: {
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

