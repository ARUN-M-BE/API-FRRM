'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

function DashboardNav() {
  const pathname = usePathname();
  const projectMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const currentProject = projectMatch && projectMatch[1] !== 'new' ? projectMatch[1] : null;

  const navItems = [
    { label: 'Projects', href: '/dashboard', icon: '📁' },
    { label: 'New Project', href: '/dashboard/new', icon: '➕' },
    ...(currentProject
      ? [
          {
            label: 'API Client',
            href: `/dashboard/${currentProject}/client`,
            icon: '⚡',
          },
        ]
      : []),
    { label: 'API Tester', href: '/tester', icon: '🧪' },
  ];

  return (
    <nav style={{ padding: '1.25rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.9rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: isActive ? '#fff' : 'var(--text-muted)',
              background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push('/login');
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '260px',
          background: 'rgba(14, 16, 22, 0.95)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 40,
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#fff',
            }}
          >
            F
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
            API-FRRM
          </span>
        </div>

        {/* Nav Links wrapped in Suspense */}
        <Suspense fallback={<div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading navigation...</div>}>
          <DashboardNav />
        </Suspense>

        {/* User Profile & Logout */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid var(--border)',
            background: 'rgba(10, 11, 14, 0.5)',
          }}
        >
          <div style={{ marginBottom: '0.5rem', overflow: 'hidden' }}>
            <p
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.email || 'Loading...'}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Neon Edge Connected</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.45rem',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        style={{
          marginLeft: '260px',
          flex: 1,
          minHeight: '100vh',
          padding: '2rem',
          maxWidth: '1400px',
        }}
      >
        <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}
