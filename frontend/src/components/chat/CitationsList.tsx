import React, { useState } from 'react';
import { Table2, FileText, ChevronDown, ChevronRight, Eye, Bookmark } from 'lucide-react';
import { Citation } from '../../types';
import { useApp } from '../../context/AppContext';

interface CitationsListProps {
  citations?: Citation[];
}

export const CitationsList: React.FC<CitationsListProps> = ({ citations }) => {
  const { openCitationSidebar } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium text-[11px] transition-colors"
        >
          <span>Citations & Evidence ({citations.length})</span>
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Dedicated Cite button */}
        <button
          type="button"
          onClick={() => openCitationSidebar(citations, 0)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all font-semibold text-[11px] shadow-sm"
          title="Open citation viewer sidebar"
        >
          <Bookmark className="w-3 h-3 fill-current" />
          <span>Cite ({citations.length})</span>
        </button>
      </div>

      {/* Quick Chips preview when collapsed */}
      {!isExpanded && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {citations.slice(0, 4).map((c, idx) => {
            const isTable = c.kind === 'table';
            let pageLabel = '';
            if (isTable && c.page !== undefined && c.page !== null) {
              pageLabel = `p. ${c.page}`;
            } else if (c.page_start !== undefined && c.page_start !== null) {
              pageLabel =
                c.page_end && c.page_end !== c.page_start
                  ? `pp. ${c.page_start}–${c.page_end}`
                  : `p. ${c.page_start}`;
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => openCitationSidebar(citations, idx)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-700 dark:text-slate-300 font-mono transition-colors text-left group"
                title="Click to view citation and page bounding box in sidebar"
              >
                {isTable ? (
                  <Table2 className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                ) : (
                  <FileText className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                )}
                <span className="truncate max-w-[140px] font-medium">{c.source}</span>
                {pageLabel && <span className="text-slate-400">({pageLabel})</span>}
                <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-slate-500" />
              </button>
            );
          })}
          {citations.length > 4 && (
            <button
              type="button"
              onClick={() => openCitationSidebar(citations, 4)}
              className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 self-center font-medium underline"
            >
              +{citations.length - 4} more
            </button>
          )}
        </div>
      )}

      {/* Expanded detailed citations */}
      {isExpanded && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {citations.map((c, idx) => {
            const isTable = c.kind === 'table';

            let pageText: string | null = null;
            if (isTable && c.page !== undefined && c.page !== null) {
              pageText = `Page ${c.page}`;
            } else if (c.page_start !== undefined && c.page_start !== null) {
              pageText =
                c.page_end && c.page_end !== c.page_start
                  ? `Pages ${c.page_start}–${c.page_end}`
                  : `Page ${c.page_start}`;
            }

            const hasBbox =
              isTable &&
              c.bbox_x !== undefined &&
              c.bbox_x !== null &&
              c.bbox_y !== undefined &&
              c.bbox_y !== null;

            return (
              <div
                key={idx}
                onClick={() => openCitationSidebar(citations, idx)}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-xs flex flex-col gap-1.5 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-all group shadow-sm"
                title="Click to inspect this citation in the sidebar"
              >
                <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  {isTable ? (
                    <Table2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  )}
                  <span className="truncate text-[11px] font-semibold">{c.source}</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono border border-slate-200 dark:border-slate-700">
                    {c.kind}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 font-mono">
                  {pageText && (
                    <div className="text-slate-700 dark:text-slate-300 font-sans">
                      {pageText}
                    </div>
                  )}

                  {c.caption && (
                    <p className="font-sans text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed line-clamp-2">
                      <span className="font-medium text-slate-500">Caption:</span> {c.caption}
                    </p>
                  )}

                  {hasBbox && (
                    <div className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                      <span className="font-sans text-slate-500 font-medium">BBox:</span> [x:{' '}
                      {c.bbox_x}, y: {c.bbox_y}, w: {c.bbox_w}, h: {c.bbox_h}]
                    </div>
                  )}
                </div>

                <div className="pt-1 mt-auto flex items-center justify-between text-[10px] text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200 font-medium transition-colors">
                  <span>Click to view in sidebar</span>
                  <Eye className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
