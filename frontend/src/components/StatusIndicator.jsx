import React from 'react';
import { Database, Cpu } from 'lucide-react';

const StatusIndicator = ({ dbStatus = 'disconnected' }) => {
  const getStatusColor = () => {
    switch (dbStatus) {
      case 'connected':
        return 'text-[var(--success)] bg-[oklch(65%_0.15_160_/_0.1)] border-[oklch(65%_0.15_160_/_0.2)]';
      case 'checking':
        return 'text-[var(--accent-gold)] bg-[oklch(75%_0.14_85_/_0.1)] border-[oklch(75%_0.14_85_/_0.2)]';
      case 'disconnected':
      default:
        return 'text-[var(--error)] bg-[oklch(62%_0.18_25_/_0.1)] border-[oklch(62%_0.18_25_/_0.2)]';
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
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border-color)] bg-white/[0.02] text-[var(--text-secondary)] text-[10px] font-medium tracking-wide uppercase">
        <Cpu size={10} className="text-[var(--accent-teal)] stroke-[2.5]" />
        <span>Engine: <span className="text-[var(--accent-gold)]">Groq</span></span>
      </div>
    </div>
  );
};

export default StatusIndicator;
