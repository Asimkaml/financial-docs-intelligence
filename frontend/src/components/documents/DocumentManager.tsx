import React from 'react';
import { DocumentStats } from './DocumentStats';
import { DropzoneUpload } from './DropzoneUpload';
import { DocumentTable } from './DocumentTable';
import { FolderKanban } from 'lucide-react';

export const DocumentManager: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-5">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderKanban className="w-4 h-4" />
            <span>Knowledge Base</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage corporate financial filings and documents in your RAG knowledge base.
          </p>
        </div>
      </div>

      {/* Metrics Header */}
      <DocumentStats />

      {/* Upload Zone */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Upload Documents
        </h3>
        <DropzoneUpload />
      </div>

      {/* Documents Table */}
      <div>
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Indexed Documents
        </h3>
        <DocumentTable />
      </div>
    </div>
  );
};
