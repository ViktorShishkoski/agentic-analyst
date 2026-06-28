import React, { useState } from 'react';
import { Database, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

const SchemaExplorer = ({ schemaObject, onFieldClick }) => {
  const [expandedCols, setExpandedCols] = useState({});
  const [copiedField, setCopiedField] = useState(null);

  if (!schemaObject || Object.keys(schemaObject).length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--text-muted)] border border-[var(--border-color)] bg-[var(--bg-elevated)] rounded-xl h-full select-none">
        <Database size={24} className="stroke-[1.5] mb-2 opacity-50 text-[var(--accent-gold)]" />
        <span className="text-xs font-semibold uppercase tracking-wider">Awaiting Schema Data</span>
        <span className="text-[10px] mt-1 opacity-70 max-w-[200px]">Ingest a dataset or sync with the database to inspect structured schemas.</span>
      </div>
    );
  }

  const toggleCollection = (colName) => {
    setExpandedCols(prev => ({
      ...prev,
      [colName]: !prev[colName]
    }));
  };

  const handleCopy = (fieldName, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fieldName);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1500);
    if (onFieldClick) {
      onFieldClick(fieldName);
    }
  };

  // Infers column types based on schema values
  const inferType = (fieldInfo) => {
    const vals = fieldInfo.values || [];
    if (vals.length > 0 && vals.every(v => typeof v === 'number')) {
      return 'NUM';
    }
    if (fieldInfo.isCategorical) {
      return 'CAT';
    }
    return 'STR';
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg">
      <div className="p-3 border-b border-[var(--border-color)] bg-white/[0.01] flex items-center gap-2">
        <Database size={14} className="text-[var(--accent-gold)]" />
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">
          Schema Explorer
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {Object.entries(schemaObject).map(([colName, fields]) => {
          const isExpanded = !!expandedCols[colName];
          return (
            <div key={colName} className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-black/10">
              {/* Collection Header */}
              <button
                onClick={() => toggleCollection(colName)}
                className="w-full flex items-center justify-between p-2.5 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[var(--text-primary)]">
                  <span className="text-[var(--accent-teal)]">◈</span>
                  {colName}
                </div>
                {isExpanded ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
              </button>

              {/* Fields List */}
              {isExpanded && (
                <div className="border-t border-[var(--border-color)] divide-y divide-[var(--border-color)]/50 bg-black/20">
                  {Object.entries(fields).map(([fieldName, fieldInfo]) => {
                    const type = inferType(fieldInfo);
                    const isCopied = copiedField === fieldName;
                    
                    return (
                      <div 
                        key={fieldName} 
                        className="group flex flex-col p-2.5 hover:bg-white/[0.01] transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-mono text-xs overflow-hidden">
                            {/* Type Badge */}
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider border shrink-0 ${
                              type === 'NUM' 
                                ? 'bg-[oklch(75%_0.14_85_/_0.06)] text-[var(--accent-gold)] border-[oklch(75%_0.14_85_/_0.15)]'
                                : type === 'CAT'
                                ? 'bg-[oklch(58%_0.07_195_/_0.06)] text-[var(--accent-teal)] border-[oklch(58%_0.07_195_/_0.15)]'
                                : 'bg-white/5 text-[var(--text-secondary)] border-white/10'
                            }`}>
                              {type}
                            </span>
                            <span className="text-[var(--text-secondary)] truncate shrink" title={fieldName}>
                              {fieldName}
                            </span>
                          </div>

                          {/* Copy Action */}
                          <button
                            onClick={(e) => handleCopy(fieldName, e)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shrink-0"
                            title="Copy field name"
                          >
                            {isCopied ? <Check size={12} className="text-[var(--success)]" /> : <Copy size={12} />}
                          </button>
                        </div>

                        {/* Categorical sample values list */}
                        {fieldInfo.values && fieldInfo.values.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1 pl-12">
                            {fieldInfo.values.slice(0, 5).map((val, idx) => (
                              <span 
                                key={idx} 
                                className="text-[9px] font-mono bg-white/[0.03] border border-white/[0.04] text-[var(--text-muted)] px-1.5 py-0.5 rounded-sm"
                              >
                                {String(val)}
                              </span>
                            ))}
                            {fieldInfo.values.length > 5 && (
                              <span className="text-[8px] font-bold text-[var(--text-muted)] self-center pl-1 italic">
                                +{fieldInfo.values.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SchemaExplorer;
