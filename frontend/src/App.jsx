import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { RefreshCw, Download, FileText, Settings, Database, HelpCircle } from 'lucide-react';

import Sidebar from './components/Sidebar';
import QueryBar from './components/QueryBar';
import StatusIndicator from './components/StatusIndicator';
import ChartViewport from './components/ChartViewport';
import InsightPanel from './components/InsightPanel';
import SchemaExplorer from './components/SchemaExplorer';
import DataIngester from './components/DataIngester';
import ActivityLog from './components/ActivityLog';
import CustomDashboard from './components/CustomDashboard';
import AgenticDashboard from './components/AgenticDashboard';

const API_BASE = 'http://localhost:3001';

function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');

  // Core Data States
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([
    { id: 1, type: 'system', msg: 'Agentic Analyst Core v3.5 Initialized.' },
    { id: 2, type: 'info', msg: 'System ready. Awaiting connection telemetry.' }
  ]);
  const [visualsList, setVisualsList] = useState([]);
  const [hasCustomDashboard, setHasCustomDashboard] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [schema, setSchema] = useState(null);
  const [schemaObject, setSchemaObject] = useState(null);
  const [dbStatus, setDbStatus] = useState('checking'); // 'connected', 'disconnected', 'checking'

  // Ingestion States
  const [collectionName, setCollectionName] = useState('sales_data');
  const [rawData, setRawData] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [ingestLoading, setIngestLoading] = useState(false);

  // Export State
  const [exportLoading, setExportLoading] = useState(false);

  const socketRef = useRef(null);

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { id: Date.now(), msg, type }]);
  };

  useEffect(() => {
    // Socket.io Connection
    socketRef.current = io(API_BASE);
    
    socketRef.current.on('connect', () => {
      addLog('📡 Connected to Socket.io signaling server.', 'success');
    });

    socketRef.current.on('milestone', (data) => {
      addLog(`[${data.node.toUpperCase()}] ${data.msg}`, data.error ? 'error' : 'info');
    });

    checkHealth();
    fetchSchema();
    const interval = setInterval(checkHealth, 30000);
    
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      clearInterval(interval);
    };
  }, []);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const data = await res.json();
      setDbStatus(data.status === 'connected' ? 'connected' : 'disconnected');
    } catch (e) {
      setDbStatus('disconnected');
    }
  };

  const fetchSchema = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Internal: Schema Discovery Only' })
      });
      const result = await response.json();
      if (result.success) {
        setSchema(result.data.schema);
        if (result.data.schemaObject) setSchemaObject(result.data.schemaObject);
      }
    } catch (e) {
      console.error("Schema fetch failed", e);
    }
  };

  const handleIngest = async () => {
    if (!rawData) return;
    setIngestLoading(true);
    addLog(`📤 Initiating ingestion into collection "${collectionName}"...`, 'system');
    
    const isJson = (uploadedFile && uploadedFile.name.toLowerCase().endsWith('.json')) || 
                  rawData.trim().startsWith('[') || 
                  rawData.trim().startsWith('{');

    try {
      const response = await fetch(`${API_BASE}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rawData, 
          format: isJson ? 'json' : 'csv',
          collectionName: collectionName || 'sales_data'
        })
      });
      const result = await response.json();
      if (result.success) {
        addLog(`✅ Ingestion successful: ${result.count} records seeded.`, 'success');
        if (result.summary) {
          addLog(`📊 Discovery: ${result.summary.rowCount} rows, ${result.summary.colCount} columns detected.`, 'info');
        }
        setRawData('');
        setUploadedFile(null);
        setVisualsList([]);
        setHasCustomDashboard(false);
        fetchSchema();
      } else {
        addLog(`❌ Ingestion failed: ${result.error}`, 'error');
      }
    } catch (error) {
      addLog(`❌ Connection Error: ${error.message}`, 'error');
    } finally {
      setIngestLoading(false);
    }
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    setUploadedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setRawData(text);
      addLog(`📄 File "${file.name}" loaded successfully.`, 'info');

      // Ingest into a collection matching the file's name
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const sanitizedName = nameWithoutExt.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      setCollectionName(sanitizedName);
      addLog(`📁 Target collection set to: "${sanitizedName}"`, 'info');
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async (queryOverride = null) => {
    const targetQuery = queryOverride !== null && typeof queryOverride === 'string' ? queryOverride : query;
    if (!targetQuery.trim()) return;

    setIsLoading(true);
    setResultData(null);
    addLog(`🚀 Executing Agent Graph query: "${targetQuery}"`, 'system');

    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: targetQuery })
      });
      const result = await response.json();

      if (result.success) {
        addLog('✅ Agent computation completed.', 'success');
        setResultData(result.data);
        if (result.data.schema) setSchema(result.data.schema);
        if (result.data.schemaObject) setSchemaObject(result.data.schemaObject);
        
        // Track visual plots for the dashboard
        if (result.data.isVisual && result.data.plotUrl) {
          const currentColl = result.data.lastCollection || collectionName;
          setVisualsList(prev => {
            const filtered = prev.filter(v => v.collection === currentColl);
            if (filtered.some(v => v.plotUrl === result.data.plotUrl)) {
              return filtered;
            }
            const newItem = {
              plotUrl: result.data.plotUrl,
              query: query,
              title: result.data.visualManifest?.title || 'Visual Analysis',
              insight: result.data.conceptualSummary || result.data.insight || '',
              collection: currentColl
            };
            const updated = [...filtered, newItem];
            addLog(`📊 Visual tracked for Custom Dashboard (${updated.length}/3 required to compile)`, 'info');
            return updated;
          });
        }
      } else {
        addLog(`❌ Analysis error: ${result.error}`, 'error');
        setResultData({ error: result.error });
      }
    } catch (error) {
      addLog(`❌ Backend Connection Failed: ${error.message}`, 'error');
      setResultData({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDashboard = () => {
    setVisualsList([]);
    setHasCustomDashboard(false);
    setActiveTab('dashboard');
    addLog('🗑️ Custom Dashboard reset.', 'system');
  };

  const triggerExport = async () => {
    setExportLoading(true);
    addLog('📤 Export request sent to server...', 'system');
    try {
      const response = await fetch(`${API_BASE}/api/export`);
      const result = await response.json();
      if (result.success) {
        addLog(`✅ CSV exported successfully on server at: ${result.filePath}`, 'success');
      } else {
        addLog(`❌ Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      addLog(`❌ Export server connection error: ${error.message}`, 'error');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden">
      
      {/* 1. collapsible side navigation */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        showCreateDashboardOption={visualsList.length >= 3}
        onCreateDashboard={() => {
          setHasCustomDashboard(true);
          setActiveTab('custom-dashboard');
          addLog('📊 Custom Dashboard generated and active.', 'success');
        }}
        hasCustomDashboard={hasCustomDashboard}
      />

      {/* 2. main app workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative p-4 gap-4">
        
        {/* Top Header bar */}
        <header className="flex items-center justify-between bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl px-5 py-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[var(--accent-gold)] font-bold text-sm tracking-wide">
              Agentic Analyst Console
            </span>
            <span className="hidden sm:inline text-[var(--text-muted)] text-[10px] uppercase tracking-widest font-mono pl-3 border-l border-[var(--border-color)]">
              Model Ingestion & Analytics
            </span>
          </div>

          <div className="flex items-center gap-4">
            <StatusIndicator dbStatus={dbStatus} />
            <button 
              onClick={() => { checkHealth(); fetchSchema(); addLog('🔄 Refreshing connections...', 'info'); }}
              className="p-1.5 hover:bg-[var(--tint)]/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition-colors border border-transparent hover:border-[var(--border-color)]"
              title="Sync Status"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </header>

        {/* Content Layout split */}
        <div className="flex-1 flex gap-4 min-h-0 min-w-0">
          
          {/* LEFT 65%: Chart & Insights viewport (takes 100% on Agentic Dashboard tab) */}
          <div className={`flex flex-col gap-4 min-w-0 h-full min-h-0 ${activeTab === 'agentic-dashboard' ? 'flex-1' : 'flex-[6.5]'}`}>
            {activeTab === 'custom-dashboard' ? (
              <CustomDashboard 
                visuals={visualsList} 
                apiBase={API_BASE} 
                onReset={handleResetDashboard} 
              />
            ) : activeTab === 'agentic-dashboard' ? (
              <AgenticDashboard 
                apiBase={API_BASE} 
                addLog={addLog} 
              />
            ) : (
              <>
                {/* Viewport for charts / scalars */}
                <div className="flex-1 min-h-0">
                  <ChartViewport 
                    resultData={resultData} 
                    isLoading={isLoading} 
                    apiBase={API_BASE}
                    onSelectClarification={(newQuery) => {
                      setQuery(newQuery);
                      handleAnalyze(newQuery);
                    }}
                  />
                </div>
                
                {/* AI Insights report summary */}
                {resultData && (resultData.conceptualSummary || resultData.insight) && (
                  <div className="h-[280px] shrink-0">
                    <InsightPanel insight={resultData.conceptualSummary || resultData.insight} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT 35%: Dynamic contextual sidebar tabs (hidden on Agentic Dashboard tab) */}
          {activeTab !== 'agentic-dashboard' && (
            <div className="flex-[3.5] min-w-[280px] max-w-[420px] h-full min-h-0 flex flex-col gap-4">
              
              {/* Dashboard / Default view / Custom dashboard right side */}
              {(activeTab === 'dashboard' || activeTab === 'custom-dashboard') && (
                <>
                  <div className="flex-1 min-h-0">
                  <SchemaExplorer 
                    schemaObject={schemaObject} 
                    onFieldClick={(field) => setQuery(prev => prev ? `${prev} ${field}` : field)} 
                  />
                </div>
                <div className="h-[220px] shrink-0">
                  <ActivityLog logs={logs} />
                </div>
              </>
            )}

            {/* Ingest panel tab */}
            {activeTab === 'data' && (
              <div className="flex-1 min-h-0">
                <DataIngester 
                  rawData={rawData}
                  setRawData={setRawData}
                  uploadedFile={uploadedFile}
                  setUploadedFile={handleFileUpload}
                  onIngest={handleIngest}
                  ingestLoading={ingestLoading}
                  collectionName={collectionName}
                  setCollectionName={setCollectionName}
                />
              </div>
            )}

            {/* Schema Exploration full-height */}
            {activeTab === 'explore' && (
              <div className="flex-1 min-h-0">
                <SchemaExplorer 
                  schemaObject={schemaObject} 
                  onFieldClick={(field) => setQuery(prev => prev ? `${prev} ${field}` : field)} 
                />
              </div>
            )}

            {/* Exporter panel */}
            {activeTab === 'export' && (
              <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                  <Download size={14} className="text-[var(--accent-gold)]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Export Data Center</span>
                </div>
                
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Export your active MongoDB dataset for external processing or backup.
                </p>

                <div className="flex flex-col gap-3 mt-2">
                  <button
                    onClick={triggerExport}
                    disabled={exportLoading}
                    className="flex items-center justify-center gap-2 py-3 bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] disabled:bg-[var(--tint)]/4 disabled:text-[var(--text-muted)] text-[var(--on-accent)] font-semibold text-xs rounded-lg transition-all"
                  >
                    <span>Export Collection to CSV</span>
                  </button>
                  
                  <span className="text-[9px] text-[var(--text-muted)] leading-normal">
                    * Saved on server at <code>output/analysis_data.csv</code>.
                  </span>
                </div>

                <div className="flex-1" />
                
                <div className="border-t border-[var(--border-color)] pt-3 text-[10px] text-[var(--text-muted)] leading-relaxed">
                  <strong>Python Parity:</strong> All exports follow strict quotes and formatting rules for compatibility with standard analytical notebooks.
                </div>
              </div>
            )}

            {/* Settings panel */}
            {activeTab === 'settings' && (
              <div className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
                  <Settings size={14} className="text-[var(--accent-gold)]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">Settings & Telemetry</span>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Active Engine Target</span>
                    <div className="p-2.5 bg-[var(--well)]/20 rounded border border-[var(--border-color)] text-xs font-mono text-[var(--accent-teal)]">
                      Llama-3.3-70b via Groq
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">MongoDB URI</span>
                    <div className="p-2.5 bg-[var(--well)]/20 rounded border border-[var(--border-color)] text-xs font-mono text-[var(--text-secondary)] truncate">
                      mongodb://localhost:27017
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Local Server Endpoint</span>
                    <div className="p-2.5 bg-[var(--well)]/20 rounded border border-[var(--border-color)] text-xs font-mono text-[var(--text-secondary)]">
                      http://localhost:3001
                    </div>
                  </div>
                </div>

                <div className="flex-1" />
                
                <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider text-center border-t border-[var(--border-color)] pt-3">
                  System Architecture: Agentic Analyst Framework
                </div>
              </div>
            )}
          </div>
        )}
        </div>

        {/* 3. Persistent Command & Query bar at bottom */}
        {activeTab !== 'agentic-dashboard' && (
          <QueryBar 
            query={query} 
            setQuery={setQuery} 
            onSubmit={handleAnalyze} 
            isLoading={isLoading} 
            disabled={dbStatus !== 'connected'} 
          />
        )}

      </div>
    </div>
  );
}

export default App;
