import React, { useRef, useEffect } from 'react';
import { MessageItem } from './MessageItem';
import { ChatInput } from './ChatInput';
import { useApp } from '../../context/AppContext';
import { Sparkles, TrendingUp, FileSpreadsheet, RotateCcw, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

const SUGGESTED_QUERIES = [
  {
    icon: TrendingUp,
    title: 'Revenue & Margins',
    query: 'What was the total revenue, gross margin, and net profit in the most recent filing?',
  },
  {
    icon: FileSpreadsheet,
    title: 'Balance Sheet Health',
    query: 'Summarize total assets, current liabilities, and long-term debt from the balance sheet.',
  },
  {
    icon: Sparkles,
    title: 'Cash Flow Analysis',
    query: 'Compare operating cash flow against capital expenditures for the last reported period.',
  },
];

export const ChatContainer: React.FC = () => {
  const { messages, sendMessage, resetChat, documents, isIngesting, activeJob } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar within chat */}
      <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-900 dark:bg-slate-100" />
          <h2 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Financial Assistant
          </h2>
          <span className="text-[11px] text-slate-400">
            ({documents.length} {documents.length === 1 ? 'doc' : 'docs'} indexed)
          </span>
        </div>

        <button
          onClick={resetChat}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
          title="Reset conversation session"
        >
          <RotateCcw className="w-3 h-3" />
          <span>New Session</span>
        </button>
      </div>

      {/* Ingestion warning banner */}
      {isIngesting && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-4 py-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>
            Document indexing in progress ({activeJob?.status || 'processing'}
            )... Chat is temporarily paused to avoid querying an incomplete index.
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-3 max-w-3xl mx-auto w-full"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[55vh] text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-3 shadow-sm">
              <Sparkles className="w-6 h-6 text-slate-700 dark:text-slate-300" />
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Financial Intelligence RAG
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              Ask deep questions across your filings, balance sheets, and narrative disclosures with multi-step reasoning and exact table lookups.
            </p>

            {documents.length === 0 && (
              <div className="mb-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 max-w-md text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  No documents indexed yet. Attach a PDF/MD below or upload in Knowledge Base to begin querying.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 w-full max-w-xl">
              {SUGGESTED_QUERIES.map((item, idx) => (
                <button
                  key={idx}
                  disabled={isIngesting}
                  onClick={() => sendMessage(item.query)}
                  className="flex flex-col text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100 mb-1">
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed">
                    {item.query}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}
      </div>

      {/* Chat Input */}
      <ChatInput />
    </div>
  );
};
