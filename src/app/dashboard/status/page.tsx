'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Search,
  Zap,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  Wifi,
  ExternalLink,
} from 'lucide-react';

interface ServiceCheck {
  status_code: number;
  latency_ms: number;
  checked_at: string;
  is_up: boolean;
}

interface ServiceItem {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  version: string;
  check_url: string | null;
  is_up: boolean;
  last_checked_at: string | null;
  latest_status_code: number | null;
  latest_latency_ms: number | null;
  uptime_percent: number;
  avg_latency_ms: number;
  history: ServiceCheck[];
}

interface IncidentItem {
  id: string;
  api_id: string;
  status_code: number;
  latency_ms: number;
  checked_at: string;
  api_name: string;
  version: string;
  project_name: string;
}

interface MonitorSummary {
  total: number;
  up: number;
  down: number;
  uptimePercent: number;
  avgLatencyMs: number;
  systemStatus: 'OPERATIONAL' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE';
}

export default function StatusMonitoringPage() {
  const [summary, setSummary] = useState<MonitorSummary>({
    total: 0,
    up: 0,
    down: 0,
    uptimePercent: 100,
    avgLatencyMs: 0,
    systemStatus: 'OPERATIONAL',
  });
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'up' | 'down'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // seconds
  const [countdown, setCountdown] = useState<number>(30);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'services' | 'incidents'>('services');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/monitor/status');
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setSummary(data.summary || {});
      setServices(data.services || []);
      setIncidents(data.incidents || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Fetch monitoring status error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    setCountdown(autoRefreshInterval);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchStatus();
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, fetchStatus]);

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      const res = await fetch('/api/monitor/check-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Check all error:', err);
    } finally {
      setCheckingAll(false);
    }
  };

  const handleCheckSingle = async (apiId: string) => {
    setCheckingId(apiId);
    try {
      const res = await fetch('/api/monitor/check-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_id: apiId }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error('Check single error:', err);
    } finally {
      setCheckingId(null);
    }
  };

  const filteredServices = services.filter((s) => {
    if (filter === 'up' && !s.is_up) return false;
    if (filter === 'down' && s.is_up) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.project_name.toLowerCase().includes(q) ||
        (s.check_url && s.check_url.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const formatRelativeTime = (isoString: string | null) => {
    if (!isoString) return 'Never checked';
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getLatencyBadgeColor = (ms: number | null) => {
    if (ms === null) return '#9ca3af';
    if (ms < 200) return '#10b981'; // Fast
    if (ms < 800) return '#f59e0b'; // Moderate
    return '#f43f5e'; // Slow
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header with Title & Auto-refresh countdown */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={26} color="#818cf8" />
              24/7 API Monitoring &amp; Uptime
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              LIVE 24/7
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Continuous real-time health checks, latency tracking, uptime logs, and automated alerts across all your API services.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Refresh controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-ping:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value={10} style={{ background: '#12141a' }}>10s</option>
              <option value={30} style={{ background: '#12141a' }}>30s</option>
              <option value={60} style={{ background: '#12141a' }}>60s</option>
              <option value={0} style={{ background: '#12141a' }}>Off</option>
            </select>
            {autoRefreshInterval > 0 && (
              <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600, minWidth: '24px' }}>
                ({countdown}s)
              </span>
            )}
          </div>

          <button
            onClick={handleCheckAll}
            disabled={checkingAll || loading}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.1rem',
              fontSize: '0.85rem',
            }}
          >
            {checkingAll ? (
              <>
                <RefreshCw size={15} className="spinner" />
                <span>Pinging All...</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>Ping All Services</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: `4px solid ${
            summary.systemStatus === 'OPERATIONAL'
              ? '#10b981'
              : summary.systemStatus === 'PARTIAL_OUTAGE'
              ? '#f59e0b'
              : '#f43f5e'
          }`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {summary.systemStatus === 'OPERATIONAL' ? (
            <CheckCircle2 size={24} color="#10b981" />
          ) : summary.systemStatus === 'PARTIAL_OUTAGE' ? (
            <AlertTriangle size={24} color="#f59e0b" />
          ) : (
            <XCircle size={24} color="#f43f5e" />
          )}

          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {summary.systemStatus === 'OPERATIONAL' && 'All API Services Operational'}
              {summary.systemStatus === 'PARTIAL_OUTAGE' && 'Partial System Degradation Detected'}
              {summary.systemStatus === 'MAJOR_OUTAGE' && 'Critical System Outage'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Last verified {formatRelativeTime(lastUpdated.toISOString())} • Background cron monitors 24/7
            </p>
          </div>
        </div>

        <div className="status-metrics-grid">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
              {summary.uptimePercent}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              7-Day Uptime
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>
              {summary.avgLatencyMs} <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>ms</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Avg Latency
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
              {summary.up} / {summary.total}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Healthy Services
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('services')}
            style={{
              background: activeTab === 'services' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: activeTab === 'services' ? '#fff' : 'var(--text-muted)',
              border: activeTab === 'services' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={14} />
            <span>Services ({services.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            style={{
              background: activeTab === 'incidents' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              color: activeTab === 'incidents' ? '#fff' : 'var(--text-muted)',
              border: activeTab === 'incidents' ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={14} />
            <span>Incident Log ({incidents.length})</span>
          </button>
        </div>

        {activeTab === 'services' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search service or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ width: '220px', padding: '0.45rem 0.75rem 0.45rem 2rem', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'up', 'down'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    background: filter === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: filter === f ? '#fff' : 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Loading 24/7 service metrics...
        </div>
      ) : activeTab === 'services' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredServices.length === 0 ? (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No API services match the selected criteria.
            </div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.id}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: service.is_up ? '#10b981' : '#f43f5e',
                        boxShadow: `0 0 8px ${service.is_up ? '#10b981' : '#f43f5e'}`,
                        display: 'inline-block',
                      }}
                    />
                    <Link
                      href={`/dashboard/${service.project_name}`}
                      style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <span>{service.project_name}</span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span>
                      <span>{service.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#a855f7', marginLeft: '6px', fontWeight: 500 }}>
                        {service.version}
                      </span>
                    </Link>

                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: service.is_up ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: service.is_up ? '#34d399' : '#fb7185',
                      }}
                    >
                      {service.is_up ? 'OPERATIONAL' : 'DOWN'}
                    </span>
                  </div>

                  <div className="service-card-meta">
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: getLatencyBadgeColor(service.latest_latency_ms) }}>
                        {service.latest_latency_ms !== null ? `${service.latest_latency_ms} ms` : '—'}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {service.latest_status_code ? `HTTP ${service.latest_status_code}` : 'No checks'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '70px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                        {service.uptime_percent}%
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Uptime</div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '90px' }}>
                      {formatRelativeTime(service.last_checked_at)}
                    </div>

                    <button
                      onClick={() => handleCheckSingle(service.id)}
                      disabled={checkingId === service.id}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw size={12} className={checkingId === service.id ? 'spinner' : ''} />
                      <span>{checkingId === service.id ? 'Pinging...' : 'Check Now'}</span>
                    </button>
                  </div>
                </div>

                {/* Target URL Preview */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Target: {service.check_url || `/api/p/${service.project_name}/${service.version}/${service.name}`}
                </div>

                {/* 30-Check Uptime Timeline Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '0.25rem' }}>
                  {service.history && service.history.length > 0 ? (
                    service.history.map((check, idx) => (
                      <div
                        key={idx}
                        title={`Status: ${check.status_code} (${check.latency_ms}ms) at ${new Date(check.checked_at).toLocaleTimeString()}`}
                        style={{
                          flex: 1,
                          height: '24px',
                          borderRadius: '3px',
                          background: check.is_up ? '#10b981' : '#f43f5e',
                          opacity: 0.85,
                          cursor: 'pointer',
                          transition: 'transform 0.1s',
                        }}
                      />
                    ))
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Awaiting initial check data from the 24/7 background monitor...
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Incidents Log Tab */
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#f59e0b" />
            Recent Incident &amp; Outage Records
          </h2>
          {incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={36} color="#10b981" />
              <span>✓ No recent incidents recorded. All API services have maintained continuous uptime.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'rgba(244, 63, 94, 0.08)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#f43f5e', fontWeight: 700 }}>🚨 OUTAGE</span>
                    <span style={{ fontWeight: 600, color: '#fff' }}>
                      {inc.project_name} / {inc.api_name} ({inc.version})
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>HTTP Code: {inc.status_code}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <span>Latency: {inc.latency_ms}ms</span>
                    <span>{new Date(inc.checked_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
