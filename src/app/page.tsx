import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(10, 11, 14, 0.8)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '1rem 1.5rem',
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
                fontSize: '1.1rem',
              }}
            >
              F
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
              API-FRRM
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/tester"
              style={{
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            >
              API Tester
            </Link>
            <Link
              href="/login"
              style={{
                color: 'var(--text-main)',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 500,
                padding: '0.4rem 0.8rem',
              }}
            >
              Log in
            </Link>
            <Link href="/register" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.9rem' }}>
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '5rem 1.5rem 3rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-block',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '9999px',
              padding: '0.35rem 1rem',
              fontSize: '0.85rem',
              color: '#818cf8',
              fontWeight: 600,
              marginBottom: '1.5rem',
            }}
          >
            ⚡ Next.js 15 + Cloudflare Workers + Neon PostgreSQL
          </div>
          <h1
            style={{
              fontSize: '3.5rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              marginBottom: '1.5rem',
            }}
          >
            Instant Dynamic REST APIs{' '}
            <span
              style={{
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              at the Edge
            </span>
          </h1>
          <p
            style={{
              fontSize: '1.2rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              marginBottom: '2.5rem',
            }}
          >
            Define schemas with JSON or UI. Automatically provision isolated PostgreSQL schemas,
            generate full CRUD endpoints with API key protection, and monitor uptime in real time.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn-primary" style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}>
              Launch Dashboard →
            </Link>
            <Link href="/tester" className="btn-secondary" style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}>
              Open API Tester
            </Link>
          </div>
        </div>

        {/* Feature Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginTop: '5rem',
          }}
        >
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                marginBottom: '1rem',
                fontSize: '1.25rem',
              }}
            >
              🛡️
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Schema Isolation
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Each project gets an isolated PostgreSQL schema with custom typed tables, UUID keys,
              timestamps, and automatic validations.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34d399',
                marginBottom: '1rem',
                fontSize: '1.25rem',
              }}
            >
              🚀
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              High Performance Edge
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Powered by native Web Crypto PBKDF2, HMAC sessions, and Neon HTTP serverless connection
              optimized for Cloudflare Workers.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(236, 72, 153, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f472b6',
                marginBottom: '1rem',
                fontSize: '1.25rem',
              }}
            >
              🔔
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Automated Monitoring
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Cloudflare cron worker checks endpoints every 5 minutes and sends state-change alerts
              to Telegram, Slack, Discord, or Email.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        API-FRRM &copy; 2026. Built with Next.js 15, Neon PostgreSQL & Cloudflare Workers.
      </footer>
    </div>
  );
}
