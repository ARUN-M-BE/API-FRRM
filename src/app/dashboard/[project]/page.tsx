'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ApiItem {
  id: string;
  name: string;
  version: string;
  columns: any;
  check_url: string | null;
  is_up: boolean | null;
  last_checked_at: string | null;
  created_at: string;
}

interface CheckLog {
  id: string;
  api_id: string;
  status_code: number;
  latency_ms: number;
  checked_at: string;
}

interface ProjectData {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
  apis: ApiItem[];
  recentChecks: CheckLog[];
}

function ProjectDetailContent() {
  const params = useParams();
  const projectName = (params?.project as string) || '';
  const router = useRouter();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [deletingApi, setDeletingApi] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectName}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load project');
      setProject(data.project);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectName) {
      fetchProject();
    }
  }, [projectName]);

  // Draw latency chart when checks are loaded
  useEffect(() => {
    if (!canvasRef.current || !project || !project.recentChecks || project.recentChecks.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sort checks by time ascending
    const checks = [...project.recentChecks].reverse();
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const maxLatency = Math.max(...checks.map((c) => c.latency_ms), 200);
    const stepX = width / Math.max(checks.length - 1, 1);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    ctx.beginPath();
    ctx.moveTo(0, height);

    checks.forEach((c, i) => {
      const x = i * stepX;
      const y = height - (c.latency_ms / maxLatency) * (height - 20) - 10;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw stroke line
    ctx.beginPath();
    checks.forEach((c, i) => {
      const x = i * stepX;
      const y = height - (c.latency_ms / maxLatency) * (height - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }, [project]);

  const copyApiKey = () => {
    if (!project) return;
    navigator.clipboard.writeText(project.api_key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDeleteApi = async (apiName: string, version: string) => {
    if (!confirm(`Are you sure you want to drop API "${apiName}" (${version}) and its table?`)) {
      return;
    }

    try {
      setDeletingApi(apiName);
      const res = await fetch(`/api/projects/${projectName}/apis/${apiName}?version=${version}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete API');

      fetchProject();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeletingApi(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading project...</div>;
  }

  if (error || !project) {
    return (
      <div style={{ padding: '2rem' }}>
        <p style={{ color: '#fb7185' }}>{error || 'Project not found'}</p>
        <Link href="/dashboard" className="btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <Link href="/dashboard" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
              Projects
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>{project.name}</h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Postgres Schema: <code style={{ color: '#818cf8' }}>&quot;{project.name}&quot;</code> • Created{' '}
            {new Date(project.created_at).toLocaleDateString()}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link href={`/dashboard/${project.name}/apis/new`} className="btn-primary" style={{ fontSize: '0.85rem' }}>
            <span>➕</span> Add API
          </Link>
          <Link
            href={`/dashboard/${project.name}/settings`}
            className="btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            ⚙ Settings
          </Link>
        </div>
      </div>

      {/* API Key Box */}
      <div
        className="glass-panel"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>API KEY:</span>
          <code
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              color: '#34d399',
              fontSize: '0.9rem',
              letterSpacing: '0.05em',
            }}
          >
            {project.api_key}
          </code>
        </div>
        <button
          onClick={copyApiKey}
          className="btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
        >
          {copiedKey ? '✓ Copied to clipboard' : 'Copy Key'}
        </button>
      </div>

      {/* Latency History Chart */}
      {project.recentChecks && project.recentChecks.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Latency &amp; Health History</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Last {project.recentChecks.length} checks (cron 5m)
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={900}
            height={160}
            style={{ width: '100%', height: '160px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}
          />
        </div>
      )}

      {/* APIs Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Generated APIs</h2>
          <span className="badge-muted">{project.apis.length} Active Endpoints</span>
        </div>

        {project.apis.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No APIs created in this project yet.{' '}
            <Link href={`/dashboard/${project.name}/apis/new`} style={{ color: '#818cf8' }}>
              Add your first API table →
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.8rem 1.25rem' }}>Name &amp; Version</th>
                  <th style={{ padding: '0.8rem 1.25rem' }}>Status</th>
                  <th style={{ padding: '0.8rem 1.25rem' }}>Endpoint</th>
                  <th style={{ padding: '0.8rem 1.25rem' }}>Health Check</th>
                  <th style={{ padding: '0.8rem 1.25rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {project.apis.map((api) => {
                  const endpointUrl = `/api/p/${project.name}/${api.version}/${api.name}`;
                  return (
                    <tr
                      key={api.id}
                      style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    >
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{api.name}</div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{api.version}</span>
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        {api.check_url ? (
                          api.is_up ? (
                            <span className="badge-up">● UP</span>
                          ) : (
                            <span className="badge-down">● DOWN</span>
                          )
                        ) : (
                          <span className="badge-muted">No Monitor</span>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.25rem' }}>
                        <code
                          style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            color: '#818cf8',
                          }}
                        >
                          {endpointUrl}
                        </code>
                      </td>

                      <td style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {api.check_url ? (
                          <a
                            href={api.check_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#818cf8', textDecoration: 'none' }}
                          >
                            {api.check_url.length > 30 ? `${api.check_url.substring(0, 30)}...` : api.check_url}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Link
                            href={`/tester?url=${encodeURIComponent(endpointUrl)}&key=${project.api_key}`}
                            className="btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                          >
                            ⚡ Test
                          </Link>
                          <button
                            onClick={() => handleDeleteApi(api.name, api.version)}
                            disabled={deletingApi === api.name}
                            className="btn-danger"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                          >
                            {deletingApi === api.name ? 'Dropping...' : 'Drop'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading project...</div>}>
      <ProjectDetailContent />
    </Suspense>
  );
}

