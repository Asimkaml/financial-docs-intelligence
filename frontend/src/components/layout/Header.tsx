import React from 'react';
import { Sun, Moon, Sparkles, Cpu } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Header: React.FC = () => {
  const { theme, toggleTheme, llmConfig, setIsSettingsOpen } = useApp();

  return (
    <header className="h-13 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-10 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span>Financial Intelligence RAG</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono font-medium border border-slate-200 dark:border-slate-700">
                FastAPI
              </span>
            </h1>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Model status chip */}
        {llmConfig && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            title="Click to change model settings"
          >
            <Cpu className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500 dark:text-slate-400 font-mono capitalize">
              {llmConfig.provider}:{' '}
              <span className="text-slate-800 dark:text-slate-200 font-medium">
                {llmConfig.model}
              </span>
            </span>
          </button>
        )}

        {/* Dark / Light mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
