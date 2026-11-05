'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Compass,
  Zap,
  Activity,
  Play,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  Code,
  Terminal,
  BarChart3,
  ExternalLink,
  X,
  FileDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { DiscoveredApi, generateCurlCommand } from '@/lib/curl';
import { importCurl } from '@/lib/importers';

interface AnalyticsData {
  summary: {
    totalApis: number;
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
    avgLatencyMs: number;
    overallSuccessRate: number;
    totalChecksLogged: number;
  };
  distribution: { label: string; count: number; color: string }[];
  latencyTrends: { time: string; latency_ms: number; passed: boolean }[];
  alerts: {
    id: string;
    api_name: string;
    endpoint: string;
    event_type: 'FAILURE' | 'RECOVERY' | 'DEGRADED';
    status_code: number | null;
    latency_ms: number | null;
    message: string;
    created_at: string;
  }[];
}

interface TestResponse {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  timestamp: string;
  headers: Record<string, string>;
  body: string;
  parsedJson?: any;
  error?: string;
}

export default function ApiExplorerPage() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'tester' | 'analytics'>('explorer');

  // Discovery data
  const [apis, setApis] = useState<DiscoveredApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Selected API for Details Drawer
  const [selectedApi, setSelectedApi] = useState<DiscoveredApi | null>(null);

  // cURL Secret Masking
  const [maskSecrets, setMaskSecrets] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tester State
  const [testMethod, setTestMethod] = useState<string>('GET');
  const [testUrl, setTestUrl] = useState<string>('');
  const [testHeaders, setTestHeaders] = useState<{ key: string; value: string; enabled: boolean }[]>([
    { key: 'Accept', value: 'application/json', enabled: true },
  ]);
  const [testParams, setTestParams] = useState<{ key: string; value: string; enabled: boolean }[]>([]);
  const [testAuthType, setTestAuthType] = useState<'none' | 'api-key' | 'bearer' | 'basic'>('none');
  const [testAuthConfig, setTestAuthConfig] = useState<Record<string, string>>({
    key: 'x-api-key',
    value: '',
    token: '',
    username: '',
    password: '',
  });
  const [testBodyType, setTestBodyType] = useState<'none' | 'json' | 'form' | 'raw'>('none');
  const [testBody, setTestBody] = useState<string>('{\n  \n}');
  const [activeTesterSubTab, setActiveTesterSubTab] = useState<'params' | 'headers' | 'auth' | 'body'>('params');

  // Tester Execution State
  const [testing, setTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<TestResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // cURL Import Modal
  const [showCurlImportModal, setShowCurlImportModal] = useState(false);
  const [curlImportText, setCurlImportText] = useState('');

  // Analytics data
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Real-time live status updates
  const [liveStreamConnected, setLiveStreamConnected] = useState(false);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string>('');
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(30);
  const [countdown, setCountdown] = useState<number>(30);

  // Canvas ref for Latency Trend Chart
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'alert' } | null>(null);
  const showToast = (message: string, type: 'success' | 'alert' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch Discovered APIs
  const fetchDiscoveredApis = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch('/api/explorer/discover');
      const data = await res.json();
      if (data.apis) {
        setApis(data.apis);
        setLastLiveUpdate(new Date().toLocaleTimeString());
      }
    } catch (err: any) {
      console.error('Fetch discovery error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch Analytics Data
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/explorer/analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchDiscoveredApis();
    fetchAnalytics();
  }, [fetchDiscoveredApis, fetchAnalytics]);

  // Server-Sent Events (SSE) Live Stream connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/monitor/stream');
      eventSource.onopen = () => {
        setLiveStreamConnected(true);
      };
      eventSource.addEventListener('init', (e) => {
        const payload = JSON.parse(e.data);
        if (payload.apis) {
          setApis(payload.apis);
          setLastLiveUpdate(new Date().toLocaleTimeString());
        }
      });
      eventSource.addEventListener('ping', () => {
        setLastLiveUpdate(new Date().toLocaleTimeString());
      });
      eventSource.onerror = () => {
        setLiveStreamConnected(false);
      };
    } catch {
      setLiveStreamConnected(false);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Auto-refresh countdown interval
  useEffect(() => {
    if (autoRefreshSecs <= 0) return;
    setCountdown(autoRefreshSecs);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchDiscoveredApis(true);
          return autoRefreshSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshSecs, fetchDiscoveredApis]);

  // Trigger Immediate Health Check on Single API
  const handlePingSingle = async (apiId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPingingId(apiId);
    try {
      const res = await fetch('/api/monitor/check-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_id: apiId.split('-')[0] }),
      });
      if (res.ok) {
        showToast('Probe completed. Metrics updated.', 'success');
        await fetchDiscoveredApis(true);
        await fetchAnalytics();
      }
    } catch (err: any) {
      showToast(`Ping failed: ${err.message}`, 'alert');
    } finally {
      setPingingId(null);
    }
  };

  // Trigger Health Check on All APIs
  const handlePingAll = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/monitor/check-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        showToast('All APIs verified successfully', 'success');
        await fetchDiscoveredApis(true);
        await fetchAnalytics();
      }
    } catch (err: any) {
      showToast(`Ping all failed: ${err.message}`, 'alert');
    } finally {
      setRefreshing(false);
    }
  };

  // Load Discovered API into the Postman-like Tester
  const loadApiIntoTester = (api: DiscoveredApi) => {
    setTestMethod(api.method);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    setTestUrl(api.endpoint.startsWith('http') ? api.endpoint : `${origin}${api.endpoint}`);

    // Headers
    const hdrs = (api.headers || []).map((h) => ({ key: h.key, value: h.value, enabled: true }));
    if (api.auth.type === 'api-key' && api.project_api_key) {
      hdrs.push({ key: api.auth.headerKey || 'x-api-key', value: api.project_api_key, enabled: true });
    }
    setTestHeaders(hdrs);

    // Params
    setTestParams((api.params || []).map((p) => ({ key: p.key, value: p.value, enabled: true })));

    // Auth
    if (api.auth.type === 'api-key') {
      setTestAuthType('api-key');
      setTestAuthConfig({
        key: api.auth.headerKey || 'x-api-key',
        value: api.project_api_key || '',
        token: '',
        username: '',
        password: '',
      });
    } else {
      setTestAuthType('none');
    }

    // Body
    if (api.bodySchema) {
      setTestBodyType('json');
      setTestBody(JSON.stringify(api.bodySchema, null, 2));
    } else {
      setTestBodyType('none');
      setTestBody('');
    }

    setTestResponse(null);
    setActiveTab('tester');
    showToast(`Loaded "${api.name}" into API Tester`);
  };

  // Execute Request in Tester
  const handleExecuteTest = async () => {
    if (!testUrl.trim()) {
      showToast('Please enter an endpoint URL', 'alert');
      return;
    }

    setTesting(true);
    setTestResponse(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build URL with query params
    let finalUrl = testUrl.trim();
    const activeParams = testParams.filter((p) => p.enabled && p.key.trim());
    if (activeParams.length > 0 && !finalUrl.includes('?')) {
      const qs = activeParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      finalUrl = `${finalUrl}?${qs}`;
    }

    // Headers
    const reqHeaders: Record<string, string> = {};
    for (const h of testHeaders) {
      if (h.enabled && h.key.trim()) reqHeaders[h.key.trim()] = h.value;
    }

    // Auth
    if (testAuthType === 'bearer' && testAuthConfig.token) {
      reqHeaders['authorization'] = `Bearer ${testAuthConfig.token}`;
    } else if (testAuthType === 'basic' && (testAuthConfig.username || testAuthConfig.password)) {
      const b64 = btoa(`${testAuthConfig.username || ''}:${testAuthConfig.password || ''}`);
      reqHeaders['authorization'] = `Basic ${b64}`;
    } else if (testAuthType === 'api-key' && testAuthConfig.key && testAuthConfig.value) {
      reqHeaders[testAuthConfig.key] = testAuthConfig.value;
    }

    if (testBodyType === 'json' && !reqHeaders['content-type']) {
      reqHeaders['content-type'] = 'application/json';
    }

    const startTime = performance.now();
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          method: testMethod,
          url: finalUrl,
          headers: Object.entries(reqHeaders).map(([key, value]) => ({ key, value, enabled: true })),
          body: testBodyType !== 'none' ? testBody : '',
          body_type: testBodyType,
          auth_type: testAuthType,
          auth_config: testAuthConfig,
        }),
      });

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      setTestResponse({
        status: data.status || res.status,
        statusText: data.statusText || res.statusText,
        timeMs: data.timeMs || elapsed,
        sizeBytes: data.sizeBytes || 0,
        timestamp: new Date().toLocaleTimeString(),
        headers: data.headers || {},
        body: typeof data.body === 'string' ? data.body : JSON.stringify(data.body, null, 2),
        parsedJson: data.parsedJson,
        error: data.error,
      });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setTestResponse({
        status: 0,
        statusText: err.name === 'AbortError' ? 'Request Cancelled' : 'Network Error',
        timeMs: elapsed,
        sizeBytes: 0,
        timestamp: new Date().toLocaleTimeString(),
        headers: {},
        body: err.message || 'Execution failed',
        error: err.message,
      });
    } finally {
      setTesting(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setTesting(false);
      showToast('Request cancelled by user');
    }
  };

  // Generate live cURL for current Tester configuration
  const liveTesterCurl = useMemo(() => {
    return generateCurlCommand(
      {
        method: testMethod as any,
        endpoint: testUrl || '/api',
        headers: testHeaders.filter((h) => h.enabled),
        params: testParams.filter((p) => p.enabled),
        bodySchema: testBodyType === 'json' ? (() => { try { return JSON.parse(testBody); } catch { return null; } })() : null,
        auth: {
          type: testAuthType,
          headerKey: testAuthConfig.key,
          description: '',
        },
        project_api_key: testAuthConfig.value,
      },
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      maskSecrets
    );
  }, [testMethod, testUrl, testHeaders, testParams, testBodyType, testBody, testAuthType, testAuthConfig, maskSecrets]);

  // Handle cURL Import
  const handleImportCurlCommand = () => {
    if (!curlImportText.trim()) return;
    try {
      const parsed = importCurl(curlImportText.trim());
      setTestMethod(parsed.method);
      setTestUrl(parsed.url);
      setTestHeaders(parsed.headers);
      setTestParams(parsed.params);
      if (parsed.body_content) {
        setTestBodyType(parsed.body_type === 'json' ? 'json' : 'raw');
        setTestBody(parsed.body_content);
      } else {
        setTestBodyType('none');
        setTestBody('');
      }
      setShowCurlImportModal(false);
      setCurlImportText('');
      showToast('cURL command imported successfully!');
    } catch (err: any) {
      alert(`Invalid cURL command: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('cURL command copied to clipboard');
  };

  // Filtered APIs list
  const filteredApis = useMemo(() => {
    return apis.filter((api) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = api.name.toLowerCase().includes(q);
        const matchesEndpoint = api.endpoint.toLowerCase().includes(q);
        const matchesDesc = api.description.toLowerCase().includes(q);
        const matchesProject = api.project_name?.toLowerCase().includes(q);
        if (!matchesName && !matchesEndpoint && !matchesDesc && !matchesProject) {
          return false;
        }
      }
      if (categoryFilter !== 'all' && api.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && api.status !== statusFilter) return false;
      if (methodFilter !== 'all' && api.method !== methodFilter) return false;
      return true;
    });
  }, [apis, searchQuery, categoryFilter, statusFilter, methodFilter]);

  // Summary counts
  const summaryCounts = useMemo(() => {
    return {
      total: apis.length,
      healthy: apis.filter((a) => a.status === 'Healthy').length,
      degraded: apis.filter((a) => a.status === 'Degraded').length,
      down: apis.filter((a) => a.status === 'Down').length,
      unknown: apis.filter((a) => a.status === 'Unknown').length,
    };
  }, [apis]);

  // Render Latency Trend Chart on Canvas
  useEffect(() => {
    if (activeTab !== 'analytics' || !analytics || !chartCanvasRef.current) return;
    const canvas = chartCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = analytics.latencyTrends;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting live monitoring data...', width / 2, height / 2);
      return;
    }

    const maxLatency = Math.max(...data.map((d) => d.latency_ms), 100);
    const stepX = width / Math.max(data.length - 1, 1);

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    grad.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    ctx.beginPath();
    ctx.moveTo(0, height);

    data.forEach((pt, i) => {
      const x = i * stepX;
      const y = height - (pt.latency_ms / maxLatency) * (height - 30) - 15;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    data.forEach((pt, i) => {
      const x = i * stepX;
      const y = height - (pt.latency_ms / maxLatency) * (height - 30) - 15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Data points
    data.forEach((pt, i) => {
      const x = i * stepX;
      const y = height - (pt.latency_ms / maxLatency) * (height - 30) - 15;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = pt.passed ? '#10b981' : '#f43f5e';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [activeTab, analytics]);

  const getMethodBadgeClass = (m: string) => {
    switch (m) {
      case 'GET': return 'badge-method-get';
      case 'POST': return 'badge-method-post';
      case 'PUT': return 'badge-method-put';
      case 'PATCH': return 'badge-method-patch';
      case 'DELETE': return 'badge-method-delete';
      default: return 'badge-muted';
    }
  };

  const getStatusBadge = (status: DiscoveredApi['status']) => {
    switch (status) {
      case 'Healthy':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 9999, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontSize: '0.75rem', fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Healthy
          </span>
        );
      case 'Degraded':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 9999, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.75rem', fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Degraded
          </span>
        );
      case 'Down':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 9999, background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)', fontSize: '0.75rem', fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} />
            Down
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 9999, background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.25)', fontSize: '0.75rem', fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6b7280', display: 'inline-block' }} />
            Unknown
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Compass size={28} color="#818cf8" />
              API Explorer &amp; Real-Time Health
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: liveStreamConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: liveStreamConnected ? '#34d399' : '#818cf8',
                border: `1px solid ${liveStreamConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
              }}
            >
              <Radio size={12} className={liveStreamConnected ? 'spinner' : ''} />
              {liveStreamConnected ? 'LIVE STREAM' : 'AUTO-POLL'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.3rem' }}>
            Automatic endpoint discovery, real-time visual health monitoring, and Postman-style interactive testing with instant cURL generation.
          </p>
        </div>

        {/* Global Action & Refresh Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-ping:</span>
            <select
              value={autoRefreshSecs}
              onChange={(e) => setAutoRefreshSecs(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              <option value={10} style={{ background: '#12141a' }}>10s</option>
              <option value={30} style={{ background: '#12141a' }}>30s</option>
              <option value={60} style={{ background: '#12141a' }}>60s</option>
              <option value={0} style={{ background: '#12141a' }}>Off</option>
            </select>
            {autoRefreshSecs > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, minWidth: '24px' }}>
                ({countdown}s)
              </span>
            )}
          </div>

          <button
            onClick={() => setMaskSecrets(!maskSecrets)}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.55rem 0.9rem' }}
            title="Toggle masking of API keys and auth tokens in cURL and UI"
          >
            {maskSecrets ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{maskSecrets ? 'Masked' : 'Revealed'}</span>
          </button>

          <button
            onClick={handlePingAll}
            disabled={refreshing}
            className="btn-primary"
            style={{ fontSize: '0.85rem', padding: '0.55rem 1.1rem' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spinner' : ''} />
            <span>{refreshing ? 'Pinging All...' : 'Ping All APIs'}</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button
          onClick={() => setActiveTab('explorer')}
          style={{
            padding: '0.75rem 1.4rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'explorer' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'explorer' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Compass size={17} color={activeTab === 'explorer' ? '#818cf8' : 'currentColor'} />
          <span>API Discovery &amp; Health Cards</span>
          <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '10px', background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
            {apis.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tester')}
          style={{
            padding: '0.75rem 1.4rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'tester' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'tester' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Zap size={17} color={activeTab === 'tester' ? '#818cf8' : 'currentColor'} />
          <span>Postman-Like Tester &amp; cURL</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('analytics');
            fetchAnalytics();
          }}
          style={{
            padding: '0.75rem 1.4rem',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'analytics' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'analytics' ? '#fff' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <BarChart3 size={17} color={activeTab === 'analytics' ? '#818cf8' : 'currentColor'} />
          <span>Real-Time Analytics &amp; Incident Logs</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: API DISCOVERY & HEALTH CARDS (NO TRADITIONAL TABLE!) */}
      {/* ============================================================ */}
      {activeTab === 'explorer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Metrics Overview Ribbon */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
              gap: '1rem',
            }}
          >
            <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Discovered Endpoints
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
                {summaryCounts.total}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: '0.1rem' }}>
                100% Real Live Routes
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Healthy APIs
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>
                {summaryCounts.healthy}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Fast &amp; Operational
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Degraded
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.2rem' }}>
                {summaryCounts.degraded}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Latency &gt; 500ms
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Down / Outages
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fb7185', marginTop: '0.2rem' }}>
                {summaryCounts.down}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Failing health probe
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Last Verified
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginTop: '0.35rem' }}>
                {lastLiveUpdate || 'Just now'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.1rem' }}>
                ● Auto-sync active
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div
            className="glass-panel"
            style={{
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 'min(100%, 280px)' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search API name, path, schema or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.2rem', width: '100%', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="all" style={{ background: '#12141a' }}>All Categories</option>
                <option value="Generated REST APIs" style={{ background: '#12141a' }}>Generated REST APIs</option>
                <option value="Platform APIs" style={{ background: '#12141a' }}>Platform APIs</option>
                <option value="API Client" style={{ background: '#12141a' }}>API Client</option>
                <option value="Auth &amp; Security" style={{ background: '#12141a' }}>Auth &amp; Security</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="all" style={{ background: '#12141a' }}>All Statuses</option>
                <option value="Healthy" style={{ background: '#12141a' }}>🟢 Healthy</option>
                <option value="Degraded" style={{ background: '#12141a' }}>🟡 Degraded</option>
                <option value="Down" style={{ background: '#12141a' }}>🔴 Down</option>
                <option value="Unknown" style={{ background: '#12141a' }}>⚪ Unknown</option>
              </select>

              {/* Method Filter */}
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="all" style={{ background: '#12141a' }}>All Methods</option>
                <option value="GET" style={{ background: '#12141a' }}>GET</option>
                <option value="POST" style={{ background: '#12141a' }}>POST</option>
                <option value="PUT" style={{ background: '#12141a' }}>PUT</option>
                <option value="PATCH" style={{ background: '#12141a' }}>PATCH</option>
                <option value="DELETE" style={{ background: '#12141a' }}>DELETE</option>
              </select>
            </div>
          </div>

          {/* Real-Time Modern API Health Cards Grid (NO TABLES!) */}
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={28} className="spinner" style={{ margin: '0 auto 1rem' }} />
              <div>Discovering project APIs and compiling health telemetry...</div>
            </div>
          ) : filteredApis.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🔍</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>No APIs Matched Your Criteria</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', margin: '0.5rem auto 1.5rem' }}>
                Try adjusting your search query, method, category, or health status filter to inspect other endpoints.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setMethodFilter('all');
                }}
                className="btn-secondary"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))',
                gap: '1.25rem',
              }}
            >
              {filteredApis.map((api) => {
                const isPinging = pingingId === api.id;
                const isCopied = copiedId === api.id;
                const curlCmd = generateCurlCommand(api, typeof window !== 'undefined' ? window.location.origin : '', maskSecrets);

                return (
                  <div
                    key={api.id}
                    className="glass-panel glass-panel-hover"
                    onClick={() => setSelectedApi(api)}
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      borderLeft: `4px solid ${
                        api.status === 'Healthy'
                          ? '#10b981'
                          : api.status === 'Degraded'
                          ? '#f59e0b'
                          : api.status === 'Down'
                          ? '#f43f5e'
                          : '#6b7280'
                      }`,
                      transition: 'transform 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    {/* Card Top: Method badge, Category & Health Indicator */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={getMethodBadgeClass(api.method)}>
                          {api.method}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#a0a0b0', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4, fontWeight: 500 }}>
                          {api.category}
                        </span>
                      </div>
                      {getStatusBadge(api.status)}
                    </div>

                    {/* API Title & Endpoint */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{api.name}</span>
                        {api.version && (
                          <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600 }}>
                            {api.version}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: '#93c5fd',
                          background: 'rgba(0,0,0,0.3)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          marginTop: '0.35rem',
                          wordBreak: 'break-all',
                        }}
                      >
                        {api.endpoint}
                      </div>
                    </div>

                    {/* Short Description */}
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1rem', lineHeight: 1.4, flex: 1 }}>
                      {api.description}
                    </p>

                    {/* Real-time Health Telemetry Metrics */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '0.5rem',
                        padding: '0.65rem 0.75rem',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: 8,
                        marginBottom: '0.85rem',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                      }}
                    >
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Last Latency</div>
                        <div style={{ fontWeight: 700, color: api.latest_latency_ms && api.latest_latency_ms > 500 ? '#fbbf24' : '#34d399', fontSize: '0.9rem', marginTop: 2 }}>
                          {api.latest_latency_ms !== null ? `${api.latest_latency_ms}ms` : '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Avg Latency</div>
                        <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.9rem', marginTop: 2 }}>
                          {api.avg_latency_ms > 0 ? `${api.avg_latency_ms}ms` : '—'}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Uptime</div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem', marginTop: 2 }}>
                          {api.uptime_percent}%
                        </div>
                      </div>
                    </div>

                    {/* Consecutive Failures / Status Code */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      <span>
                        Status Code:{' '}
                        <strong style={{ color: api.latest_status_code && api.latest_status_code < 400 ? '#34d399' : '#fb7185' }}>
                          {api.latest_status_code ? `HTTP ${api.latest_status_code}` : 'No checks'}
                        </strong>
                      </span>
                      <span>
                        {api.consecutive_failures > 0 ? (
                          <span style={{ color: '#fb7185', fontWeight: 600 }}>⚠️ {api.consecutive_failures} failure(s)</span>
                        ) : (
                          <span style={{ color: '#34d399' }}>0 failures</span>
                        )}
                      </span>
                    </div>

                    {/* 30-Check Mini Uptime Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '1rem', height: '14px' }}>
                      {api.check_history && api.check_history.length > 0 ? (
                        api.check_history.map((check, idx) => (
                          <div
                            key={idx}
                            title={`${check.status_code} (${check.latency_ms}ms) at ${new Date(check.checked_at).toLocaleTimeString()}`}
                            style={{
                              flex: 1,
                              height: '100%',
                              borderRadius: 2,
                              background: check.is_up ? '#10b981' : '#f43f5e',
                              opacity: 0.85,
                            }}
                          />
                        ))
                      ) : (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Awaiting health checks
                        </div>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => loadApiIntoTester(api)}
                        className="btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', flex: 1, minWidth: '100px' }}
                      >
                        <Zap size={13} />
                        <span>Test API</span>
                      </button>

                      <button
                        onClick={() => copyToClipboard(curlCmd, api.id)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                        title="Copy cURL command"
                      >
                        {isCopied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
                        <span>{isCopied ? 'Copied' : 'cURL'}</span>
                      </button>

                      <button
                        onClick={(e) => handlePingSingle(api.id, e)}
                        disabled={isPinging}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                        title="Ping health check now"
                      >
                        <RefreshCw size={13} className={isPinging ? 'spinner' : ''} />
                        <span>{isPinging ? 'Pinging' : 'Ping'}</span>
                      </button>

                      <button
                        onClick={() => setSelectedApi(api)}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}
                        title="View details & history"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: POSTMAN-LIKE API TESTER & SYNCHRONIZED cURL GENERATOR */}
      {/* ============================================================ */}
      {activeTab === 'tester' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Tester Control & URL Bar */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>Interactive API Client</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• Execute HTTP requests directly from the browser</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setShowCurlImportModal(true)}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                >
                  <FileDown size={14} />
                  <span>Import cURL</span>
                </button>
                <button
                  onClick={() => copyToClipboard(liveTesterCurl, 'live-tester-curl')}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                >
                  {copiedId === 'live-tester-curl' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  <span>Copy cURL</span>
                </button>
              </div>
            </div>

            {/* Method & URL Input */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <select
                value={testMethod}
                onChange={(e) => setTestMethod(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border)',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: 8,
                  padding: '0.65rem 1rem',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
                  <option key={m} value={m} style={{ background: '#12141a', color: '#fff' }}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                placeholder="Enter request URL e.g. http://localhost:3000/api/projects"
                className="input-field"
                style={{ flex: 1, minWidth: 'min(100%, 280px)', fontFamily: 'monospace' }}
              />

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleExecuteTest}
                  disabled={testing}
                  className="btn-primary"
                  style={{ minWidth: '110px' }}
                >
                  {testing ? (
                    <>
                      <RefreshCw size={15} className="spinner" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} fill="currentColor" />
                      <span>Send</span>
                    </>
                  )}
                </button>

                {testing && (
                  <button
                    onClick={handleCancelTest}
                    className="btn-danger"
                    style={{ padding: '0.6rem 0.9rem' }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Synchronized Live cURL Preview Card */}
          <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: '#818cf8' }}>
                <Terminal size={14} />
                <span>Live Synchronized cURL Command</span>
              </div>
              <button
                onClick={() => copyToClipboard(liveTesterCurl, 'live-tester-curl-2')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {copiedId === 'live-tester-curl-2' ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '0.75rem 1rem',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.45)',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                color: '#93c5fd',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {liveTesterCurl}
            </pre>
          </div>

          {/* Two Pane Layout: Request Parameters / Body & Response Viewer */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', gap: '1.25rem', alignItems: 'start' }}>
            {/* Left Pane: Request Options */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '440px' }}>
              {/* Subtabs */}
              <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
                {(['params', 'headers', 'auth', 'body'] as const).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setActiveTesterSubTab(sub)}
                    style={{
                      padding: '0.4rem 0.9rem',
                      background: activeTesterSubTab === sub ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      color: activeTesterSubTab === sub ? '#fff' : 'var(--text-muted)',
                      border: activeTesterSubTab === sub ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {sub}
                    {sub === 'headers' && ` (${testHeaders.filter((h) => h.enabled).length})`}
                    {sub === 'params' && ` (${testParams.filter((p) => p.enabled).length})`}
                  </button>
                ))}
              </div>

              {/* Subtab: Query Parameters */}
              {activeTesterSubTab === 'params' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    Query Parameters (appended to URL as ?key=value)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {testParams.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => {
                            const updated = [...testParams];
                            updated[idx].enabled = e.target.checked;
                            setTestParams(updated);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Key"
                          value={p.key}
                          onChange={(e) => {
                            const updated = [...testParams];
                            updated[idx].key = e.target.value;
                            setTestParams(updated);
                          }}
                          className="input-field"
                          style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={p.value}
                          onChange={(e) => {
                            const updated = [...testParams];
                            updated[idx].value = e.target.value;
                            setTestParams(updated);
                          }}
                          className="input-field"
                          style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                        />
                        <button
                          onClick={() => setTestParams(testParams.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '4px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setTestParams([...testParams, { key: '', value: '', enabled: true }])}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', alignSelf: 'flex-start' }}
                  >
                    + Add Parameter
                  </button>
                </div>
              )}

              {/* Subtab: Headers */}
              {activeTesterSubTab === 'headers' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    HTTP Request Headers
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {testHeaders.map((h, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => {
                            const updated = [...testHeaders];
                            updated[idx].enabled = e.target.checked;
                            setTestHeaders(updated);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Header Name"
                          value={h.key}
                          onChange={(e) => {
                            const updated = [...testHeaders];
                            updated[idx].key = e.target.value;
                            setTestHeaders(updated);
                          }}
                          className="input-field"
                          style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                        />
                        <input
                          type="text"
                          placeholder="Value"
                          value={h.value}
                          onChange={(e) => {
                            const updated = [...testHeaders];
                            updated[idx].value = e.target.value;
                            setTestHeaders(updated);
                          }}
                          className="input-field"
                          style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                        />
                        <button
                          onClick={() => setTestHeaders(testHeaders.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: '4px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setTestHeaders([...testHeaders, { key: '', value: '', enabled: true }])}
                    className="btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', alignSelf: 'flex-start' }}
                  >
                    + Add Header
                  </button>
                </div>
              )}

              {/* Subtab: Auth */}
              {activeTesterSubTab === 'auth' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      Authorization Type
                    </label>
                    <select
                      value={testAuthType}
                      onChange={(e) => setTestAuthType(e.target.value as any)}
                      className="input-field"
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    >
                      <option value="none">No Auth</option>
                      <option value="api-key">API Key (Header)</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                  </div>

                  {testAuthType === 'api-key' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Header Name"
                        value={testAuthConfig.key}
                        onChange={(e) => setTestAuthConfig({ ...testAuthConfig, key: e.target.value })}
                        className="input-field"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                      <input
                        type={maskSecrets ? 'password' : 'text'}
                        placeholder="Key Value"
                        value={testAuthConfig.value}
                        onChange={(e) => setTestAuthConfig({ ...testAuthConfig, value: e.target.value })}
                        className="input-field"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                    </div>
                  )}

                  {testAuthType === 'bearer' && (
                    <div>
                      <input
                        type={maskSecrets ? 'password' : 'text'}
                        placeholder="Bearer Token"
                        value={testAuthConfig.token}
                        onChange={(e) => setTestAuthConfig({ ...testAuthConfig, token: e.target.value })}
                        className="input-field"
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  )}

                  {testAuthType === 'basic' && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Username"
                        value={testAuthConfig.username}
                        onChange={(e) => setTestAuthConfig({ ...testAuthConfig, username: e.target.value })}
                        className="input-field"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                      <input
                        type={maskSecrets ? 'password' : 'text'}
                        placeholder="Password"
                        value={testAuthConfig.password}
                        onChange={(e) => setTestAuthConfig({ ...testAuthConfig, password: e.target.value })}
                        className="input-field"
                        style={{ flex: 1, fontSize: '0.85rem' }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Subtab: Body */}
              {activeTesterSubTab === 'body' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {(['none', 'json', 'raw'] as const).map((bt) => (
                        <button
                          key={bt}
                          onClick={() => setTestBodyType(bt)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: testBodyType === bt ? 'rgba(99,102,241,0.2)' : 'transparent',
                            color: testBodyType === bt ? '#fff' : 'var(--text-muted)',
                            border: testBodyType === bt ? '1px solid #6366f1' : '1px solid transparent',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                          }}
                        >
                          {bt}
                        </button>
                      ))}
                    </div>

                    {testBodyType === 'json' && (
                      <button
                        onClick={() => {
                          try {
                            setTestBody(JSON.stringify(JSON.parse(testBody), null, 2));
                          } catch {
                            showToast('Invalid JSON syntax', 'alert');
                          }
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Format JSON
                      </button>
                    )}
                  </div>

                  {testBodyType !== 'none' ? (
                    <textarea
                      value={testBody}
                      onChange={(e) => setTestBody(e.target.value)}
                      placeholder='{\n  "key": "value"\n}'
                      className="input-field"
                      style={{
                        flex: 1,
                        minHeight: '220px',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                        resize: 'vertical',
                      }}
                    />
                  ) : (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      This request does not have a body (Body Type: None)
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Pane: Real Response Viewer */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '440px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Response Payload</span>

                {testResponse ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 700,
                        background: testResponse.status >= 200 && testResponse.status < 300 ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                        color: testResponse.status >= 200 && testResponse.status < 300 ? '#34d399' : '#fb7185',
                        border: `1px solid ${testResponse.status >= 200 && testResponse.status < 300 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                      }}
                    >
                      {testResponse.status} {testResponse.statusText}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>⏱ {testResponse.timeMs} ms</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      📦 {testResponse.sizeBytes < 1024 ? `${testResponse.sizeBytes} B` : `${(testResponse.sizeBytes / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Awaiting execution</span>
                )}
              </div>

              {testResponse ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <pre
                    style={{
                      flex: 1,
                      margin: 0,
                      padding: '0.85rem',
                      borderRadius: 6,
                      background: 'rgba(0, 0, 0, 0.45)',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: testResponse.status >= 400 ? '#fca5a5' : '#93c5fd',
                      overflowY: 'auto',
                      maxHeight: '380px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {testResponse.parsedJson
                      ? JSON.stringify(testResponse.parsedJson, null, 2)
                      : testResponse.body || '(empty body)'}
                  </pre>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  <Zap size={32} color="#6366f1" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>No Active Response</div>
                  <p style={{ fontSize: '0.8rem', maxWidth: '300px', marginTop: '0.25rem' }}>
                    Select an API from the Explorer or click &quot;Send&quot; to test your endpoint in real-time.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: REAL-TIME ANALYTICS & INCIDENT LOGS */}
      {/* ============================================================ */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: '1.25rem' }}>
            {/* Real Latency Trend Canvas Chart */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>API Response-Time Trends</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Latency progression over time from real probe logs (green = pass, red = fail)
                  </p>
                </div>
                <span className="badge-muted">{analytics?.latencyTrends.length || 0} Points</span>
              </div>
              <canvas
                ref={chartCanvasRef}
                width={800}
                height={220}
                style={{ width: '100%', height: '220px', borderRadius: 8, background: 'rgba(0,0,0,0.25)' }}
              />
            </div>

            {/* Health Distribution & Success Rate */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.2rem' }}>Health &amp; Success Ratio</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '1.25rem' }}>
                  Distribution of Healthy vs Degraded vs Down endpoints
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(analytics?.distribution || []).map((item) => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600 }}>{item.label}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{item.count} APIs</span>
                      </div>
                      <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${apis.length > 0 ? (item.count / apis.length) * 100 : 0}%`,
                            background: item.color,
                            borderRadius: '4px',
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
                    {analytics?.summary.overallSuccessRate || 100}%
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Success Rate
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>
                    {analytics?.summary.avgLatencyMs || 0}ms
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Avg Response Time
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                    {analytics?.summary.totalChecksLogged || 0}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Total Checks
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Alert Events & Failure/Recovery History */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Real-Time Failure &amp; Recovery Logs</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Live incident timeline tracking failures, slow response alerts, and service recoveries
                </p>
              </div>
              <button
                onClick={fetchAnalytics}
                className="btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
              >
                <RefreshCw size={13} className={loadingAnalytics ? 'spinner' : ''} />
                <span>Refresh Log</span>
              </button>
            </div>

            {loadingAnalytics ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading incident logs...
              </div>
            ) : !analytics || analytics.alerts.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 0.5rem', opacity: 0.7 }} />
                <div style={{ color: '#fff', fontWeight: 600 }}>Zero Active Incidents</div>
                <p style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                  All systems operating within acceptable latency and error thresholds.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {analytics.alerts.map((al) => (
                  <div
                    key={al.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      borderLeft: `4px solid ${
                        al.event_type === 'RECOVERY'
                          ? '#10b981'
                          : al.event_type === 'DEGRADED'
                          ? '#f59e0b'
                          : '#f43f5e'
                      }`,
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {al.event_type === 'RECOVERY' ? (
                        <CheckCircle2 size={18} color="#10b981" />
                      ) : al.event_type === 'DEGRADED' ? (
                        <AlertTriangle size={18} color="#f59e0b" />
                      ) : (
                        <XCircle size={18} color="#f43f5e" />
                      )}

                      <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>
                          {al.message}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {al.endpoint}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div>{new Date(al.created_at).toLocaleTimeString()}</div>
                      <div>{new Date(al.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* API DETAILS MODAL / DRAWER */}
      {/* ============================================================ */}
      {selectedApi && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setSelectedApi(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 'min(760px, 94vw)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#0e1017',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.35rem' }}>
                  <span className={getMethodBadgeClass(selectedApi.method)}>
                    {selectedApi.method}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedApi.category}</span>
                  {getStatusBadge(selectedApi.status)}
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                  {selectedApi.name}
                </h2>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: '#93c5fd',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '4px 8px',
                    borderRadius: 6,
                    marginTop: '0.4rem',
                    wordBreak: 'break-all',
                  }}
                >
                  {selectedApi.endpoint}
                </div>
              </div>

              <button
                onClick={() => setSelectedApi(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Description */}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
              {selectedApi.description}
            </p>

            {/* Metrics Ribbon */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '0.75rem',
                padding: '0.85rem',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                textAlign: 'center',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Latest Latency</div>
                <div style={{ fontWeight: 700, color: '#34d399', fontSize: '1rem', marginTop: 2 }}>
                  {selectedApi.latest_latency_ms !== null ? `${selectedApi.latest_latency_ms}ms` : '—'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Avg Latency</div>
                <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '1rem', marginTop: 2 }}>
                  {selectedApi.avg_latency_ms > 0 ? `${selectedApi.avg_latency_ms}ms` : '—'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Uptime</div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem', marginTop: 2 }}>
                  {selectedApi.uptime_percent}%
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Consecutive Fails</div>
                <div style={{ fontWeight: 700, color: selectedApi.consecutive_failures > 0 ? '#fb7185' : '#34d399', fontSize: '1rem', marginTop: 2 }}>
                  {selectedApi.consecutive_failures}
                </div>
              </div>
            </div>

            {/* Generated cURL */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Executable cURL Command</span>
                <button
                  onClick={() => copyToClipboard(generateCurlCommand(selectedApi, typeof window !== 'undefined' ? window.location.origin : '', maskSecrets), 'modal-curl')}
                  style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {copiedId === 'modal-curl' ? '✓ Copied' : '📋 Copy cURL'}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '0.75rem 1rem',
                  borderRadius: 6,
                  background: 'rgba(0, 0, 0, 0.45)',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#93c5fd',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {generateCurlCommand(selectedApi, typeof window !== 'undefined' ? window.location.origin : '', maskSecrets)}
              </pre>
            </div>

            {/* Request Schema & Body Sample */}
            {selectedApi.bodySchema && (
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>Request Body Schema</div>
                <pre
                  style={{
                    margin: 0,
                    padding: '0.75rem 1rem',
                    borderRadius: 6,
                    background: 'rgba(0, 0, 0, 0.45)',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: '#c084fc',
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(selectedApi.bodySchema, null, 2)}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => handlePingSingle(selectedApi.id)}
                disabled={pingingId === selectedApi.id}
                className="btn-secondary"
              >
                <RefreshCw size={14} className={pingingId === selectedApi.id ? 'spinner' : ''} />
                <span>Ping Probe Now</span>
              </button>

              <button
                onClick={() => {
                  const target = selectedApi;
                  setSelectedApi(null);
                  loadApiIntoTester(target);
                }}
                className="btn-primary"
              >
                <Zap size={14} />
                <span>Open in Postman Tester</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* cURL IMPORT MODAL */}
      {/* ============================================================ */}
      {showCurlImportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowCurlImportModal(false)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 'min(580px, 94vw)',
              background: '#12141a',
              padding: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Import cURL Command</h3>
              <button
                onClick={() => setShowCurlImportModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
              Paste any valid cURL request. Method, headers, query parameters, authorization, and body will be extracted into the tester.
            </p>
            <textarea
              value={curlImportText}
              onChange={(e) => setCurlImportText(e.target.value)}
              placeholder="curl -X POST 'https://api.example.com/data' -H 'Content-Type: application/json' -d '{...}'"
              className="input-field"
              style={{
                width: '100%',
                height: '180px',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                resize: 'none',
                marginBottom: '1rem',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setShowCurlImportModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCurlCommand}
                disabled={!curlImportText.trim()}
                className="btn-primary"
              >
                Parse &amp; Load into Tester
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: toast.type === 'alert' ? '#881337' : '#1e1b4b',
            border: `1px solid ${toast.type === 'alert' ? '#f43f5e' : '#6366f1'}`,
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 8,
            fontSize: '0.88rem',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {toast.type === 'alert' ? <AlertTriangle size={16} /> : <Check size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
