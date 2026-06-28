import React from 'react';
import { Search, Loader2, Play } from 'lucide-react';

const QueryBar = ({ query = '', setQuery, onSubmit, isLoading = false, disabled = false }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || isLoading || disabled) return;
    if (onSubmit) onSubmit();
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="w-full flex items-center gap-3 p-3 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl shadow-xl shrink-0"
    >
      <div className="flex-1 flex items-center gap-2.5 px-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg focus-within:border-[var(--accent-gold)] focus-within:ring-1 focus-within:ring-[var(--accent-gold)]/30 transition-all">
        <Search size={16} className="text-[var(--text-muted)] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery && setQuery(e.target.value)}
          disabled={isLoading || disabled}
          placeholder="Ask a question or enter an analysis query (e.g. 'Show total sales by product category')..."
          className="w-full py-2.5 bg-transparent border-0 outline-none shadow-none text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-0"
        />
      </div>

      <button
        type="submit"
        disabled={!query.trim() || isLoading || disabled}
        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] disabled:bg-white/[0.04] disabled:text-[var(--text-muted)] disabled:border-transparent text-black font-semibold text-xs rounded-lg border border-[var(--accent-gold)] shadow-md transition-all duration-200"
      >
        {isLoading ? (
          <>
            <Loader2 size={13} className="animate-spin stroke-[2.5]" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Play size={12} className="fill-current stroke-[2.0]" />
            <span>Execute</span>
          </>
        )}
      </button>
    </form>
  );
};

export default QueryBar;
