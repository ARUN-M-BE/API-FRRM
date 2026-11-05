'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FolderKanban,
  PlusCircle,
  Activity,
  Zap,
  FlaskConical,
  Compass,
  Menu,
  X,
  LogOut,
  Sparkles,
} from 'lucide-react';

function DashboardNav({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const projectMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const currentProject = projectMatch && projectMatch[1] !== 'new' && projectMatch[1] !== 'status' && projectMatch[1] !== 'explorer' ? projectMatch[1] : null;

  const navItems = [
    { label: 'Projects', href: '/dashboard', icon: FolderKanban },
    { label: 'API Explorer', href: '/dashboard/explorer', icon: Compass, badge: 'New' },
    { label: 'New Project', href: '/dashboard/new', icon: PlusCircle },
    { label: '24/7 Monitor', href: '/dashboard/status', icon: Activity, badge: 'Live' },
    ...(currentProject
      ? [
          {
            label: 'API Client',
            href: `/dashboard/${currentProject}/client`,
            icon: Zap,
          },
        ]
      : []),
    { label: 'API Tester', href: '/tester', icon: FlaskConical },
  ];

  return (
    <nav style={{ padding: '1.25rem 0.75rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onCloseMobile}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Icon size={18} color={isActive ? '#818cf8' : 'currentColor'} />
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                {item.badge}
              </span>
            )}
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="dashboard-root">
      {/* Mobile Top Header (Always at the very top of mobile viewport) */}
      <header className="dashboard-mobile-header">
        <Link
          href="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none', color: '#fff' }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              color: '#fff',
              fontSize: '0.9rem',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
            }}
          >
            F
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
                API-FRRM
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                EDGE
              </span>
            </div>
          </div>
        </Link>

        {/* Quick Actions & Menu Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Link
            href="/dashboard/explorer"
            title="API Explorer"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c7d2fe',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              textDecoration: 'none',
            }}
          >
            <Compass size={18} />
          </Link>
          <Link
            href="/dashboard/status"
            title="24/7 Health Monitor"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              position: 'relative',
              textDecoration: 'none',
            }}
          >
            <Activity size={18} />
            <span
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
              }}
            />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: mobileMenuOpen ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '0.2rem',
            }}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="dashboard-body">
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="dashboard-sidebar-overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar (Desktop fixed left / Mobile slide drawer) */}
        <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
          {/* Brand */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                }}
              >
                F
              </div>
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.15rem', letterSpacing: '-0.02em', display: 'block' }}>
                  API-FRRM
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Multi-DB &amp; Edge Monitor</span>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="mobile-close-btn"
              style={{
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* System Status Pill */}
          <div style={{ padding: '0.75rem 1rem 0 1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontSize: '0.75rem',
                color: '#34d399',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
              <span style={{ fontWeight: 600 }}>Neon PostgreSQL &bull; Edge Active</span>
            </div>
          </div>

          {/* Nav Links wrapped in Suspense */}
          <Suspense fallback={<div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading navigation...</div>}>
            <DashboardNav onCloseMobile={() => setMobileMenuOpen(false)} />
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
              <p style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                Active Session
              </p>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'color 0.2s, border-color 0.2s',
              }}
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="dashboard-main">
          <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
