import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const DropzoneUpload: React.FC = () => {
  const { uploadFiles, isIngesting, activeJob } = useApp();
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isIngesting) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isIngesting) return;
    if (e.dataTransfer.files) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = async (files: File[]) => {
    const validFiles = files.filter((f) =>
      f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.md')
    );

    if (validFiles.length === 0) {
      setLocalError('Only .pdf and .md files are supported for ingestion.');
      return;
    }

    setLocalError(null);
    try {
      await uploadFiles(validFiles);
    } catch (err: any) {
      setLocalError(err.message || 'Error occurred during upload initiation.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mb-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isIngesting && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 rounded-xl border border-dashed transition-all ${
          isIngesting
            ? 'border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900/30 cursor-not-allowed'
            : isDragging
            ? 'border-slate-900 bg-slate-100 dark:border-slate-100 dark:bg-slate-800 cursor-pointer'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.md"
          onChange={handleFileInput}
          disabled={isIngesting}
          className="hidden"
        />

        {isIngesting ? (
          <div className="flex flex-col items-center gap-2.5 text-center py-2">
            <Loader2 className="w-8 h-8 text-slate-800 dark:text-slate-200 animate-spin" />
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Indexing Documents ({activeJob?.status || 'running'})...
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mt-0.5 leading-relaxed">
                Parsing layout, extracting financial tables into DuckDB, and chunking text with embeddings. This may take a couple of minutes.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center py-1">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-sm">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Click to browse or drag & drop files
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                PDF financial filings (10-K, 10-Q, Annual Reports) and Markdown files (.md)
              </p>
            </div>
          </div>
        )}
      </div>

      {localError && (
        <div className="mt-2.5 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  );
};
