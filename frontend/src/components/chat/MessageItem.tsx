import React from 'react';
import { Bot, User, Loader2, Files, HelpCircle, AlertCircle } from 'lucide-react';
import { ChatMessage } from '../../types';
import { MarkdownContent } from './MarkdownContent';
import { CitationsList } from './CitationsList';
import { useApp } from '../../context/AppContext';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const { openCitationSidebar } = useApp();
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 py-3.5 px-3.5 rounded-xl transition-colors ${
        isUser
          ? 'bg-slate-50 dark:bg-slate-900/30'
          : 'bg-slate-100/60 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs shadow-sm">
            <User className="w-3.5 h-3.5" />
          </div>
        ) : (
          <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 text-xs shadow-sm">
            <Bot className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">
            {isUser ? 'You' : 'Financial Agent'}
          </span>
          {message.needsClarification && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
              <HelpCircle className="w-3 h-3" />
              <span>Needs Clarification</span>
            </span>
          )}
          <span className="text-[10px] text-slate-400 ml-auto">{message.timestamp}</span>
        </div>

        {/* Loading / Thinking State */}
        {message.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-slate-700 dark:text-slate-300" />
            <span className="font-medium">Reasoning & querying financial documents...</span>
          </div>
        ) : message.error ? (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-semibold">Request Failed</p>
              <p className="mt-0.5">{message.error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Answer Content */}
            <MarkdownContent content={message.content} />

            {/* Sources List */}
            {message.sources && message.sources.length > 0 && (
              <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 font-medium text-[11px] mb-1 text-slate-700 dark:text-slate-300">
                  <Files className="w-3 h-3" />
                  <span>Sources Used:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {message.sources.map((src, idx) => {
                    const matchIdx = message.citations?.findIndex((c) => c.source === src) ?? -1;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (message.citations && message.citations.length > 0) {
                            openCitationSidebar(message.citations, matchIdx >= 0 ? matchIdx : 0);
                          }
                        }}
                        className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 transition-colors"
                        title="Click to view citations from this file in sidebar"
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Citations Panel with Cite Button & Evidence Drawer */}
            {message.citations && message.citations.length > 0 && (
              <CitationsList citations={message.citations} />
            )}
          </>
        )}
      </div>
    </div>
  );
};
