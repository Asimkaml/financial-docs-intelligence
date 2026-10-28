import React from 'react';
import { Files, Database } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DocumentStats: React.FC = () => {
  const { documents, activeJob } = useApp();

  const statCards = [
    {
      title: 'Indexed Documents',
      value: documents.length,
      description: 'Filings and reports active in the Qdrant & DuckDB knowledge base',
      icon: Files,
    },
    {
      title: 'Ingestion Status',
      value: activeJob ? activeJob.status.toUpperCase() : 'READY',
      description: activeJob
        ? `Added: ${activeJob.added}, Skipped: ${activeJob.skipped}`
        : 'Index is synced and ready for queries',
      icon: Database,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {statCards.map((card, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {card.title}
            </span>
            <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <card.icon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{card.description}</p>
        </div>
      ))}
    </div>
  );
};
