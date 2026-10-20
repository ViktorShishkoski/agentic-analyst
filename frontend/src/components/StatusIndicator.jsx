import React from 'react';
import { Database, Cpu } from 'lucide-react';

const StatusIndicator = ({ dbStatus = 'disconnected' }) => {
  const getStatusColor = () => {
    switch (dbStatus) {
      case 'connected':
        return 'text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20';
      case 'checking':
        return 'text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 border-[var(--accent-gold)]/20';
      case 'disconnected':
      default:
        return 'text-[var(--error)] bg-[var(--error)]/10 border-[var(--error)]/20';
    }
  };

  const getStatusLabel = () => {
    switch (dbStatus) {
      case 'connected':
        return 'Secure';
      case 'checking':
        return 'Syncing...';
      case 'disconnected':
      default:
        return 'Offline';
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* DB Connection Pill */}
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium tracking-wide uppercase transition-all duration-300 ${getStatusColor()}`}>
        <Database size={10} className="stroke-[2.5]" />
        <span>DB: {getStatusLabel()}</span>
      </div>

      {/* AI Engine Pill */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border-color)] bg-[var(--tint)]/2 text-[var(--text-secondary)] text-[10px] font-medium tracking-wide uppercase">
        <Cpu size={10} className="text-[var(--accent-teal)] stroke-[2.5]" />
        <span>Engine: <span className="text-[var(--accent-gold)]">Groq</span></span>
      </div>
    </div>
  );
};

export default StatusIndicator;
