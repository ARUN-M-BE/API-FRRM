'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'var(--accent-gradient)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#fff',
              fontSize: '1.3rem',
              marginBottom: '0.75rem',
            }}
          >
            F
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Log in to manage your APIs</p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#fb7185',
              padding: '0.75rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-muted)',
                marginBottom: '0.4rem',
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: 'var(--text-muted)',
                marginBottom: '0.4rem',
              }}
            >
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: '1.75rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

