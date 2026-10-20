import React from 'react';
import { LayoutGrid, Download, HelpCircle, FileText, Calendar, Trash2 } from 'lucide-react';

const CustomDashboard = ({ visuals = [], apiBase = 'http://localhost:3001', onReset }) => {
  const handleDownload = (plotUrl) => {
    const url = `${apiBase}${plotUrl}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = plotUrl.split('/').pop() || 'plot.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeCollection = visuals.length > 0 ? visuals[0].collection : 'N/A';

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-y-auto pr-1">
      {/* Dashboard Top bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl px-5 py-4 shrink-0 shadow-md mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/30 shadow-inner">
            <LayoutGrid className="text-[var(--accent-gold)] w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide uppercase">
              Custom Analytical Dashboard
            </h2>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
              <span>Collection: <strong className="text-[var(--accent-teal-light)]">{activeCollection}</strong></span>
              <span className="w-1 h-1 bg-[var(--border-color)] rounded-full" />
              <span>{visuals.length} Visualizations Compiled</span>
            </div>
          </div>
        </div>

        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--error)] hover:bg-[var(--error)]/6 px-3 py-2 rounded-lg border border-[var(--error)]/15 transition-all uppercase tracking-wider"
        >
          <Trash2 size={12} />
          Reset Dashboard
        </button>
      </header>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
        {visuals.map((visual, index) => (
          <div 
            key={index} 
            className="flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-color)] hover:border-[var(--accent-gold)]/40 rounded-xl overflow-hidden shadow-lg transition-all duration-300 group"
          >
            {/* Visual Header */}
            <div className="px-4 py-3 bg-[var(--tint)]/1 border-b border-[var(--border-color)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded bg-[var(--accent-gold)]/8 border border-[var(--accent-gold)]/20 text-[var(--accent-gold)] text-[10px] font-bold font-mono">
                  {index + 1}
                </span>
                <span className="text-[11px] font-semibold text-[var(--text-primary)] max-w-xs truncate" title={visual.title}>
                  {visual.title}
                </span>
              </div>
              <button
                onClick={() => handleDownload(visual.plotUrl)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-gold)] hover:bg-[var(--tint)]/5 rounded transition-all"
                title="Download Visualization"
              >
                <Download size={13} />
              </button>
            </div>

            {/* Query Info Bar */}
            <div className="px-4 py-2 bg-[var(--well)]/20 border-b border-[var(--border-color)] text-[10px] font-mono text-[var(--accent-teal-light)] flex items-center gap-1.5 truncate">
              <span className="text-[var(--text-muted)] font-black text-[9px] uppercase tracking-wider">Query:</span>
              <span className="truncate">{visual.query}</span>
            </div>

            {/* Plot Image Viewport */}
            <div className="flex-1 bg-[var(--well)]/40 p-4 flex items-center justify-center min-h-[260px] max-h-[320px] relative overflow-hidden">
              <img 
                src={`${apiBase}${visual.plotUrl}`} 
                alt={visual.title} 
                className="max-w-full max-h-full object-contain rounded border border-[var(--border-color)]/50 p-1 bg-[var(--well)]/25"
              />
            </div>

            {/* AI Insights & Summarization block */}
            <div className="p-4 bg-[var(--tint)]/1 border-t border-[var(--border-color)] flex flex-col gap-2 min-h-[100px]">
              <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] font-black uppercase tracking-widest">
                <FileText size={10} className="text-[var(--accent-teal)]" />
                <span>Synthesis Intelligence</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">
                {visual.insight ? `"${visual.insight}"` : 'No summary generated.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomDashboard;
