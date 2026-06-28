import React from 'react';
import { Lightbulb } from 'lucide-react';

const InsightPanel = ({ insight }) => {
  if (!insight) return null;

  const lines = insight.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table parser: collects rows starting with |
    if (line.trim().startsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      
      const rows = tableLines.filter(l => !l.match(/^\|[\s|:-]+\|$/));
      if (rows.length > 0) {
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-4 border border-[var(--border-color)] rounded-lg bg-black/10">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                {rows.slice(0, 1).map((row, ri) => {
                  const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
                  return (
                    <tr key={`th-${ri}`} className="border-b border-[var(--border-color)] bg-white/[0.02]">
                      {cells.map((cell, ci) => (
                        <th key={`th-cell-${ci}`} className="px-4 py-3 font-semibold text-[var(--accent-gold)] uppercase tracking-wider text-[10px]">
                          {cell.trim()}
                        </th>
                      ))}
                    </tr>
                  );
                })}
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]/40">
                {rows.slice(1).map((row, ri) => {
                  const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
                  return (
                    <tr key={`tr-${ri}`} className="hover:bg-white/[0.01] transition-colors">
                      {cells.map((cell, ci) => (
                        <td key={`td-cell-${ci}`} className="px-4 py-2.5 text-[var(--text-secondary)] font-mono text-[11px]">
                          {cell.trim()}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // H3 (###)
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-xs font-bold uppercase tracking-wider text-[var(--accent-teal)] mt-4 mb-2">
          {line.replace('### ', '')}
        </h3>
      );
    }
    // H2 (##)
    else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] mt-5 mb-2.5 pb-1 border-b border-[var(--border-color)]/30">
          {line.replace('## ', '')}
        </h2>
      );
    }
    // Bold Paragraph lines
    else if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
      elements.push(
        <p key={i} className="font-semibold text-[var(--text-primary)] text-sm mt-3 mb-1">
          {line.trim().replace(/\*\*/g, '')}
        </p>
      );
    }
    // Bullet Points
    else if (line.trim().startsWith('- ')) {
      const parsedText = line.trim().replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--accent-gold)] font-medium">$1</strong>');
      elements.push(
        <div key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)] mb-1.5 pl-2">
          <span className="text-[var(--accent-teal)] mt-0.5 shrink-0">›</span>
          <span dangerouslySetInnerHTML={{ __html: parsedText }} />
        </div>
      );
    }
    // Normal Text with inline strong tags
    else if (line.trim()) {
      const parsedText = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--accent-gold)] font-medium">$1</strong>');
      elements.push(
        <p 
          key={i} 
          className="text-xs leading-relaxed text-[var(--text-secondary)] mb-2"
          dangerouslySetInnerHTML={{ __html: parsedText }}
        />
      );
    }
    // Blank Line Spacer
    else {
      elements.push(<div key={i} className="h-1.5" />);
    }
    
    i++;
  }

  return (
    <div className="flex gap-4 p-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl shadow-lg relative overflow-hidden h-full w-full">
      {/* Accent bar on left side */}
      <div className="accent-bar shrink-0" />

      <div className="flex-1 flex flex-col gap-2.5 min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] shrink-0">
          <Lightbulb size={13} className="text-[var(--accent-gold)]" />
          <span>AI Insight Report</span>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-1">
            {elements}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightPanel;
