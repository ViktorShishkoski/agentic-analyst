import React from 'react';
import { ShieldAlert, Copy, Check } from 'lucide-react';

const UniversalSyntaxGuard = ({ discoveryData, onCopy }) => {
    const [copied, setCopied] = React.useState(false);

    if (!discoveryData || Object.keys(discoveryData).length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-[10px] animate-pulse">
                <ShieldAlert size={24} className="mb-2 opacity-50" />
                SYSTEM READY: Awaiting Data Ingest...
            </div>
        );
    }

    // Extract top 5 columns (prioritize categorical)
    const allCols = [];
    Object.keys(discoveryData).forEach(colName => {
        Object.keys(discoveryData[colName]).forEach(field => {
            allCols.push({
                name: field,
                ...discoveryData[colName][field]
            });
        });
    });

    const topCols = allCols
        .sort((a, b) => (b.isCategorical ? 1 : 0) - (a.isCategorical ? 1 : 0))
        .slice(0, 5);

    // Generate Example Prompt
    const generateExample = () => {
        const catCol = topCols.find(c => c.isCategorical && c.values.length >= 2);
        if (catCol) {
            const v1 = catCol.values[0];
            const v2 = catCol.values[1];
            return `Compare ${catCol.name} ${v1} and ${catCol.name} ${v2}`;
        }
        const anyCol = topCols[0];
        if (anyCol && anyCol.values.length > 0) {
            return `Search ${anyCol.name} ${anyCol.values[0]}`;
        }
        return "Compare SEX M and SEX F";
    };

    const examplePrompt = generateExample();

    const handleCopy = () => {
        navigator.clipboard.writeText(examplePrompt);
        setCopied(true);
        if (onCopy) onCopy(examplePrompt);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--guard-bg)] rounded-lg overflow-hidden border-2 border-[var(--warn)]">
            {/* Header */}
            <div className="bg-[var(--warn)] px-3 py-1.5 flex items-center gap-2">
                <ShieldAlert size={14} className="text-[var(--on-accent)]" />
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--on-accent)]">
                    Universal Syntax Guard
                </span>
            </div>

            <div className="flex-1 p-3 overflow-auto font-mono text-[10px] space-y-4">
                {/* Column List */}
                <div className="space-y-2">
                    <div className="text-[8px] font-black uppercase text-slate-500 tracking-tighter">
                        ACTIVE SCHEMA REGISTRY
                    </div>
                    {topCols.map((col, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[var(--code-cyan)] font-bold">
                                    {col.name.includes('.') ? `[JSON] ${col.name}` : col.name}
                                </span>
                                <span className="text-[8px] text-slate-600">
                                    {col.isCategorical ? 'CAT' : 'RAW'}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-400 pl-2 border-l border-[var(--tint)]/5">
                                {col.values.slice(0, 3).join(', ')}
                            </div>
                        </div>
                    ))}
                    {topCols.some(c => c.name.includes('.')) && (
                        <div className="text-[8px] text-[var(--amber)] italic mt-2">
                            * Dot-notation detected. Use 'parent.child' for nested JSON.
                        </div>
                    )}
                </div>

                {/* Prompt Blueprint */}
                <div className="pt-2 border-t border-[var(--tint)]/5">
                    <div className="text-[8px] font-black uppercase text-[var(--warn)] tracking-tighter mb-2">
                        PROMPT BLUEPRINT
                    </div>
                    <div className="text-[var(--guard-text)] leading-relaxed bg-[var(--well)]/40 p-2 rounded">
                        Formula: <span className="text-[var(--code-cyan)]">[Column Name]</span> + <span className="text-[var(--code-cyan)]">[Specific Value]</span>
                    </div>
                </div>

                {/* Example */}
                <div className="bg-[var(--well)]/60 p-2 rounded-lg border border-[var(--code-cyan)]/20 flex items-center justify-between gap-2 group">
                    <div className="flex flex-col gap-1 flex-1">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Dynamic Example</span>
                        <span className="text-nexus-cyan truncate">"{examplePrompt}"</span>
                    </div>
                    <button 
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-[var(--code-cyan)] hover:text-[var(--on-accent)] rounded transition-all text-nexus-cyan"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UniversalSyntaxGuard;
