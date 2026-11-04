'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
  api_count: number;
}

export default function ProjectsDashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load projects');
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const copyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Projects
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
            Manage isolated PostgreSQL schemas and generated REST endpoints
          </p>
        </div>
        <Link href="/dashboard/new" className="btn-primary">
          <span>➕</span> New Project
        </Link>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            maxWidth: '600px',
            margin: '2rem auto',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            No projects yet
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            Create your first project to generate dynamic REST APIs with your custom PostgreSQL schemas.
          </p>
          <Link href="/dashboard/new" className="btn-primary">
            Create Project
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
            gap: '1.25rem',
          }}
        >
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="glass-panel glass-panel-hover"
              style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <Link
                    href={`/dashboard/${proj.name}`}
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      textDecoration: 'none',
                    }}
                  >
                    {proj.name}
                  </Link>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Created {new Date(proj.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="badge-muted">{proj.api_count} {proj.api_count === 1 ? 'API' : 'APIs'}</span>
              </div>

              {/* API Key box */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  {proj.api_key.substring(0, 10)}...{proj.api_key.substring(proj.api_key.length - 4)}
                </span>
                <button
                  onClick={() => copyApiKey(proj.api_key)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedKey === proj.api_key ? '#34d399' : '#818cf8',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {copiedKey === proj.api_key ? '✓ Copied' : 'Copy Key'}
                </button>
              </div>

              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Link
                  href={`/dashboard/${proj.name}`}
                  className="btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                >
                  Manage APIs →
                </Link>
                <Link
                  href={`/dashboard/${proj.name}/settings`}
                  style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}
                >
                  ⚙ Settings
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

