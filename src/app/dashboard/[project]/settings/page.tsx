'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Channel {
  id?: string;
  type: string;
  target: string;
}

function ProjectSettingsContent() {
  const params = useParams();
  const projectName = (params?.project as string) || '';
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [newType, setNewType] = useState('telegram');
  const [newTarget, setNewTarget] = useState('');
  const [savingChannels, setSavingChannels] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [databaseType, setDatabaseType] = useState<'postgres' | 'mysql' | 'mongodb' | 'sqlite'>('postgres');
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [testingDb, setTestingDb] = useState(false);
  const [savingDb, setSavingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);

  const getDbPlaceholder = () => {
    switch (databaseType) {
      case 'mysql':
        return 'mysql://root:password@127.0.0.1:3306/mydb';
      case 'mongodb':
        return 'mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority';
      case 'sqlite':
        return 'sqlite:./database.sqlite';
      default:
        return 'postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require';
    }
  };

  useEffect(() => {
    fetch(`/api/projects/${projectName}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.project) {
          setApiKey(data.project.api_key);
          setDatabaseType(data.project.database_type || 'postgres');
          setDatabaseUrl(data.project.database_url || '');
          setChannels(data.project.channels || []);
        } else {
          setError(data.error || 'Failed to load settings');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectName]);

  const testDb = async () => {
    if (!databaseUrl.trim()) return;
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await fetch('/api/projects/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database_url: databaseUrl.trim(), database_type: databaseType }),
      });
      const data = await res.json();
      setDbTestResult(data);
    } catch (err: any) {
      setDbTestResult({ success: false, error: err.message });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSaveDb = async () => {
    try {
      setSavingDb(true);
      setMessage(null);
      setError(null);
      const res = await fetch(`/api/projects/${projectName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database_url: databaseUrl.trim() || null, database_type: databaseType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update database configuration');
      setMessage('Database configuration updated successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingDb(false);
    }
  };

  const handleRotateKey = async () => {
    if (!confirm('Are you sure you want to rotate the API key? The old key will immediately stop working!')) {
      return;
    }

    try {
      setRotatingKey(true);
      setMessage(null);
      setError(null);

      const res = await fetch(`/api/projects/${projectName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate_api_key' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rotate key');

      setApiKey(data.api_key);
      setMessage('API key rotated successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRotatingKey(false);
    }
  };

  const handleAddChannel = () => {
    if (!newTarget.trim()) return;
    setChannels([...channels, { type: newType, target: newTarget.trim() }]);
    setNewTarget('');
  };

  const handleRemoveChannel = (idx: number) => {
    setChannels(channels.filter((_, i) => i !== idx));
  };

  const handleSaveChannels = async () => {
    try {
      setSavingChannels(true);
      setMessage(null);
      setError(null);

      const res = await fetch(`/api/projects/${projectName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save channels');

      setMessage('Notification channels updated.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingChannels(false);
    }
  };

  const handleDeleteProject = async () => {
    const confirmation = prompt(
      `To permanently delete project "${projectName}" and drop its PostgreSQL schema and all tables, please type the project name below:`
    );

    if (confirmation !== projectName) {
      alert('Project name did not match. Deletion aborted.');
      return;
    }

    try {
      setDeletingProject(true);
      const res = await fetch(`/api/projects/${projectName}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete project');

      alert(`Project "${projectName}" deleted successfully.`);
      router.push('/dashboard');
    } catch (err: any) {
      alert(err.message);
      setDeletingProject(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading settings...</div>;
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href={`/dashboard/${projectName}`}
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          ← Back to {projectName}
        </Link>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem' }}>Project Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Manage security, notifications, and lifecycle for <code>&quot;{projectName}&quot;</code>
        </p>
      </div>

      {message && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* API Key Rotation */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>API Key</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Used in the <code>x-api-key</code> header for authenticating all CRUD operations for this project.
          </p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              readOnly
              className="input-field"
              style={{ fontFamily: 'monospace', maxWidth: '450px' }}
              value={apiKey}
            />
            <button
              onClick={handleRotateKey}
              disabled={rotatingKey}
              className="btn-secondary"
              style={{ whiteSpace: 'nowrap' }}
            >
              {rotatingKey ? 'Rotating...' : 'Rotate Key'}
            </button>
          </div>
        </div>

        {/* Database Engine / External Database Configuration */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Database Connection &amp; Engine</h2>
            <span className="badge-muted" style={{ textTransform: 'uppercase' }}>
              {databaseUrl ? `External ${databaseType}` : 'Default Neon Serverless'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Configure where the <code>&quot;{projectName}&quot;</code> data and tables are stored. Supports PostgreSQL, MySQL, MongoDB, and SQLite.
          </p>

          {/* Database Type Buttons */}
          <div className="db-type-grid">
            {[
              { id: 'postgres', label: '🐘 PostgreSQL / Neon' },
              { id: 'mysql', label: '🐬 MySQL' },
              { id: 'mongodb', label: '🍃 MongoDB' },
              { id: 'sqlite', label: '🗄️ SQLite / SQL' },
            ].map((db) => (
              <button
                key={db.id}
                type="button"
                onClick={() => {
                  setDatabaseType(db.id as any);
                  setDbTestResult(null);
                }}
                style={{
                  background: databaseType === db.id ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: databaseType === db.id ? '1px solid #6366f1' : '1px solid var(--border)',
                  color: databaseType === db.id ? '#fff' : 'var(--text-muted)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {db.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="password"
                className="input-field"
                placeholder={getDbPlaceholder()}
                value={databaseUrl}
                onChange={(e) => setDatabaseUrl(e.target.value)}
                style={{ flex: 1, minWidth: 'min(100%, 260px)', fontFamily: 'monospace' }}
              />
              <button
                type="button"
                onClick={testDb}
                disabled={testingDb || !databaseUrl.trim()}
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
              >
                {testingDb ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={handleSaveDb}
                disabled={savingDb}
                className="btn-primary"
                style={{ whiteSpace: 'nowrap' }}
              >
                {savingDb ? 'Saving...' : 'Save Database'}
              </button>
            </div>

            {dbTestResult && (
              <div
                style={{
                  fontSize: '0.85rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: dbTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  color: dbTestResult.success ? '#34d399' : '#fb7185',
                  border: `1px solid ${dbTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                }}
              >
                {dbTestResult.success
                  ? `✓ Connection verified! Latency: ${dbTestResult.latencyMs}ms`
                  : `✕ Connection failed: ${dbTestResult.error}`}
              </div>
            )}
          </div>
        </div>

        {/* Notification Channels */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Notification Channels
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Receive real-time alerts whenever an API in this project changes state (UP ↔ DOWN).
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <select
              className="input-field"
              style={{ width: '150px' }}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            >
              <option value="telegram">Telegram</option>
              <option value="slack">Slack Webhook</option>
              <option value="discord">Discord Webhook</option>
              <option value="email">Email</option>
            </select>
            <input
              type="text"
              className="input-field"
              placeholder={
                newType === 'telegram'
                  ? 'Chat ID'
                  : newType === 'email'
                  ? 'email@example.com'
                  : 'Webhook URL'
              }
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
            />
            <button onClick={handleAddChannel} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
              Add
            </button>
          </div>

          {channels.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No channels configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {channels.map((ch, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}
                >
                  <span>
                    <strong style={{ color: '#818cf8' }}>{ch.type.toUpperCase()}:</strong> {ch.target}
                  </span>
                  <button
                    onClick={() => handleRemoveChannel(idx)}
                    style={{ background: 'transparent', border: 'none', color: '#fb7185', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSaveChannels} disabled={savingChannels} className="btn-primary">
            {savingChannels ? 'Saving...' : 'Save Channels'}
          </button>
        </div>

        {/* Danger Zone */}
        <div
          className="glass-panel"
          style={{
            padding: '1.5rem',
            borderColor: 'rgba(244, 63, 94, 0.3)',
            background: 'rgba(244, 63, 94, 0.04)',
          }}
        >
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#fb7185', marginBottom: '0.5rem' }}>
            Danger Zone
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Permanently delete this project. This will execute <code>DROP SCHEMA &quot;{projectName}&quot; CASCADE</code> in
            Neon PostgreSQL, wiping all tables and data. This action cannot be undone.
          </p>
          <button
            onClick={handleDeleteProject}
            disabled={deletingProject}
            className="btn-danger"
            style={{ padding: '0.6rem 1.2rem' }}
          >
            {deletingProject ? 'Deleting Project...' : 'Delete Project & Drop Schema'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectSettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}>
      <ProjectSettingsContent />
    </Suspense>
  );
}

