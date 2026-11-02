import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { createSessionCookieHeader } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await sql<
      { id: string }[]
    >`SELECT id FROM users WHERE email = ${normalizedEmail} LIMIT 1`;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password with PBKDF2
    const { hash, salt } = await hashPassword(password);

    const inserted = await sql<
      { id: string; email: string; created_at: string }[]
    >`INSERT INTO users (email, password_hash, password_salt)
      VALUES (${normalizedEmail}, ${hash}, ${salt})
      RETURNING id, email, created_at`;

    const user = inserted[0];
    const cookieHeader = await createSessionCookieHeader(user.id);

    return NextResponse.json(
      { message: 'Registered successfully', user: { id: user.id, email: user.email } },
      {
        status: 201,
        headers: {
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (error: any) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

