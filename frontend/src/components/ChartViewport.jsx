import React from 'react';
import { BarChart3, Download, Loader2, AlertCircle } from 'lucide-react';

const ChartViewport = ({ resultData, isLoading = false, apiBase = 'http://localhost:3001', onSelectClarification }) => {
  
  const handleDownload = () => {
    if (!resultData || !resultData.plotUrl) return;
    const url = `${apiBase}${resultData.plotUrl}`;
    
    // Create an anchor element to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = resultData.plotUrl.split('/').pop() || 'plot.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center gap-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-8 shadow-inner select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 border-2 border-[var(--accent-teal)]/20 border-t-[var(--accent-gold)] rounded-full animate-spin" />
          <Loader2 className="absolute text-[var(--accent-gold)] w-6 h-6 animate-pulse" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--accent-gold)] animate-pulse">
          Synthesizing Insights
        </span>
      </div>
    );
  }

  // 1.5 Clarification State
  if (resultData && resultData.isAmbiguous) {
    return (
      <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center p-8 bg-[var(--bg-elevated)] border border-[var(--accent-gold)]/40 rounded-xl shadow-lg">
        <div className="w-12 h-12 rounded-full bg-[var(--accent-gold)]/6 border border-[var(--accent-gold)]/20 flex items-center justify-center mb-4">
          <AlertCircle className="text-[var(--accent-gold)] w-6 h-6 stroke-[1.5]" />
        </div>
        <span className="text-[9px] uppercase tracking-widest text-[var(--accent-gold)] font-black">
          Ambiguity Resolution Required
        </span>
        <h3 className="text-xs font-bold text-center text-[var(--text-primary)] mt-3 mb-5 max-w-md">
          {resultData.clarificationQuestion || "Your query matched multiple possible interpretations. Please select one of the following:"}
        </h3>
        <div className="flex flex-col gap-2 w-full max-w-md">
          {resultData.choices && resultData.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => onSelectClarification && onSelectClarification(choice.query)}
              className="w-full text-left p-3.5 bg-[var(--well)]/30 hover:bg-[var(--accent-gold)]/4 border border-[var(--border-color)] hover:border-[var(--accent-gold)] rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 2. Empty State
  if (!resultData) {
    return (
      <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl opacity-80 select-none">
        <BarChart3 size={48} className="text-[var(--accent-teal)] mb-3 opacity-60 stroke-[1.5]" />
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]">
          Visualization Workspace Idle
        </h3>
        <p className="text-[10px] text-[var(--text-muted)] max-w-xs mt-1.5 leading-relaxed">
          Submit a query in the control panel to generate visual reports and statistical charts.
        </p>
      </div>
    );
  }

  // 3. Error/Failed State (if resultData contains an error)
  if (resultData.error) {
    return (
      <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-elevated)] border border-[var(--error)]/25 rounded-xl">
        <AlertCircle size={36} className="text-[var(--error)] mb-3" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
          Execution Error
        </h3>
        <p className="text-[10px] text-[var(--text-muted)] font-mono max-w-md mt-2 p-2 bg-[var(--well)]/20 rounded border border-[var(--border-color)] overflow-x-auto w-full text-left">
          {resultData.error}
        </p>
      </div>
    );
  }

  // 4. Render Visual Chart (image format)
  if (resultData.isVisual && resultData.plotUrl) {
    return (
      <div className="w-full h-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl p-4 flex items-center justify-center min-h-[200px] relative overflow-hidden group shadow-lg">
        <img 
          src={`${apiBase}${resultData.plotUrl}`} 
          alt="Data Visualization" 
          className="max-w-full max-h-full object-contain rounded-lg shadow-inner bg-[var(--well)]/10 p-2"
        />
        
        {/* Hover reveal download button */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button 
            onClick={handleDownload}
            className="p-2 bg-[var(--bg-overlay)] hover:bg-[var(--accent-gold)] text-[var(--text-primary)] hover:text-[var(--on-accent)] border border-[var(--border-color)] hover:border-transparent rounded-lg shadow-md transition-all duration-200"
            title="Download PNG Plot"
          >
            <Download size={15} />
          </button>
        </div>
      </div>
    );
  }

  // 5. Render Scalar Result Card (No chart, e.g. Count or aggregate number)
  const scalarVal = typeof resultData.mongoOutput === 'object'
    ? JSON.stringify(resultData.mongoOutput[0] || resultData.mongoOutput)
    : String(resultData.mongoOutput || '');

  return (
    <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center p-8 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl shadow-lg">
      <div className="w-12 h-12 rounded-full bg-[var(--accent-gold)]/6 border border-[var(--accent-gold)]/20 flex items-center justify-center mb-4">
        <BarChart3 className="text-[var(--accent-gold)] w-6 h-6 stroke-[1.5]" />
      </div>
      <span className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-black">
        Scalar Metrics Result
      </span>
      <div className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)] mt-3 font-mono">
        {scalarVal}
      </div>
      <span className="text-[10px] text-[var(--text-muted)] italic max-w-xs mt-4 uppercase tracking-widest text-center">
        "No visual rendering is needed for this query output."
      </span>
    </div>
  );
};

export default ChartViewport;
