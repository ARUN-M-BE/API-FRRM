'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ColumnInput {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  default: string;
}

const COLUMN_TYPES = ['text', 'int', 'bigint', 'bool', 'float', 'json', 'timestamp', 'uuid'];

export default function NewProjectPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'form' | 'json'>('form');

  // Form builder state
  const [name, setName] = useState('');
  const [apiName, setApiName] = useState('');
  const [apiVersion, setApiVersion] = useState('v1');
  const [checkUrl, setCheckUrl] = useState('');
  const [columns, setColumns] = useState<ColumnInput[]>([
    { name: 'title', type: 'text', required: true, unique: false, default: '' },
    { name: 'price', type: 'float', required: true, unique: false, default: '' },
  ]);

  // Notification channels
  const [channelType, setChannelType] = useState('telegram');
  const [channelTarget, setChannelTarget] = useState('');
  const [channels, setChannels] = useState<{ type: string; target: string }[]>([]);

  // Raw JSON mode
  const [jsonBlob, setJsonBlob] = useState(
    JSON.stringify(
      {
        name: 'ecommerce_store',
        apis: [
          {
            name: 'products',
            version: 'v1',
            check_url: 'https://httpbin.org/status/200',
            columns: [
              { name: 'title', type: 'text', required: true },
              { name: 'price', type: 'float', required: true },
              { name: 'in_stock', type: 'bool', default: true },
            ],
          },
        ],
        notify_channels: [],
      },
      null,
      2
    )
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Database configuration
  const [databaseUrl, setDatabaseUrl] = useState('');
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; latencyMs?: number; error?: string } | null>(null);

  const testExternalDb = async () => {
    if (!databaseUrl.trim()) return;
    setTestingDb(true);
    setDbTestResult(null);
    try {
      const res = await fetch('/api/projects/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database_url: databaseUrl.trim() }),
      });
      const data = await res.json();
      setDbTestResult(data);
    } catch (err: any) {
      setDbTestResult({ success: false, error: err.message });
    } finally {
      setTestingDb(false);
    }
  };

  const addColumn = () => {
    setColumns([...columns, { name: '', type: 'text', required: false, unique: false, default: '' }]);
  };

  const removeColumn = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const updateColumn = (idx: number, field: keyof ColumnInput, value: any) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], [field]: value };
    setColumns(updated);
  };

  const addChannel = () => {
    if (!channelTarget.trim()) return;
    setChannels([...channels, { type: channelType, target: channelTarget.trim() }]);
    setChannelTarget('');
  };

  const removeChannel = (idx: number) => {
    setChannels(channels.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let payload: any;

      if (activeTab === 'json') {
        try {
          payload = JSON.parse(jsonBlob);
        } catch {
          throw new Error('Invalid JSON format.');
        }
      } else {
        if (!name.trim()) throw new Error('Project name is required.');

        const apisList = [];
        if (apiName.trim()) {
          apisList.push({
            name: apiName.trim(),
            version: apiVersion.trim() || 'v1',
            check_url: checkUrl.trim() || null,
            columns: columns
              .filter((c) => c.name.trim() !== '')
              .map((c) => ({
                name: c.name.trim(),
                type: c.type,
                required: c.required,
                unique: c.unique,
                default: c.default.trim() !== '' ? c.default.trim() : null,
              })),
          });
        }

        payload = {
          name: name.trim(),
          database_url: databaseUrl.trim() || null,
          apis: apisList,
          notify_channels: channels,
        };
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      router.push(`/dashboard/${data.project.name}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href="/dashboard"
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          ← Back to Projects
        </Link>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: '0.5rem' }}>Create New Project</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Define your project schema, initial tables, and automated monitoring
        </p>
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

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('form')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'form' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'form' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Visual Form Builder
        </button>
        <button
          onClick={() => setActiveTab('json')}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'json' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'json' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Paste Raw JSON
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {activeTab === 'form' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Project Name Card */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                1. Project Identifier
              </h2>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Project Name (lowercase, letters, numbers, underscores only)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. shop_app"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase())}
                  required
                />
              </div>
            </div>

            {/* External Database Configuration (Optional) */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
                  2. Database Engine (Optional)
                </h2>
                <span className="badge-muted">PostgreSQL</span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Leave blank to automatically use the default Serverless Neon PostgreSQL database, or connect your own external PostgreSQL instance.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  External Database Connection String
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require"
                    value={databaseUrl}
                    onChange={(e) => setDatabaseUrl(e.target.value)}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={testExternalDb}
                    disabled={testingDb || !databaseUrl.trim()}
                    className="btn-secondary"
                    style={{ whiteSpace: 'nowrap', minWidth: '120px' }}
                  >
                    {testingDb ? 'Testing...' : 'Test Ping'}
                  </button>
                </div>

                {dbTestResult && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.85rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      background: dbTestResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      color: dbTestResult.success ? '#34d399' : '#fb7185',
                      border: `1px solid ${dbTestResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                    }}
                  >
                    {dbTestResult.success
                      ? `✓ Connection successful! Response latency: ${dbTestResult.latencyMs}ms`
                      : `✕ Connection failed: ${dbTestResult.error}`}
                  </div>
                )}
              </div>
            </div>

            {/* Initial API Definition */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                2. Initial API &amp; Table (Optional)
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    API / Table Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. products"
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value.toLowerCase())}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Version
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="v1"
                    value={apiVersion}
                    onChange={(e) => setApiVersion(e.target.value.toLowerCase())}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Health Check URL (Optional - monitored every 5 mins)
                </label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="https://example.com/health"
                  value={checkUrl}
                  onChange={(e) => setCheckUrl(e.target.value)}
                />
              </div>

              {/* Columns Builder */}
              {apiName && (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Schema Columns</span>
                    <button
                      type="button"
                      onClick={addColumn}
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                    >
                      + Add Column
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {columns.map((col, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto',
                          gap: '0.75rem',
                          alignItems: 'center',
                          background: 'rgba(0, 0, 0, 0.25)',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <input
                          type="text"
                          className="input-field"
                          placeholder="column_name"
                          value={col.name}
                          onChange={(e) => updateColumn(idx, 'name', e.target.value.toLowerCase())}
                        />
                        <select
                          className="input-field"
                          value={col.type}
                          onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                        >
                          {COLUMN_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                          <input
                            type="checkbox"
                            checked={col.required}
                            onChange={(e) => updateColumn(idx, 'required', e.target.checked)}
                          />
                          Required
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                          <input
                            type="checkbox"
                            checked={col.unique}
                            onChange={(e) => updateColumn(idx, 'unique', e.target.checked)}
                          />
                          Unique
                        </label>
                        <button
                          type="button"
                          onClick={() => removeColumn(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#fb7185',
                            cursor: 'pointer',
                            fontSize: '1rem',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Channels */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                3. Notification Channels (Optional)
              </h2>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <select
                  className="input-field"
                  style={{ width: '150px' }}
                  value={channelType}
                  onChange={(e) => setChannelType(e.target.value)}
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
                    channelType === 'telegram'
                      ? 'Telegram Chat ID'
                      : channelType === 'email'
                      ? 'email@domain.com'
                      : 'Webhook URL'
                  }
                  value={channelTarget}
                  onChange={(e) => setChannelTarget(e.target.value)}
                />
                <button
                  type="button"
                  onClick={addChannel}
                  className="btn-secondary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Add
                </button>
              </div>

              {channels.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {channels.map((ch, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(0, 0, 0, 0.2)',
                        padding: '0.5rem 0.8rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span>
                        <strong>{ch.type.toUpperCase()}:</strong> {ch.target}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeChannel(idx)}
                        style={{ background: 'transparent', border: 'none', color: '#fb7185', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Paste your project schema JSON:
            </label>
            <textarea
              className="input-field"
              rows={16}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.4 }}
              value={jsonBlob}
              onChange={(e) => setJsonBlob(e.target.value)}
            />
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <Link href="/dashboard" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth: '150px' }}>
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}

