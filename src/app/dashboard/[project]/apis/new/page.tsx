'use client';

import { useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ColumnInput {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  default: string;
}

const COLUMN_TYPES = ['text', 'int', 'bigint', 'bool', 'float', 'json', 'timestamp', 'uuid'];

function AddApiContent() {
  const params = useParams();
  const projectName = (params?.project as string) || '';
  const router = useRouter();

  const [name, setName] = useState('');
  const [version, setVersion] = useState('v1');
  const [checkUrl, setCheckUrl] = useState('');
  const [columns, setColumns] = useState<ColumnInput[]>([
    { name: 'name', type: 'text', required: true, unique: false, default: '' },
    { name: 'details', type: 'json', required: false, unique: false, default: '' },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!name.trim()) throw new Error('API name is required.');

      const validColumns = columns
        .filter((c) => c.name.trim() !== '')
        .map((c) => ({
          name: c.name.trim(),
          type: c.type,
          required: c.required,
          unique: c.unique,
          default: c.default.trim() !== '' ? c.default.trim() : null,
        }));

      if (validColumns.length === 0) {
        throw new Error('At least one column definition is required.');
      }

      const res = await fetch(`/api/projects/${projectName}/apis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          version: version.trim() || 'v1',
          check_url: checkUrl.trim() || null,
          columns: validColumns,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add API');
      }

      router.push(`/dashboard/${projectName}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href={`/dashboard/${projectName}`}
          style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}
        >
          ← Back to {projectName}
        </Link>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem' }}>
          Add New API / Table
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Create a new table in the <code>&quot;{projectName}&quot;</code> schema and expose REST endpoints.
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                API / Table Name (lowercase)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. orders"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                required
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
                value={version}
                onChange={(e) => setVersion(e.target.value.toLowerCase())}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Health Check URL (Optional)
            </label>
            <input
              type="url"
              className="input-field"
              placeholder="https://example.com/health"
              value={checkUrl}
              onChange={(e) => setCheckUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Schema Columns</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Note: <code>id (UUID)</code>, <code>created_at</code>, and <code>updated_at</code> are added automatically.
              </p>
            </div>
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
                  required
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <Link href={`/dashboard/${projectName}`} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating Table...' : 'Create API Table'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AddApiPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}>
      <AddApiContent />
    </Suspense>
  );
}

