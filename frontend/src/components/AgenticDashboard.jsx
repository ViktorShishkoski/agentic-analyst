import React, { useState, useEffect, useRef } from 'react';
import { useTheme, themeColor } from '../theme';
import { 
  Play, 
  Settings, 
  Download, 
  Trash2, 
  HelpCircle, 
  FileText, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle, 
  Grid, 
  Activity, 
  BarChart2, 
  LineChart, 
  PieChart, 
  Sparkles, 
  ArrowUp, 
  ArrowDown,
  Info,
  Lock
} from 'lucide-react';

const PROMPT_EXAMPLES = [
  {
    title: "Borough & Cuisine Overview",
    prompt: "Show me the count of restaurants in each borough, count of restaurants by cuisine, and average inspection score by cuisine"
  },
  {
    title: "Violation Scores & Grades",
    prompt: "Compare inspection scores by borough, critical violations count by cuisine, and the count of each grade assigned"
  },
  {
    title: "Grade Distributions",
    prompt: "Plot grade distribution in Manhattan, grade distribution in Brooklyn, and average scores by grade"
  }
];

const PlotlyChart = ({ spec, chartType }) => {
  const containerRef = useRef(null);
  const [theme] = useTheme();

  useEffect(() => {
    if (!containerRef.current || !window.Plotly) return;

    // Deep copy spec so we do not mutate original. The backend paints the main
    // series orange (#FF6B35); swap it for the active theme's accent colour.
    const chartAccent = themeColor('--chart-accent') || '#FF6B35';
    const localSpec = JSON.parse(JSON.stringify(spec).replace(/#FF6B35/gi, chartAccent));
    localSpec.layout = localSpec.layout || {};
    localSpec.layout.autosize = true;
    localSpec.layout.responsive = true;

    // Apply client-side chart type overrides
    if (chartType && localSpec.data && localSpec.data[0]) {
      const type = chartType.toLowerCase();
      if (type === 'line') {
        localSpec.data[0].type = 'scatter';
        localSpec.data[0].mode = 'lines+markers';
        if (localSpec.data[0].labels) {
          localSpec.data[0].x = localSpec.data[0].labels;
          localSpec.data[0].y = localSpec.data[0].values;
          delete localSpec.data[0].labels;
          delete localSpec.data[0].values;
        }
      } else if (type === 'scatter') {
        localSpec.data[0].type = 'scatter';
        localSpec.data[0].mode = 'markers';
        if (localSpec.data[0].labels) {
          localSpec.data[0].x = localSpec.data[0].labels;
          localSpec.data[0].y = localSpec.data[0].values;
          delete localSpec.data[0].labels;
          delete localSpec.data[0].values;
        }
      } else if (type === 'bar') {
        localSpec.data[0].type = 'bar';
        delete localSpec.data[0].mode;
        if (localSpec.data[0].labels) {
          localSpec.data[0].x = localSpec.data[0].labels;
          localSpec.data[0].y = localSpec.data[0].values;
          delete localSpec.data[0].labels;
          delete localSpec.data[0].values;
        }
      } else if (type === 'pie') {
        localSpec.data[0].type = 'pie';
        if (localSpec.data[0].x && !localSpec.data[0].labels) {
          localSpec.data[0].labels = localSpec.data[0].x;
          localSpec.data[0].values = localSpec.data[0].y;
          delete localSpec.data[0].x;
          delete localSpec.data[0].y;
        }
      }
    }

    // Match the chart chrome to the active theme
    const chartText = themeColor('--chart-text');
    const chartTick = themeColor('--chart-tick');
    const chartGrid = themeColor('--chart-grid');
    localSpec.layout.paper_bgcolor = 'rgba(0,0,0,0)';
    localSpec.layout.plot_bgcolor = 'rgba(0,0,0,0)';
    localSpec.layout.font = { color: chartText, family: 'DM Sans, sans-serif' };
    if (localSpec.layout.title && localSpec.layout.title.font) {
      localSpec.layout.title.font.color = chartText;
    }

    if (localSpec.layout.xaxis) {
      localSpec.layout.xaxis.gridcolor = chartGrid;
      localSpec.layout.xaxis.zerolinecolor = chartGrid;
      localSpec.layout.xaxis.tickfont = { color: chartTick, size: 9 };
    }
    if (localSpec.layout.yaxis) {
      localSpec.layout.yaxis.gridcolor = chartGrid;
      localSpec.layout.yaxis.zerolinecolor = chartGrid;
      localSpec.layout.yaxis.tickfont = { color: chartTick, size: 9 };
    }

    window.Plotly.newPlot(containerRef.current, localSpec.data, localSpec.layout, {
      responsive: true,
      displayModeBar: false
    });

    const handleResize = () => {
      if (containerRef.current && window.Plotly) {
        window.Plotly.Plots.resize(containerRef.current);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && window.Plotly) {
        window.Plotly.purge(containerRef.current);
      }
    };
  }, [spec, chartType, theme]);

  return <div ref={containerRef} className="w-full h-full min-h-[220px]" />;
};

const AgenticDashboard = ({ apiBase = 'http://localhost:3001', addLog }) => {
  const [prompt, setPrompt] = useState('');
  const [goals, setGoals] = useState([]);
  const [cards, setCards] = useState([]);
  
  // Workflow States: 'input' | 'planning' | 'executing' | 'dashboard'
  const [workflowState, setWorkflowState] = useState('input');
  const [loading, setLoading] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  
  // Explanation Modal/Overlay state
  const [explanation, setExplanation] = useState(null);
  const [explainingCardId, setExplainingCardId] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // PDF Download state
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Generate Plan Preview
  const handleGeneratePlan = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setWorkflowState('planning');
    setExecutionLogs(['📡 Initiating schema discovery...', '🗺️ Querying Planner Node...']);
    
    try {
      const response = await fetch(`${apiBase}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt })
      });
      const result = await response.json();
      
      if (result.success && result.goals && result.goals.length > 0) {
        setGoals(result.goals);
        setExecutionLogs(prev => [...prev, `✅ Planner decomposed query into ${result.goals.length} distinct goals.`]);
      } else {
        throw new Error(result.error || 'Failed to split query into visual goals.');
      }
    } catch (error) {
      console.error('Plan failed:', error);
      setExecutionLogs(prev => [...prev, `❌ Error generating plan: ${error.message}`]);
      if (addLog) addLog(`Plan error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Run approved plan
  const handleExecuteDashboard = async () => {
    setLoading(true);
    setWorkflowState('executing');
    setExecutionLogs(prev => [...prev, '🚀 Plan approved. Initiating parallel map-reduce branches...']);
    
    // Set up placeholders
    const initialCards = goals.map(goal => ({
      id: goal.id,
      title: goal.title || 'Visual Report',
      query: goal.intent,
      chartType: goal.chart_type || 'bar',
      status: 'loading',
      error: null
    }));
    setCards(initialCards);

    try {
      const response = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: prompt,
          mode: 'multichart',
          goals: goals,
          isPlanApproved: true
        })
      });
      const result = await response.json();

      if (result.success && result.data.results) {
        const compiledCards = goals.map(goal => {
          const match = result.data.results.find(r => r.id === goal.id) || {};
          return {
            id: goal.id,
            title: match.title || goal.title,
            query: match.query || goal.intent,
            chartType: goal.chart_type || 'bar',
            plotlySpec: match.plotlySpec,
            insight: match.insight || match.caption || result.data.conceptualSummary || '',
            rawData: match.rawData || [],
            queryPlan: match.queryPlan || {},
            status: match.error ? 'failed' : 'success',
            error: match.error || null
          };
        });
        setCards(compiledCards);
        setWorkflowState('dashboard');
        setExecutionLogs(prev => [...prev, '🏆 Dashboard generation complete!']);
        if (addLog) addLog('Agentic multi-chart dashboard builder complete.', 'success');
      } else {
        throw new Error(result.error || 'Empty results returned from dashboard generator.');
      }
    } catch (error) {
      console.error('Execution failed:', error);
      setExecutionLogs(prev => [...prev, `❌ Graph execution failed: ${error.message}`]);
      if (addLog) addLog(`Execution failed: ${error.message}`, 'error');
      // Set all loading cards to failed
      setCards(prev => prev.map(c => c.status === 'loading' ? { ...c, status: 'failed', error: error.message } : c));
      setWorkflowState('dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Re-run single card
  const handleReRunCard = async (cardId, cardQuery) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'loading', error: null } : c));
    if (addLog) addLog(`Re-executing isolated card: ${cardId}...`, 'info');
    
    try {
      const response = await fetch(`${apiBase}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: cardQuery,
          mode: 'multichart'
        })
      });
      const result = await response.json();
      
      if (result.success && result.data.results && result.data.results.length > 0) {
        const match = result.data.results[0];
        setCards(prev => prev.map(c => c.id === cardId ? {
          ...c,
          status: match.error ? 'failed' : 'success',
          plotlySpec: match.plotlySpec || c.plotlySpec,
          insight: match.insight || match.caption || c.insight || '',
          rawData: match.rawData || c.rawData,
          queryPlan: match.queryPlan || c.queryPlan,
          error: match.error || null
        } : c));
        if (addLog) addLog(`Card ${cardId} re-executed successfully.`, 'success');
      } else {
        throw new Error(result.error || 'Failed to update visualization.');
      }
    } catch (error) {
      console.error('Card rerun failed:', error);
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, status: 'failed', error: error.message } : c));
      if (addLog) addLog(`Card rerun error: ${error.message}`, 'error');
    }
  };

  // Explain single card deep dive
  const handleExplainCard = async (card) => {
    if (!card.plotlySpec || !card.rawData || card.rawData.length === 0) return;
    setExplainingCardId(card.id);
    setIsExplaining(true);
    setExplanation(null);
    if (addLog) addLog(`Synthesizing deep dive for: "${card.title}"...`, 'system');

    try {
      const response = await fetch(`${apiBase}/api/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chartTitle: card.title,
          query: card.query,
          rawData: card.rawData
        })
      });
      const result = await response.json();
      if (result.success) {
        setExplanation(result.explanation);
      } else {
        throw new Error(result.error || 'Failed to generate explanation.');
      }
    } catch (error) {
      console.error('Explanation failed:', error);
      setExplanation(`❌ Error generating explanation: ${error.message}`);
    } finally {
      setIsExplaining(false);
    }
  };

  // Export to A4 PDF
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    if (addLog) addLog('Generating print-friendly HTML and compiling A4 PDF report...', 'system');
    
    try {
      const response = await fetch(`${apiBase}/api/export/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: prompt || "Agentic Multi-Chart Dashboard Report",
          cards: cards.map(c => ({
            title: c.title,
            query: c.query,
            plotlySpec: c.plotlySpec,
            insight: c.insight || ''
          }))
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `agentic_dashboard_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        if (addLog) addLog('A4 PDF report downloaded successfully.', 'success');
      } else {
        throw new Error('Server returned non-200 status.');
      }
    } catch (error) {
      console.error('PDF Export failed:', error);
      if (addLog) addLog(`PDF Export failed: ${error.message}`, 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Drag and Reorder cards
  const moveCard = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= cards.length) return;
    const updated = [...cards];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setCards(updated);
  };

  // Inline edit plan goals
  const updateGoal = (index, field, value) => {
    const updated = [...goals];
    updated[index] = { ...updated[index], [field]: value };
    setGoals(updated);
  };

  // Reset
  const handleReset = () => {
    setPrompt('');
    setGoals([]);
    setCards([]);
    setWorkflowState('input');
    setExecutionLogs([]);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-y-auto pr-1">
      {/* Top dashboard header bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl px-5 py-4 shrink-0 shadow-md mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/30 shadow-inner">
            <Sparkles className="text-[var(--accent-gold)] w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide uppercase">
              Agentic Dashboard Builder
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
              <span>Parallel map-reduce engine</span>
              <span className="w-1 h-1 bg-[var(--border-color)] rounded-full" />
              <span>Declarative Plotly Render</span>
            </div>
          </div>
        </div>

        {workflowState !== 'input' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--error)] hover:bg-[var(--error)]/6 px-3 py-2 rounded-lg border border-[var(--error)]/15 transition-all uppercase tracking-wider"
          >
            <Trash2 size={12} />
            Reset Builder
          </button>
        )}
      </header>

      {/* Main workspace logic */}
      <div className="flex-1 min-h-0 flex flex-col justify-start">
        
        {/* Phase 1: Prompt Input Screen */}
        {workflowState === 'input' && (
          <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full py-8">
            <div className="text-center">
              <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wide">
                Describe Your Multi-Chart Dashboard
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-md mx-auto">
                The agent will split your prompt into distinct visual targets, validate schemas, and run them concurrently.
              </p>
            </div>

            {/* Input Box */}
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 shadow-lg flex flex-col gap-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Show me counts of restaurants by borough, top cuisines by star rating, and grade distributions in Manhattan."
                className="w-full bg-[var(--well)]/35 border border-[var(--border-color)] rounded-lg p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-gold)] min-h-[90px] resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleGeneratePlan}
                  disabled={!prompt.trim() || loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] disabled:bg-[var(--tint)]/4 disabled:text-[var(--text-muted)] text-[var(--on-accent)] font-semibold text-xs rounded-lg transition-all uppercase tracking-wider"
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                  Decompose & Plan
                </button>
              </div>
            </div>

            {/* Reference Prompt Library */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                <Info size={11} className="text-[var(--accent-gold)]" />
                Prompt reference library
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PROMPT_EXAMPLES.map((ex, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(ex.prompt)}
                    className="flex flex-col text-left p-3.5 bg-[var(--bg-elevated)] hover:bg-[var(--tint)]/2 border border-[var(--border-color)] hover:border-[var(--accent-gold)]/30 rounded-xl transition-all duration-300 group"
                  >
                    <span className="text-[10px] font-bold text-[var(--accent-gold)] uppercase tracking-wider mb-1">
                      {ex.title}
                    </span>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed line-clamp-3 group-hover:text-[var(--text-primary)]">
                      "{ex.prompt}"
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Plan Preview Screen */}
        {workflowState === 'planning' && (
          <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full py-4">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-5 shadow-lg flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-[var(--accent-gold)]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Proposed Visualization Goals
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">
                  Step 2: User Authorization Required
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RefreshCw size={24} className="text-[var(--accent-gold)] animate-spin" />
                  <span className="text-xs text-[var(--text-secondary)] font-mono">Synthesizing visual plan...</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    {goals.map((goal, index) => (
                      <div 
                        key={goal.id} 
                        className="bg-[var(--well)]/20 border border-[var(--border-color)] rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between"
                      >
                        <div className="flex-1 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded bg-[var(--accent-gold)]/8 border border-[var(--accent-gold)]/20 text-[var(--accent-gold)] text-[10px] font-bold font-mono">
                              {index + 1}
                            </span>
                            <input 
                              type="text" 
                              value={goal.title} 
                              onChange={(e) => updateGoal(index, 'title', e.target.value)}
                              className="bg-transparent border-b border-transparent focus:border-[var(--accent-gold)] text-xs font-bold text-[var(--text-primary)] w-full py-0.5 focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-mono text-gray-500 uppercase">Intent:</span>
                            <input 
                              type="text" 
                              value={goal.intent} 
                              onChange={(e) => updateGoal(index, 'intent', e.target.value)}
                              className="bg-transparent border-b border-transparent focus:border-[var(--accent-gold)] text-[11px] text-[var(--text-secondary)] w-full py-0.5 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 self-center shrink-0">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] text-gray-500 font-mono uppercase">Collection</span>
                            <span className="text-[10px] font-mono text-[var(--accent-teal-light)] bg-[var(--well)]/45 border border-[var(--border-color)] px-2 py-1 rounded">
                              {goal.collection}
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] text-gray-500 font-mono uppercase">Chart Type</span>
                            <select
                              value={goal.chart_type}
                              onChange={(e) => updateGoal(index, 'chart_type', e.target.value)}
                              className="text-[10px] font-mono text-[var(--accent-gold)] bg-[var(--well)]/45 border border-[var(--border-color)] px-1.5 py-1 rounded focus:outline-none focus:border-[var(--accent-gold)]"
                            >
                              <option value="bar">Bar</option>
                              <option value="line">Line</option>
                              <option value="scatter">Scatter</option>
                              <option value="pie">Pie</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center border-t border-[var(--border-color)] pt-4 mt-2">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 border border-[var(--border-color)] rounded-lg text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--tint)]/5 transition-all uppercase tracking-wider"
                    >
                      Discard & Edit
                    </button>
                    <button
                      onClick={handleExecuteDashboard}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] text-[var(--on-accent)] font-semibold text-xs rounded-lg transition-all uppercase tracking-wider"
                    >
                      <span>Approve & Build Dashboard</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Live Console Logs */}
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 shadow-inner">
              <span className="text-[9px] font-black font-mono text-[var(--text-muted)] uppercase tracking-wider block mb-2">
                HUD Operations Telemetry
              </span>
              <div className="bg-[var(--well)]/35 rounded border border-[var(--border-color)]/30 p-3 h-[90px] overflow-y-auto font-mono text-[10px] text-[var(--accent-teal-light)] flex flex-col gap-1">
                {executionLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: Executing Map-Reduce Pipeline */}
        {workflowState === 'executing' && (
          <div className="flex flex-col gap-6 max-w-xl mx-auto w-full py-16 justify-center items-center">
            <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent-gold)]/6 border border-[var(--accent-gold)]/20 animate-pulse mb-2">
              <RefreshCw className="text-[var(--accent-gold)] w-8 h-8 animate-spin" />
            </div>
            
            <div className="text-center">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Executing Parallel Analytics Pipeline
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono">
                Spawning isolated Docker worker containers...
              </p>
            </div>

            <div className="w-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 shadow-lg mt-2">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest block mb-2">
                Concurrency logs
              </span>
              <div className="bg-[var(--well)]/45 rounded border border-[var(--border-color)] p-3 font-mono text-[10px] text-[var(--accent-teal)] min-h-[120px] max-h-[160px] overflow-y-auto flex flex-col gap-1.5">
                {executionLogs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Phase 4: Final Dashboard Grid */}
        {workflowState === 'dashboard' && (
          <div className="flex flex-col gap-4 pb-8">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-elevated)] border border-[var(--border-color)]/70 px-4 py-3 rounded-xl shadow-md shrink-0">
              <div className="flex items-center gap-2">
                <Grid size={15} className="text-[var(--accent-teal)]" />
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Interactive Grid Workspace
                </span>
                <span className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--well)]/45 border border-[var(--border-color)] px-2 py-0.5 rounded uppercase">
                  {cards.length} goals fanned-in
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--on-accent)] bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] disabled:bg-[var(--tint)]/4 disabled:text-[var(--text-muted)] px-3 py-2 rounded-lg transition-all uppercase tracking-wider cursor-pointer"
                >
                  {isExportingPDF ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                  Export PDF (A4)
                </button>
              </div>
            </div>

            {/* Dashboard grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {cards.map((card, index) => (
                <div 
                  key={card.id} 
                  className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-color)] hover:border-[var(--accent-gold)]/40 rounded-xl overflow-hidden shadow-lg transition-all duration-300 relative group"
                >
                  {/* Card header */}
                  <div className="px-4 py-3 bg-[var(--tint)]/1 border-b border-[var(--border-color)] flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <span className="flex items-center justify-center w-5 h-5 rounded bg-[var(--accent-gold)]/8 border border-[var(--accent-gold)]/20 text-[var(--accent-gold)] text-[10px] font-bold font-mono">
                        {index + 1}
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate" title={card.title}>
                        {card.title}
                      </span>
                    </div>

                    {/* Left/Right reorder + Card Actions */}
                    <div className="flex items-center gap-1">
                      {/* Reordering */}
                      <button
                        onClick={() => moveCard(index, -1)}
                        disabled={index === 0}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-gold)] disabled:opacity-30 rounded hover:bg-[var(--tint)]/5 transition-all"
                        title="Move Up/Left"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => moveCard(index, 1)}
                        disabled={index === cards.length - 1}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-gold)] disabled:opacity-30 rounded hover:bg-[var(--tint)]/5 transition-all"
                        title="Move Down/Right"
                      >
                        <ArrowDown size={12} />
                      </button>
                      <span className="w-[1px] h-3.5 bg-[var(--border-color)] mx-1" />

                      {/* Chart Type Selector */}
                      {card.status === 'success' && (
                        <select
                          value={card.chartType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            setCards(prev => prev.map(c => c.id === card.id ? { ...c, chartType: newType } : c));
                          }}
                          className="text-[9px] font-mono text-[var(--accent-gold)] bg-[var(--well)]/45 border border-[var(--border-color)] px-1 rounded mr-1 focus:outline-none"
                        >
                          <option value="bar">Bar</option>
                          <option value="line">Line</option>
                          <option value="scatter">Scatter</option>
                          <option value="pie">Pie</option>
                        </select>
                      )}

                      {/* Card Rerun */}
                      <button
                        onClick={() => handleReRunCard(card.id, card.query)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-gold)] rounded hover:bg-[var(--tint)]/5 transition-all"
                        title="Re-run pipeline for this goal"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Query info bar */}
                  <div className="px-4 py-2 bg-[var(--well)]/20 border-b border-[var(--border-color)] text-[10px] font-mono text-[var(--accent-teal-light)] flex items-center gap-1.5 truncate">
                    <span className="text-[var(--text-muted)] font-black text-[9px] uppercase tracking-wider shrink-0">Target Intent:</span>
                    <span className="truncate">{card.query}</span>
                  </div>

                  {/* Core Chart Render Viewport */}
                  <div className="flex-1 bg-[var(--well)]/35 p-4 flex items-center justify-center min-h-[260px] relative overflow-hidden">
                    {card.status === 'loading' && (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw size={20} className="text-[var(--accent-gold)] animate-spin" />
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">Running pipeline...</span>
                      </div>
                    )}

                    {card.status === 'failed' && (
                      <div className="flex flex-col items-center justify-center gap-2 max-w-xs text-center p-4">
                        <span className="text-[18px] text-[var(--error)]">🛑</span>
                        <span className="text-[10px] font-mono text-[var(--error)] font-bold uppercase">Execution contained</span>
                        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed italic line-clamp-3">
                          {card.error || 'Failed to complete goals.'}
                        </p>
                      </div>
                    )}

                    {card.status === 'success' && card.plotlySpec && (
                      <PlotlyChart spec={card.plotlySpec} chartType={card.chartType} />
                    )}
                  </div>

                  {/* Caption & Explain deep-dive trigger */}
                  <div className="p-4 bg-[var(--tint)]/1 border-t border-[var(--border-color)] flex flex-col gap-2 min-h-[110px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">
                        <FileText size={10} className="text-[var(--accent-teal)]" />
                        <span>Synthesis Intelligence</span>
                      </div>
                      
                      {card.status === 'success' && (
                        <button
                          onClick={() => handleExplainCard(card)}
                          className="flex items-center gap-1 text-[8px] font-bold text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 px-2 py-0.5 border border-[var(--accent-gold)]/20 rounded transition-all uppercase tracking-wider cursor-pointer"
                        >
                          <Sparkles size={9} />
                          Deep Dive Explanation
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic line-clamp-3">
                      {card.insight ? `"${card.insight}"` : 'No analytical summary generated.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Privacy Alert Disclosure footer */}
            <footer className="mt-6 bg-[var(--bg-elevated)] border border-[var(--border-color)] p-4 rounded-xl flex items-center gap-3.5">
              <div className="flex items-center justify-center w-8 h-8 rounded bg-[var(--tint)]/5 text-[var(--accent-gold)] shrink-0">
                <Lock size={15} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-extrabold uppercase text-[var(--text-secondary)] tracking-wider">
                  Privacy Disclosure & Telemetry Compliance
                </span>
                <p className="text-[9px] text-[var(--text-muted)] leading-relaxed">
                  All processed restaurant inspection analytical reports utilize free-tier developer LLM service endpoints. Ensure no restricted personal data is populated. Complete system details under settings.
                </p>
              </div>
            </footer>
          </div>
        )}

      </div>

      {/* Explanation overlay modal */}
      {explainingCardId !== null && (
        <div className="fixed inset-0 bg-[var(--backdrop)]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-elevated)] border border-[var(--accent-gold)]/30 rounded-xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--accent-gold)]" />
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Narrative Deep Dive Analysis
                </span>
              </div>
              <button 
                onClick={() => { setExplainingCardId(null); setExplanation(null); }}
                className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--text-primary)] px-2 py-0.5 rounded"
              >
                CLOSE [ESC]
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[350px]">
              {isExplaining ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <RefreshCw size={24} className="text-[var(--accent-gold)] animate-spin" />
                  <span className="text-xs text-[var(--text-secondary)] font-mono">Synthesizing data relationships...</span>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                  {explanation}
                </p>
              )}
            </div>
            
            <div className="px-5 py-3 bg-[var(--well)]/25 border-t border-[var(--border-color)] text-[8px] font-mono text-gray-500 uppercase tracking-widest text-center">
              Agentic Analyst Liaison Engine v3.5
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AgenticDashboard;
