import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

const ActivityLog = ({ logs = [] }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColorClass = (type) => {
    switch (type) {
      case 'error':
        return 'text-[var(--error)]';
      case 'success':
        return 'text-[var(--success)]';
      case 'system':
        return 'text-[var(--accent-gold)]';
      case 'info':
      default:
        return 'text-[var(--text-secondary)]';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg font-mono">
      {/* Header bar */}
      <div className="p-3 border-b border-[var(--border-color)] bg-[var(--tint)]/1 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[var(--accent-gold)]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
            Activity Log
          </span>
        </div>
        
        {/* Decorative dots */}
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--error)]/20 border border-[var(--error)]/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent-gold)]/20 border border-[var(--accent-gold)]/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--success)]/20 border border-[var(--success)]/40" />
        </div>
      </div>

      {/* Logs Scroll container */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-auto p-3.5 space-y-2 text-[10.5px] leading-normal scroll-smooth"
      >
        {logs.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] mt-4 select-none">
            Awaiting system activities...
          </div>
        ) : (
          logs.map((log) => {
            const timestamp = log.id 
              ? new Date(log.id).toLocaleTimeString([], { hour12: false }) 
              : new Date().toLocaleTimeString([], { hour12: false });
            return (
              <div 
                key={log.id || Math.random()} 
                className="flex items-start gap-2.5 hover:bg-[var(--tint)]/1 py-0.5 rounded transition-colors"
              >
                {/* Monospace Timestamp */}
                <span className="text-[var(--text-muted)] shrink-0 select-none">
                  [{timestamp}]
                </span>
                
                {/* Message */}
                <span className={`${getLogColorClass(log.type)} break-all`}>
                  {log.type === 'system' && <span className="text-[var(--accent-gold)] mr-1">◈</span>}
                  {log.msg}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
