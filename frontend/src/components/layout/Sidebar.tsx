import React from 'react';
import { MessageSquare, FolderKanban, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, setIsSettingsOpen, documents } = useApp();

  const navItems = [
    {
      id: 'chat' as const,
      label: 'Chat Assistant',
      icon: MessageSquare,
      badge: null,
    },
    {
      id: 'documents' as const,
      label: 'Knowledge Base',
      icon: FolderKanban,
      badge: documents.length,
    },
  ];

  return (
    <aside className="w-56 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 backdrop-blur-md flex flex-col justify-between p-3 select-none transition-colors">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigation
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive
                      ? 'bg-slate-800 text-slate-200 dark:bg-slate-700 dark:text-slate-200'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Settings */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>LLM Configuration</span>
        </button>
      </div>
    </aside>
  );
};
