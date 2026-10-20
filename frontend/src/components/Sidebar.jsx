import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Search, 
  Download, 
  Settings, 
  TrendingUp,
  Grid,
  LayoutGrid,
  Sun,
  Moon
} from 'lucide-react';
import { useTheme } from '../theme';

const Sidebar = ({ 
  activeTab = 'dashboard', 
  onTabChange, 
  showCreateDashboardOption = false, 
  onCreateDashboard, 
  hasCustomDashboard = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agentic-dashboard', label: 'Dashboard Builder', icon: LayoutGrid },
  ];

  if (hasCustomDashboard) {
    navItems.push({ id: 'custom-dashboard', label: 'Custom Dashboard', icon: Grid });
  }

  navItems.push(
    { id: 'data', label: 'Data Ingest', icon: Database },
    { id: 'explore', label: 'Explore Schema', icon: Search },
    { id: 'export', label: 'Export Report', icon: Download },
    { id: 'settings', label: 'Settings', icon: Settings },
  );

  return (
    <aside 
      className={`h-screen flex flex-col border-r border-[var(--border-color)] bg-[var(--bg-sidebar)] backdrop-blur-md transition-all duration-300 ease-in-out shrink-0 z-30 ${isHovered ? 'w-[200px]' : 'w-[64px]'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Brand logo section */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-[var(--border-color)] shrink-0 overflow-hidden">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)]/30 shrink-0">
          <TrendingUp className="text-[var(--accent-gold)] w-5 h-5" />
        </div>
        <span className={`font-semibold tracking-wider text-[var(--accent-gold)] text-sm transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 w-0'}`}>
          AGENTIC ANALYST
        </span>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-6 flex flex-col gap-1.5 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange && onTabChange(item.id)}
              className={`flex items-center gap-4.5 w-full rounded-lg py-2.5 px-3 relative transition-all group overflow-hidden ${
                isActive 
                  ? 'bg-[var(--accent-gold)]/6 text-[var(--text-primary)] font-medium' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--tint)]/2 hover:text-[var(--text-primary)]'
              }`}
            >
              {/* Left active accent bar */}
              {isActive && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[var(--accent-gold)] rounded-r" />
              )}
              
              <Icon 
                size={18} 
                className={`shrink-0 stroke-[2.0] transition-colors ${
                  isActive ? 'text-[var(--accent-gold)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
                }`} 
              />
              
              <span className={`text-xs tracking-wide text-left transition-opacity duration-200 whitespace-nowrap ${isHovered ? 'opacity-100' : 'opacity-0 w-0'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {showCreateDashboardOption && !hasCustomDashboard && (
          <div className="mt-auto pt-4 border-t border-[var(--border-color)]">
            <button
              onClick={onCreateDashboard}
              className="flex items-center gap-4.5 w-full rounded-lg py-2.5 px-3 bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/25 border border-[var(--accent-gold)]/30 transition-all font-semibold text-xs overflow-hidden group"
              title="Create Custom Dashboard"
            >
              <Grid size={18} className="shrink-0 stroke-[2.0] text-[var(--accent-gold)] animate-pulse" />
              <span className={`text-xs tracking-wide text-left transition-opacity duration-200 whitespace-nowrap font-bold text-[var(--accent-gold)] ${isHovered ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                Create Dashboard
              </span>
            </button>
          </div>
        )}
      </nav>

      {/* Theme switch: light (default) / dark */}
      <div className="px-2 pb-3 shrink-0">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          role="switch"
          aria-checked={isDark}
          aria-label="Dark theme"
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="flex items-center gap-4.5 w-full rounded-lg py-2.5 px-3 text-[var(--text-secondary)] hover:bg-[var(--tint)]/5 hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-all overflow-hidden"
        >
          {isDark
            ? <Moon size={18} className="shrink-0 stroke-[2.0] text-[var(--accent-gold)]" />
            : <Sun size={18} className="shrink-0 stroke-[2.0] text-[var(--accent-gold)]" />}
          <span className={`flex-1 flex items-center justify-between text-xs tracking-wide whitespace-nowrap transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0 w-0'}`}>
            Dark theme
            <span className={`relative inline-block w-7 h-4 rounded-full transition-colors ${isDark ? 'bg-[var(--accent-gold)]' : 'bg-[var(--border-color)]'}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-[var(--bg-elevated)] shadow transition-all ${isDark ? 'left-3.5' : 'left-0.5'}`} />
            </span>
          </span>
        </button>
      </div>

      {/* Footer system tag */}
      <div className="p-4 border-t border-[var(--border-color)] flex items-center justify-center shrink-0">
        <span className={`text-[9px] text-[var(--text-muted)] tracking-widest uppercase font-mono ${isHovered ? 'block' : 'hidden'}`}>
          v3.5 FLASH
        </span>
        <span className={`text-[10px] text-[var(--accent-teal)] font-mono font-bold ${!isHovered ? 'block' : 'hidden'}`}>
          Ω
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
