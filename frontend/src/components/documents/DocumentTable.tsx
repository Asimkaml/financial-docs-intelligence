import React, { useState } from 'react';
import { FileText, Trash2, Search, RefreshCw, AlertTriangle, FileCode, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DocumentTable: React.FC = () => {
  const { documents, deleteDocument, clearAllDocuments, refreshDocuments, isLoadingDocs, isIngesting } = useApp();
  const [search, setSearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllDocuments();
      setShowClearConfirm(false);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!docToDelete) return;
    const name = docToDelete;
    setDeletingDoc(name);
    try {
      await deleteDocument(name);
      setDocToDelete(null);
    } finally {
      setDeletingDoc(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden transition-colors shadow-sm">
      {/* Table toolbar */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search indexed documents..."
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={refreshDocuments}
            disabled={isLoadingDocs || isIngesting || Boolean(deletingDoc)}
            className="p-1.5 px-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50 text-xs flex items-center gap-1.5"
            title="Refresh document list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDocs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {documents.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={isIngesting || isClearing || Boolean(deletingDoc)}
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear All Confirmation Banner */}
      {showClearConfirm && (
        <div className="p-3.5 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>
              Are you sure you want to clear all indexed documents? This resets Qdrant, DuckDB tables, and document store.
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleClearAll}
              disabled={isClearing}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 font-medium disabled:opacity-50 transition-colors"
            >
              {isClearing ? 'Clearing...' : 'Yes, Clear All'}
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              disabled={isClearing}
              className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Single Document Delete Confirmation Banner */}
      {docToDelete && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>
              Delete document <strong className="font-mono">{docToDelete}</strong>? This removes its points from Qdrant, chunks, and DuckDB tables.
            </span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handleDeleteConfirm}
              disabled={Boolean(deletingDoc)}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 font-medium disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {deletingDoc ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Yes, Delete</span>
              )}
            </button>
            <button
              onClick={() => setDocToDelete(null)}
              disabled={Boolean(deletingDoc)}
              className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-500 font-medium">
              <th className="px-4 py-2.5">Document Name</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                  {search ? 'No matching documents found' : 'No documents in knowledge base yet'}
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => {
                const isPdf = doc.name.toLowerCase().endsWith('.pdf');
                const isThisDeleting = deletingDoc === doc.name;

                return (
                  <tr
                    key={doc.name}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {isPdf ? (
                        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      )}
                      <span className="truncate max-w-md font-mono text-xs">{doc.name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 uppercase">
                      {isPdf ? 'PDF' : 'Markdown'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDocToDelete(doc.name)}
                        disabled={isIngesting || Boolean(deletingDoc) || isClearing}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-40"
                        title={`Delete ${doc.name}`}
                      >
                        {isThisDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
