'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  ApiCollection,
  ApiFolder,
  ApiRequest,
  ApiEnvironment,
  HistoryEntry,
  SendResponse,
  KeyValueItem,
  Assertion,
  ExtractRule,
} from './types';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
  HEAD: '#6b7280',
  OPTIONS: '#6b7280',
};

export default function ClientPage() {
  const params = useParams();
  const projectName = (params?.project as string) || '';

  // Data state
  const [collections, setCollections] = useState<ApiCollection[]>([]);
  const [environments, setEnvironments] = useState<ApiEnvironment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Navigation / Selection
  const [activeCollectionId, setActiveCollectionId] = useState<string>('');
  const [activeFolders, setActiveFolders] = useState<ApiFolder[]>([]);
  const [activeRequests, setActiveRequests] = useState<ApiRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string>('');

  // Active Request in Editor
  const [method, setMethod] = useState<string>('GET');
  const [url, setUrl] = useState<string>('');
  const [reqName, setReqName] = useState<string>('Untitled Request');
  const [paramsList, setParamsList] = useState<KeyValueItem[]>([{ key: '', value: '', enabled: true }]);
  const [headersList, setHeadersList] = useState<KeyValueItem[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
  ]);
  const [authType, setAuthType] = useState<'none' | 'bearer' | 'basic' | 'api-key'>('none');
  const [authConfig, setAuthConfig] = useState<Record<string, string>>({
    token: '',
    username: '',
    password: '',
    key: 'x-api-key',
    value: '',
  });
  const [bodyType, setBodyType] = useState<'none' | 'json' | 'form' | 'raw'>('json');
  const [bodyContent, setBodyContent] = useState<string>('{\n  \n}');
  const [assertions, setAssertions] = useState<Assertion[]>([
    { type: 'status', operator: 'eq', expected: 200 },
  ]);
  const [extractRules, setExtractRules] = useState<ExtractRule[]>([]);

  // Response state
  const [response, setResponse] = useState<SendResponse | null>(null);
  const [sending, setSending] = useState(false);

  // Tabs
  const [sidebarTab, setSidebarTab] = useState<'collections' | 'history' | 'environments'>('collections');
  const [editorTab, setEditorTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'assertions' | 'extract'>('params');
  const [responseTab, setResponseTab] = useState<'body' | 'headers' | 'assertions'>('body');
  const [mobileTab, setMobileTab] = useState<'sidebar' | 'editor' | 'response'>('editor');

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'postman' | 'curl' | 'openapi'>('postman');
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);

  const [showNewColModal, setShowNewColModal] = useState(false);
  const [newColName, setNewColName] = useState('');

  const [showNewEnvModal, setShowNewEnvModal] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newEnvVars, setNewEnvVars] = useState<KeyValueItem[]>([{ key: 'base_url', value: 'http://localhost:3000', enabled: true }]);

  const [showRunnerModal, setShowRunnerModal] = useState(false);
  const [runningCollection, setRunningCollection] = useState(false);
  const [runSummary, setRunSummary] = useState<any>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Initial load
  useEffect(() => {
    loadCollections();
    loadEnvironments();
    loadHistory();
  }, [projectName]);

  const loadCollections = async () => {
    try {
      const res = await fetch(`/api/client/collections?project_id=${encodeURIComponent(projectName)}`);
      const data = await res.json();
      if (data.collections) {
        setCollections(data.collections);
        if (data.collections.length > 0 && !activeCollectionId) {
          selectCollection(data.collections[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadEnvironments = async () => {
    try {
      const res = await fetch(`/api/client/environments?project_id=${encodeURIComponent(projectName)}`);
      const data = await res.json();
      if (data.environments) {
        setEnvironments(data.environments);
        if (data.environments.length > 0 && !activeEnvId) {
          setActiveEnvId(data.environments[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/client/history?limit=30');
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (e) {
      console.error(e);
    }
  };

  const selectCollection = async (colId: string) => {
    setActiveCollectionId(colId);
    try {
      const res = await fetch(`/api/client/collections/${colId}`);
      const data = await res.json();
      if (data.folders) setActiveFolders(data.folders);
      if (data.requests) {
        setActiveRequests(data.requests);
        if (data.requests.length > 0) {
          loadRequestIntoEditor(data.requests[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadRequestIntoEditor = (req: ApiRequest) => {
    setActiveRequestId(req.id);
    setReqName(req.name);
    setMethod(req.method || 'GET');
    setUrl(req.url || '');
    setParamsList(Array.isArray(req.params) && req.params.length > 0 ? req.params : [{ key: '', value: '', enabled: true }]);
    setHeadersList(Array.isArray(req.headers) && req.headers.length > 0 ? req.headers : [{ key: 'Content-Type', value: 'application/json', enabled: true }]);
    setAuthType(req.auth_type || 'none');
    setAuthConfig(req.auth_config || {});
    setBodyType(req.body_type || 'none');
    setBodyContent(req.body_content || '');
    setAssertions(Array.isArray(req.assertions) ? req.assertions : []);
    setExtractRules(Array.isArray(req.extract_rules) ? req.extract_rules : []);
    if (window.innerWidth < 768) setMobileTab('editor');
  };

  // Build active environment variable lookup map
  const getActiveEnvVars = (): Record<string, string> => {
    const env = environments.find((e) => e.id === activeEnvId);
    if (!env || !Array.isArray(env.variables)) return {};
    const map: Record<string, string> = {};
    for (const v of env.variables) {
      if (v.key) map[v.key] = v.value;
    }
    return map;
  };

  // SEND REQUEST
  const handleSend = async () => {
    if (!url.trim()) {
      showToastMsg('Please enter a request URL');
      return;
    }

    setSending(true);
    setResponse(null);

    // Build query params into URL if applicable
    let targetUrl = url;
    const activeParams = paramsList.filter((p) => p.enabled !== false && p.key.trim());
    if (activeParams.length > 0 && !targetUrl.includes('?')) {
      const qs = activeParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
      targetUrl = `${targetUrl}?${qs}`;
    }

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          url: targetUrl,
          headers: headersList,
          body: bodyContent,
          body_type: bodyType,
          auth_type: authType,
          auth_config: authConfig,
          assertions,
          extract_rules: extractRules,
          environment_variables: getActiveEnvVars(),
          request_id: activeRequestId || null,
          collection_id: activeCollectionId || null,
        }),
      });

      const data = await res.json();
      setResponse(data);
      loadHistory();
      if (window.innerWidth < 768) setMobileTab('response');
    } catch (err: any) {
      showToastMsg(`Send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // SAVE REQUEST
  const handleSave = async () => {
    if (!activeCollectionId) {
      showToastMsg('Create or select a collection first');
      return;
    }

    const payload = {
      collection_id: activeCollectionId,
      name: reqName,
      method,
      url,
      params: paramsList,
      headers: headersList,
      auth_type: authType,
      auth_config: authConfig,
      body_type: bodyType,
      body_content: bodyContent,
      assertions,
      extract_rules: extractRules,
    };

    try {
      if (activeRequestId) {
        const res = await fetch(`/api/client/requests/${activeRequestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showToastMsg('Request updated');
          selectCollection(activeCollectionId);
        }
      } else {
        const res = await fetch('/api/client/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.request) {
          setActiveRequestId(data.request.id);
          showToastMsg('Request created');
          selectCollection(activeCollectionId);
        }
      }
    } catch (e: any) {
      showToastMsg(`Save failed: ${e.message}`);
    }
  };

  // CREATE COLLECTION
  const handleCreateCollection = async () => {
    if (!newColName.trim()) return;
    try {
      const res = await fetch('/api/client/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newColName.trim(), project_id: projectName }),
      });
      const data = await res.json();
      if (data.collection) {
        setShowNewColModal(false);
        setNewColName('');
        await loadCollections();
        selectCollection(data.collection.id);
        showToastMsg(`Collection "${data.collection.name}" created`);
      }
    } catch (e: any) {
      showToastMsg(e.message);
    }
  };

  // IMPORT COLLECTION
  const handleImport = async () => {
    if (!importData.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('/api/client/collections/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: importType,
          data: importData,
          project_id: projectName,
        }),
      });
      const data = await res.json();
      if (data.collection) {
        setShowImportModal(false);
        setImportData('');
        await loadCollections();
        selectCollection(data.collection.id);
        showToastMsg(`Imported ${data.imported_requests} requests successfully`);
      } else {
        showToastMsg(data.error || 'Import failed');
      }
    } catch (e: any) {
      showToastMsg(`Import error: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  // EXPORT COLLECTION
  const handleExport = () => {
    if (!activeCollectionId) return;
    window.open(`/api/client/collections/${activeCollectionId}/export`, '_blank');
  };

  // RUN COLLECTION
  const handleRunCollection = async () => {
    if (!activeCollectionId) return;
    setRunningCollection(true);
    setRunSummary(null);
    try {
      const res = await fetch(`/api/client/collections/${activeCollectionId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environment_id: activeEnvId || null }),
      });
      const data = await res.json();
      setRunSummary(data);
    } catch (e: any) {
      showToastMsg(`Runner failed: ${e.message}`);
    } finally {
      setRunningCollection(false);
    }
  };

  // CREATE ENVIRONMENT
  const handleCreateEnvironment = async () => {
    if (!newEnvName.trim()) return;
    try {
      const res = await fetch('/api/client/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newEnvName.trim(),
          project_id: projectName,
          variables: newEnvVars.filter((v) => v.key.trim()),
        }),
      });
      const data = await res.json();
      if (data.environment) {
        setShowNewEnvModal(false);
        setNewEnvName('');
        await loadEnvironments();
        setActiveEnvId(data.environment.id);
        showToastMsg(`Environment "${data.environment.name}" created`);
      }
    } catch (e: any) {
      showToastMsg(e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: '#0a0a0f', color: '#fff' }}>
      {/* Top Action Bar */}
      <div
        className="api-client-top-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: '#12121a',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 16, background: 'linear-gradient(135deg, #6366f1, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            API Client
          </span>
          <span style={{ color: '#a0a0b0', fontSize: 13 }}>/ {projectName}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Environment Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: '#a0a0b0' }}>Env:</span>
            <select
              value={activeEnvId}
              onChange={(e) => setActiveEnvId(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 12,
                outline: 'none',
                maxWidth: 130,
              }}
            >
              <option value="">No Environment</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewEnvModal(true)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              + Env
            </button>
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Import
          </button>

          {activeCollectionId && (
            <>
              <button
                onClick={handleExport}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Export
              </button>
              <button
                onClick={() => {
                  setShowRunnerModal(true);
                  handleRunCollection();
                }}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Run Suite ▶
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Responsive Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* ============================================================ */}
        {/* LEFT PANE: Sidebar (Collections, History, Environments) */}
        {/* ============================================================ */}
        <div
          className={`api-client-sidebar ${mobileTab === 'sidebar' ? 'mobile-active' : ''}`}
          style={{
            width: 280,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            background: '#0d0d14',
          }}
        >
          {/* Sidebar Tab Header */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {(['collections', 'history', 'environments'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSidebarTab(t)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: sidebarTab === t ? '2px solid #6366f1' : 'none',
                  color: sidebarTab === t ? '#fff' : '#a0a0b0',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Sidebar Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {sidebarTab === 'collections' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                  <span style={{ fontSize: 11, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Collections ({collections.length})
                  </span>
                  <button
                    onClick={() => setShowNewColModal(true)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#6366f1',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    + New
                  </button>
                </div>

                {collections.map((col) => {
                  const isColActive = col.id === activeCollectionId;
                  return (
                    <div key={col.id} style={{ marginBottom: 6 }}>
                      <div
                        onClick={() => selectCollection(col.id)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isColActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                          border: isColActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500 }}>📁 {col.name}</span>
                        {col.auto_generated && (
                          <span style={{ fontSize: 10, background: 'rgba(236,72,153,0.2)', color: '#ec4899', padding: '1px 5px', borderRadius: 4 }}>
                            auto
                          </span>
                        )}
                      </div>

                      {/* Requests under active collection */}
                      {isColActive && (
                        <div style={{ paddingLeft: 14, marginTop: 4 }}>
                          {activeRequests.map((req) => {
                            const isReqActive = req.id === activeRequestId;
                            return (
                              <div
                                key={req.id}
                                onClick={() => loadRequestIntoEditor(req)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '6px 8px',
                                  borderRadius: 4,
                                  background: isReqActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  marginBottom: 2,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: METHOD_COLORS[req.method] || '#a0a0b0',
                                    width: 32,
                                  }}
                                >
                                  {req.method}
                                </span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {req.name}
                                </span>
                              </div>
                            );
                          })}

                          <button
                            onClick={() => {
                              setActiveRequestId('');
                              setReqName('New Request');
                              setUrl('');
                              setMethod('GET');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#a0a0b0',
                              fontSize: 11,
                              padding: '4px 8px',
                              cursor: 'pointer',
                              display: 'block',
                              marginTop: 4,
                            }}
                          >
                            + Add Request
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {sidebarTab === 'history' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                  <span style={{ fontSize: 11, color: '#a0a0b0', textTransform: 'uppercase' }}>Recent History</span>
                  <button
                    onClick={async () => {
                      await fetch('/api/client/history', { method: 'DELETE' });
                      setHistory([]);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}
                  >
                    Clear
                  </button>
                </div>
                {history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => {
                      setMethod(h.method);
                      setUrl(h.url);
                    }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.03)',
                      marginBottom: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: METHOD_COLORS[h.method] || '#a0a0b0', fontSize: 11 }}>
                        {h.method}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: h.response_status < 400 ? '#22c55e' : '#ef4444',
                        }}
                      >
                        {h.response_status || 'ERR'}
                      </span>
                    </div>
                    <div style={{ color: '#a0a0b0', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {h.url}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === 'environments' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                  <span style={{ fontSize: 11, color: '#a0a0b0', textTransform: 'uppercase' }}>Environments</span>
                  <button
                    onClick={() => setShowNewEnvModal(true)}
                    style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                  >
                    + New
                  </button>
                </div>
                {environments.map((env) => (
                  <div
                    key={env.id}
                    onClick={() => setActiveEnvId(env.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: env.id === activeEnvId ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: env.id === activeEnvId ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                      marginBottom: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{env.name}</div>
                    <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 2 }}>
                      {env.variables?.length || 0} variables (AES-GCM secured)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* CENTER PANE: Request Editor */}
        {/* ============================================================ */}
        <div
          className={`api-client-editor ${mobileTab === 'editor' ? 'mobile-active' : ''}`}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            background: '#0e0e16',
            minWidth: 0,
          }}
        >
          {/* Request Header Bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <input
                type="text"
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                placeholder="Request Name"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  outline: 'none',
                  width: '60%',
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>

            {/* URL Input Bar */}
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: METHOD_COLORS[method] || '#fff',
                  fontWeight: 700,
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  outline: 'none',
                }}
              >
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
                  <option key={m} value={m} style={{ color: '#fff', background: '#12121a' }}>
                    {m}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter URL e.g. {{base_url}}/api/p/store/v1/products"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend();
                }}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  outline: 'none',
                }}
              />

              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  background: sending ? '#4f46e5' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: '8px 20px',
                  fontSize: 13,
                  cursor: sending ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>

          {/* Editor Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 12px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {(['params', 'headers', 'auth', 'body', 'assertions', 'extract'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setEditorTab(t)}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: editorTab === t ? '2px solid #6366f1' : 'none',
                  color: editorTab === t ? '#fff' : '#a0a0b0',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {t}
                {t === 'assertions' && assertions.length > 0 && ` (${assertions.length})`}
                {t === 'extract' && extractRules.length > 0 && ` (${extractRules.length})`}
              </button>
            ))}
          </div>

          {/* Editor Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {/* PARAMS TAB */}
            {editorTab === 'params' && (
              <div>
                <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 8 }}>Query Parameters</div>
                {paramsList.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={p.enabled !== false}
                      onChange={(e) => {
                        const updated = [...paramsList];
                        updated[idx].enabled = e.target.checked;
                        setParamsList(updated);
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Key"
                      value={p.key}
                      onChange={(e) => {
                        const updated = [...paramsList];
                        updated[idx].key = e.target.value;
                        setParamsList(updated);
                      }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={p.value}
                      onChange={(e) => {
                        const updated = [...paramsList];
                        updated[idx].value = e.target.value;
                        setParamsList(updated);
                      }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
                    />
                    <button
                      onClick={() => setParamsList(paramsList.filter((_, i) => i !== idx))}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 6px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setParamsList([...paramsList, { key: '', value: '', enabled: true }])}
                  style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', color: '#a0a0b0', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginTop: 4 }}
                >
                  + Add Parameter
                </button>
              </div>
            )}

            {/* HEADERS TAB */}
            {editorTab === 'headers' && (
              <div>
                <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 8 }}>HTTP Headers</div>
                {headersList.map((h, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={h.enabled !== false}
                      onChange={(e) => {
                        const updated = [...headersList];
                        updated[idx].enabled = e.target.checked;
                        setHeadersList(updated);
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Header Name"
                      value={h.key}
                      onChange={(e) => {
                        const updated = [...headersList];
                        updated[idx].key = e.target.value;
                        setHeadersList(updated);
                      }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={h.value}
                      onChange={(e) => {
                        const updated = [...headersList];
                        updated[idx].value = e.target.value;
                        setHeadersList(updated);
                      }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}
                    />
                    <button
                      onClick={() => setHeadersList(headersList.filter((_, i) => i !== idx))}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 6px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setHeadersList([...headersList, { key: '', value: '', enabled: true }])}
                  style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', color: '#a0a0b0', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginTop: 4 }}
                >
                  + Add Header
                </button>
              </div>
            )}

            {/* AUTH TAB */}
            {editorTab === 'auth' && (
              <div style={{ maxWidth: 440 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Type</label>
                  <select
                    value={authType}
                    onChange={(e: any) => setAuthType(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
                  >
                    <option value="none">No Auth</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="api-key">API Key</option>
                  </select>
                </div>

                {authType === 'bearer' && (
                  <div>
                    <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Token</label>
                    <input
                      type="text"
                      placeholder="e.g. {{token}}"
                      value={authConfig.token || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
                    />
                  </div>
                )}

                {authType === 'basic' && (
                  <div>
                    <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Username</label>
                    <input
                      type="text"
                      value={authConfig.username || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 8 }}
                    />
                    <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Password</label>
                    <input
                      type="password"
                      value={authConfig.password || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
                    />
                  </div>
                )}

                {authType === 'api-key' && (
                  <div>
                    <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Key</label>
                    <input
                      type="text"
                      value={authConfig.key || 'x-api-key'}
                      onChange={(e) => setAuthConfig({ ...authConfig, key: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13, marginBottom: 8 }}
                    />
                    <label style={{ fontSize: 12, color: '#a0a0b0', display: 'block', marginBottom: 4 }}>Value</label>
                    <input
                      type="text"
                      placeholder="e.g. {{api_key}}"
                      value={authConfig.value || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, value: e.target.value })}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '8px 10px', fontSize: 13 }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* BODY TAB */}
            {editorTab === 'body' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  {(['none', 'json', 'form', 'raw'] as const).map((b) => (
                    <label key={b} style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="radio"
                        name="bodyType"
                        value={b}
                        checked={bodyType === b}
                        onChange={() => setBodyType(b)}
                      />
                      {b.toUpperCase()}
                    </label>
                  ))}
                </div>

                {bodyType !== 'none' && (
                  <textarea
                    value={bodyContent}
                    onChange={(e) => setBodyContent(e.target.value)}
                    placeholder="Request body (supports {{variables}})"
                    style={{
                      flex: 1,
                      minHeight: 220,
                      background: '#12121a',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: '#60a5fa',
                      fontFamily: 'monospace',
                      fontSize: 13,
                      padding: 12,
                      borderRadius: 6,
                      resize: 'none',
                      outline: 'none',
                    }}
                  />
                )}
              </div>
            )}

            {/* ASSERTIONS TAB */}
            {editorTab === 'assertions' && (
              <div>
                <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 8 }}>
                  Declarative Assertions (evaluated on response)
                </div>
                {assertions.map((a, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <select
                      value={a.type}
                      onChange={(e: any) => {
                        const updated = [...assertions];
                        updated[idx].type = e.target.value;
                        setAssertions(updated);
                      }}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                    >
                      <option value="status">Status</option>
                      <option value="latency">Latency</option>
                      <option value="header">Header</option>
                      <option value="json_path">JSON Path</option>
                      <option value="body_contains">Body Contains</option>
                    </select>

                    {['header', 'json_path'].includes(a.type) && (
                      <input
                        type="text"
                        placeholder={a.type === 'header' ? 'Header name' : 'e.g. data[0].id'}
                        value={a.target || ''}
                        onChange={(e) => {
                          const updated = [...assertions];
                          updated[idx].target = e.target.value;
                          setAssertions(updated);
                        }}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                      />
                    )}

                    <select
                      value={a.operator}
                      onChange={(e: any) => {
                        const updated = [...assertions];
                        updated[idx].operator = e.target.value;
                        setAssertions(updated);
                      }}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                    >
                      <option value="eq">Equals (==)</option>
                      <option value="neq">Not Equals (!=)</option>
                      <option value="lt">Less Than (&lt;)</option>
                      <option value="gt">Greater Than (&gt;)</option>
                      <option value="contains">Contains</option>
                      <option value="exists">Exists</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Expected"
                      value={String(a.expected ?? '')}
                      onChange={(e) => {
                        const updated = [...assertions];
                        updated[idx].expected = e.target.value;
                        setAssertions(updated);
                      }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                    />

                    <button
                      onClick={() => setAssertions(assertions.filter((_, i) => i !== idx))}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 6px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setAssertions([...assertions, { type: 'status', operator: 'eq', expected: 200 }])}
                  style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', color: '#a0a0b0', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginTop: 4 }}
                >
                  + Add Assertion
                </button>
              </div>
            )}

            {/* EXTRACT TAB */}
            {editorTab === 'extract' && (
              <div>
                <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 8 }}>
                  Extract JSON Path values into environment variables for chained requests
                </div>
                {extractRules.map((rule, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      type="text"
                      placeholder="JSON Path e.g. data.id"
                      value={rule.json_path}
                      onChange={(e) => {
                        const updated = [...extractRules];
                        updated[idx].json_path = e.target.value;
                        setExtractRules(updated);
                      }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                    />
                    <input
                      type="text"
                      placeholder="Variable Name e.g. item_id"
                      value={rule.variable_name}
                      onChange={(e) => {
                        const updated = [...extractRules];
                        updated[idx].variable_name = e.target.value;
                        setExtractRules(updated);
                      }}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                    />
                    <button
                      onClick={() => setExtractRules(extractRules.filter((_, i) => i !== idx))}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 6px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setExtractRules([...extractRules, { json_path: '', variable_name: '' }])}
                  style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)', color: '#a0a0b0', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginTop: 4 }}
                >
                  + Add Extract Rule
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANE: Response Viewer */}
        {/* ============================================================ */}
        <div
          className={`api-client-response ${mobileTab === 'response' ? 'mobile-active' : ''}`}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: '#0a0a0f',
            minWidth: 0,
          }}
        >
          {/* Response Status Bar */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 57,
            }}
          >
            {response ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 700,
                    background: response.status < 300 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: response.status < 300 ? '#22c55e' : '#ef4444',
                    border: `1px solid ${response.status < 300 ? '#22c55e' : '#ef4444'}`,
                  }}
                >
                  {response.status} {response.statusText}
                </span>
                <span style={{ fontSize: 12, color: '#a0a0b0' }}>⏱ {response.timeMs} ms</span>
                <span style={{ fontSize: 12, color: '#a0a0b0' }}>
                  📦 {response.sizeBytes < 1024 ? `${response.sizeBytes} B` : `${(response.sizeBytes / 1024).toFixed(1)} KB`}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 13, color: '#6b7280' }}>No response yet</span>
            )}
          </div>

          {/* Response Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 12px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {(['body', 'headers', 'assertions'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setResponseTab(t)}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: responseTab === t ? '2px solid #6366f1' : 'none',
                  color: responseTab === t ? '#fff' : '#a0a0b0',
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {t}
                {t === 'assertions' && response?.assertionResults && ` (${response.assertionResults.filter((a) => a.passed).length}/${response.assertionResults.length})`}
              </button>
            ))}
          </div>

          {/* Response Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {response ? (
              <>
                {responseTab === 'body' && (
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#93c5fd',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {response.parsedJson
                      ? JSON.stringify(response.parsedJson, null, 2)
                      : response.body || '(empty response)'}
                  </pre>
                )}

                {responseTab === 'headers' && (
                  <div>
                    {Object.entries(response.headers || {}).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ width: 180, color: '#a0a0b0', fontWeight: 600 }}>{k}:</span>
                        <span style={{ flex: 1, color: '#fff', wordBreak: 'break-all' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}

                {responseTab === 'assertions' && (
                  <div>
                    {(!response.assertionResults || response.assertionResults.length === 0) && (
                      <div style={{ color: '#a0a0b0', fontSize: 12 }}>No assertions configured for this request</div>
                    )}
                    {response.assertionResults?.map((a, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: a.passed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          border: `1px solid ${a.passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          marginBottom: 6,
                          fontSize: 12,
                        }}
                      >
                        <span>{a.passed ? '✅' : '❌'}</span>
                        <span style={{ fontWeight: 600, color: a.passed ? '#22c55e' : '#ef4444' }}>
                          {a.type.toUpperCase()}:
                        </span>
                        <span>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#6b7280', paddingTop: 60 }}>
                Enter URL and click &quot;Send&quot; to test your API
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MOBILE BOTTOM NAVIGATION TABS (Shown on screens < 768px) */}
      {/* ============================================================ */}
      <div
        className="api-client-mobile-tabs"
        style={{
          display: 'none',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          background: '#0d0e14',
          padding: '4px 6px',
          position: 'sticky',
          bottom: 0,
          zIndex: 40,
        }}
      >
        {(['sidebar', 'editor', 'response'] as const).map((pane) => {
          const isActive = mobileTab === pane;
          return (
            <button
              key={pane}
              onClick={() => setMobileTab(pane)}
              style={{
                flex: 1,
                background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                borderRadius: 8,
                color: isActive ? '#fff' : '#9ca3af',
                fontWeight: 600,
                fontSize: 12,
                padding: '8px 4px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {pane === 'sidebar' && '📁 Collections'}
              {pane === 'editor' && '✏️ Request'}
              {pane === 'response' && '📄 Response'}
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ width: 'min(500px, 94vw)', maxHeight: '85vh', overflowY: 'auto', background: '#12121a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Import Collection</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['postman', 'curl', 'openapi'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setImportType(t)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    background: importType === t ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                    border: importType === t ? '1px solid #6366f1' : '1px solid transparent',
                    color: '#fff',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder={importType === 'curl' ? 'curl -X POST https://api.com -H "..." -d "..."' : 'Paste JSON here...'}
              style={{ width: '100%', height: 180, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: 10, borderRadius: 6, fontFamily: 'monospace', fontSize: 12, resize: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'transparent', border: 'none', color: '#a0a0b0', cursor: 'pointer', padding: '6px 14px' }}>
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing} style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 16px', fontWeight: 600, cursor: 'pointer' }}>
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Collection Modal */}
      {showNewColModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ width: 'min(400px, 94vw)', background: '#12121a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>New Collection</h3>
            <input
              type="text"
              placeholder="Collection Name"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 14 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowNewColModal(false)} style={{ background: 'transparent', border: 'none', color: '#a0a0b0', cursor: 'pointer', padding: '6px 14px' }}>
                Cancel
              </button>
              <button onClick={handleCreateCollection} style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 16px', fontWeight: 600, cursor: 'pointer' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Environment Modal */}
      {showNewEnvModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ width: 'min(480px, 94vw)', maxHeight: '85vh', overflowY: 'auto', background: '#12121a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>New Environment</h3>
            <input
              type="text"
              placeholder="e.g. Staging or Production"
              value={newEnvName}
              onChange={(e) => setNewEnvName(e.target.value)}
              style={{ width: '100%', background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: 10, borderRadius: 6, fontSize: 13, marginBottom: 12 }}
            />
            <div style={{ fontSize: 12, color: '#a0a0b0', marginBottom: 6 }}>Variables</div>
            {newEnvVars.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder="Key"
                  value={v.key}
                  onChange={(e) => {
                    const u = [...newEnvVars];
                    u[i].key = e.target.value;
                    setNewEnvVars(u);
                  }}
                  style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={v.value}
                  onChange={(e) => {
                    const u = [...newEnvVars];
                    u[i].value = e.target.value;
                    setNewEnvVars(u);
                  }}
                  style={{ flex: 1, background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 8px', borderRadius: 6, fontSize: 12 }}
                />
              </div>
            ))}
            <button
              onClick={() => setNewEnvVars([...newEnvVars, { key: '', value: '', enabled: true }])}
              style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer', marginBottom: 12 }}
            >
              + Add Variable
            </button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowNewEnvModal(false)} style={{ background: 'transparent', border: 'none', color: '#a0a0b0', cursor: 'pointer', padding: '6px 14px' }}>
                Cancel
              </button>
              <button onClick={handleCreateEnvironment} style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 16px', fontWeight: 600, cursor: 'pointer' }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Runner Modal */}
      {showRunnerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ width: 'min(600px, 94vw)', maxHeight: '85vh', background: '#12121a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Collection Test Runner</h3>
            {runningCollection ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#a0a0b0' }}>
                Running tests sequentially... please wait
              </div>
            ) : runSummary ? (
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: runSummary.summary.failed === 0 ? '#22c55e' : '#ef4444' }}>
                      {runSummary.summary.status.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: '#a0a0b0' }}>Status</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{runSummary.summary.passed}</div>
                    <div style={{ fontSize: 11, color: '#a0a0b0' }}>Passed</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{runSummary.summary.failed}</div>
                    <div style={{ fontSize: 11, color: '#a0a0b0' }}>Failed</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{runSummary.summary.timeMs} ms</div>
                    <div style={{ fontSize: 11, color: '#a0a0b0' }}>Duration</div>
                  </div>
                </div>

                {runSummary.results.map((r: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{r.passed ? '✅' : '❌'}</span>
                      <span style={{ fontWeight: 700, color: METHOD_COLORS[r.method] || '#fff' }}>{r.method}</span>
                      <span>{r.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, color: '#a0a0b0' }}>
                      <span>{r.status || 'ERR'}</span>
                      <span>{r.timeMs} ms</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowRunnerModal(false)} style={{ background: '#6366f1', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 18px', fontWeight: 600, cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: '#1e1b4b', border: '1px solid #6366f1', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 1000 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

