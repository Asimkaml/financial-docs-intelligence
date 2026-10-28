import React, { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { Send, Paperclip, Loader2, FileText, X, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ChatInput: React.FC = () => {
  const { sendMessage, isSending, isIngesting, uploadFiles } = useApp();
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((f) =>
        f.name.toLowerCase().endsWith('.pdf') || f.name.toLowerCase().endsWith('.md')
      );
      setAttachedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (isSending || isIngesting) return;
    if (!input.trim() && attachedFiles.length === 0) return;

    // If documents are attached, upload them
    if (attachedFiles.length > 0) {
      const filesToUpload = [...attachedFiles];
      setAttachedFiles([]);
      setIsUploadingLocal(true);
      try {
        await uploadFiles(filesToUpload);
      } catch (err) {
        // error already toasted in AppContext
      } finally {
        setIsUploadingLocal(false);
      }
    }

    // If message text is provided
    if (input.trim()) {
      const msg = input.trim();
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      await sendMessage(msg);
    }
  };

  const isDisabled = isSending || isIngesting || isUploadingLocal;

  return (
    <div className="relative max-w-3xl mx-auto w-full px-4 pb-4">
      {/* Ingestion warning if user hovers or is disabled */}
      {isIngesting && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Indexing documents in background. Chat input is paused to preserve search consistency.</span>
        </div>
      )}

      {/* Attached files preview chips */}
      {attachedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="hover:text-rose-500 transition-colors ml-1"
                disabled={isDisabled}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main input container */}
      <div
        className={`relative flex flex-col bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-sm ${
          isDisabled
            ? 'opacity-60 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 cursor-not-allowed'
            : 'border-slate-200 dark:border-slate-700 focus-within:border-slate-900 dark:focus-within:border-slate-100 focus-within:ring-1 focus-within:ring-slate-900/10 dark:focus-within:ring-slate-100/10'
        }`}
      >
        <textarea
          ref={textareaRef}
          value={input}
          disabled={isDisabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isIngesting
              ? 'Document indexing in progress... please wait'
              : isSending
              ? 'Agent is thinking...'
              : 'Ask anything about filings, 10-Ks, balance sheets, tables...'
          }
          rows={1}
          className="w-full bg-transparent px-4 pt-3.5 pb-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none font-sans disabled:cursor-not-allowed"
        />

        <div className="flex items-center justify-between px-3 pb-2 pt-1">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.md"
              onChange={handleFileChange}
              disabled={isDisabled}
              className="hidden"
            />
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              title="Attach PDF or Markdown document for indexing"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Attach File</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={(!input.trim() && attachedFiles.length === 0) || isDisabled}
              onClick={handleSubmit}
              className="p-2 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              title="Send message"
            >
              {isSending || isUploadingLocal ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
