import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 📟 TERMINAL WINDOW
 * High-fidelity, auto-scrolling terminal for real-time agent logs.
 */
const TerminalWindow = ({ logs }) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black/40 font-mono terminal-text overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 bg-white/5 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500/50" />
          <div className="w-2 h-2 rounded-full bg-amber-500/50" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
        </div>
        <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 ml-1">Node Sync Logs</span>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-1.5">
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-3"
            >
              <span className="text-slate-600 shrink-0">
                [{new Date(log.id).toLocaleTimeString([], { hour12: false })}]
              </span>
              <span className={
                log.type === 'error' ? 'text-rose-400' : 
                log.type === 'success' ? 'text-emerald-400' : 
                log.type === 'system' ? 'text-nexus-cyan' : 'text-slate-400'
              }>
                {log.type === 'system' && <span className="mr-1">◈</span>}
                {log.msg}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TerminalWindow;
