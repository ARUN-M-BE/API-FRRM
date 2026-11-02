'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface HistoryItem {
  id: string;
  method: string;
  url: string;
  status: number;
  timeMs: number;
  timestamp: string;
}

function ApiTesterComponent() {
  const searchParams = useSearchParams();

  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([]);
  const [body, setBody] = useState('{\n  \n}');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    timeMs: number;
    headers: Record<string, string>;
    data: any;
  } | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const copyAsCurl = () => {
    if (!url.trim()) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = url.startsWith('http') ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;

    const headersList: string[] = ['-H "Content-Type: application/json"'];
    if (apiKey.trim()) {
      headersList.push(`-H "x-api-key: ${apiKey.trim()}"`);
    }
    customHeaders.forEach((h) => {
      if (h.key.trim()) {
        headersList.push(`-H "${h.key.trim()}: ${h.value}"`);
      }
    });

    let curlCmd = `curl -X ${method} "${fullUrl}" \\\n  ${headersList.join(' \\\n  ')}`;
    if (['POST', 'PUT', 'PATCH'].includes(method) && body.trim()) {
      curlCmd += ` \\\n  -d '${body.trim()}'`;
    }

    navigator.clipboard.writeText(curlCmd);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  useEffect(() => {
    const urlParam = searchParams.get('url');
    const keyParam = searchParams.get('key');
    if (urlParam) setUrl(urlParam);
    if (keyParam) setApiKey(keyParam);
  }, [searchParams]);

  const addHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeHeader = (idx: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== idx));
  };

  const updateHeader = (idx: number, field: 'key' | 'value', val: string) => {
    const updated = [...customHeaders];
    updated[idx][field] = val;
    setCustomHeaders(updated);
  };

  const handleSend = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setResponse(null);

    const startTime = performance.now();
    try {
      const headersObj: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (apiKey.trim()) {
        headersObj['x-api-key'] = apiKey.trim();
      }

      customHeaders.forEach((h) => {
        if (h.key.trim()) {
          headersObj[h.key.trim()] = h.value;
        }
      });

      const options: RequestInit = {
        method,
        headers: headersObj,
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && body.trim()) {
        options.body = body;
      }

      const res = await fetch(url, options);
      const timeMs = Math.round(performance.now() - startTime);

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((val, k) => {
        resHeaders[k] = val;
      });

      let responseData: any;
      const text = await res.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        timeMs,
        headers: resHeaders,
        data: responseData,
      });

      // Add to history
      setHistory((prev) => [
        {
          id: Math.random().toString(36).substring(7),
          method,
          url,
          status: res.status,
          timeMs,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - startTime);
      setResponse({
        status: 0,
        statusText: 'Network / Fetch Error',
        timeMs,
        headers: {},
        data: { error: err.message },
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return '#34d399';
    if (status >= 300 && status < 400) return '#60a5fa';
    if (status >= 400 && status < 500) return '#fbbf24';
    return '#fb7185';
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 0' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>API Tester</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Interactive REST request workbench for testing your generated endpoints
          </p>
        </div>
        <Link href="/dashboard" className="btn-secondary" style={{ fontSize: '0.85rem' }}>
          Back to Dashboard
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Main Request Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Method & URL bar */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              className="input-field"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ width: '120px', fontWeight: 700 }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>

            <input
              type="text"
              className="input-field"
              placeholder="/api/p/{project}/{version}/{api}"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1, fontFamily: 'monospace' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSend}
                disabled={loading || !url.trim()}
                className="btn-primary"
                style={{ minWidth: '90px' }}
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
              <button
                type="button"
                onClick={copyAsCurl}
                disabled={!url.trim()}
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
              >
                {copiedCurl ? '✓ Copied' : '📋 cURL'}
              </button>
            </div>
          </div>

          {/* Authentication & Headers */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Headers &amp; Auth</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                x-api-key Header (Project API Key)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="frrm_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            {/* Custom Headers */}
            {customHeaders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {customHeaders.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Header Key"
                      value={h.key}
                      onChange={(e) => updateHeader(i, 'key', e.target.value)}
                    />
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Header Value"
                      value={h.value}
                      onChange={(e) => updateHeader(i, 'value', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeHeader(i)}
                      style={{ background: 'transparent', border: 'none', color: '#fb7185', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addHeader}
              className="btn-secondary"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              + Add Custom Header
            </button>
          </div>

          {/* Request Body (for POST, PUT, PATCH) */}
          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>JSON Body</h3>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      setBody(JSON.stringify(JSON.parse(body), null, 2));
                    } catch {}
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  Prettify
                </button>
              </div>
              <textarea
                className="input-field"
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
            </div>
          )}

          {/* Response Inspector */}
          {response && (
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: getStatusColor(response.status),
                      border: `1px solid ${getStatusColor(response.status)}40`,
                    }}
                  >
                    {response.status} {response.statusText}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ⏱ {response.timeMs} ms
                  </span>
                </div>
              </div>

              <pre
                style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.85rem',
                  overflowX: 'auto',
                  color: '#e2e8f0',
                  maxHeight: '400px',
                  lineHeight: 1.4,
                }}
              >
                {typeof response.data === 'string'
                  ? response.data
                  : JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Sidebar History */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Recent Requests</h3>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No requests sent yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setMethod(item.method);
                    setUrl(item.url);
                  }}
                  style={{
                    padding: '0.5rem 0.6rem',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: '1px solid var(--border)',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color:
                          item.method === 'GET'
                            ? '#34d399'
                            : item.method === 'POST'
                            ? '#60a5fa'
                            : item.method === 'DELETE'
                            ? '#f87171'
                            : '#fbbf24',
                      }}
                    >
                      {item.method}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: getStatusColor(item.status) }}>
                      {item.status} ({item.timeMs}ms)
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace',
                    }}
                  >
                    {item.url}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApiTesterPage() {
  return (
    <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center' }}>Loading tester...</div>}>
      <ApiTesterComponent />
    </Suspense>
  );
}

