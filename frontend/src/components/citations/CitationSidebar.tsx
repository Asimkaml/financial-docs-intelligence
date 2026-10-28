import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Table2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import { CitationPageImage } from '../../types';

export const CitationSidebar: React.FC = () => {
  const { citationSidebar, closeCitationSidebar, setCitationSidebarIndex } = useApp();
  const { isOpen, citations, activeIndex } = citationSidebar;

  const currentCitation = citations[activeIndex] || citations[0];

  // Image and layout states
  const [pageData, setPageData] = useState<CitationPageImage | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const bboxRef = useRef<HTMLDivElement>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // Fetch page image whenever current citation changes
  useEffect(() => {
    if (!isOpen || !currentCitation) {
      return;
    }

    // Determine target page
    let targetPage: number | string | null = null;
    if (currentCitation.kind === 'table' && currentCitation.page !== null && currentCitation.page !== undefined) {
      targetPage = currentCitation.page;
    } else if (currentCitation.page_start !== null && currentCitation.page_start !== undefined) {
      targetPage = currentCitation.page_start;
    }

    if (!targetPage || !currentCitation.source) {
      setPageData(null);
      setImageError('No document page reference is associated with this citation.');
      return;
    }

    setIsLoadingImage(true);
    setImageError(null);
    setZoom(1);

    // Clean up previous blob URL
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }

    let isMounted = true;

    api
      .getCitationPageImage(currentCitation.source, targetPage, 150)
      .then((data) => {
        if (!isMounted) {
          URL.revokeObjectURL(data.blobUrl);
          return;
        }
        currentBlobUrlRef.current = data.blobUrl;
        setPageData(data);
        setIsLoadingImage(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setIsLoadingImage(false);
        setImageError(err.message || 'Page preview unavailable');
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentCitation]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
    };
  }, []);

  // Scroll bounding box into view once image renders
  useEffect(() => {
    if (pageData && bboxRef.current && containerRef.current) {
      const timer = setTimeout(() => {
        bboxRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [pageData, activeIndex]);

  if (!isOpen || !currentCitation) return null;

  const isTable = currentCitation.kind === 'table';
  const hasBbox =
    isTable &&
    currentCitation.bbox_x !== null &&
    currentCitation.bbox_x !== undefined &&
    currentCitation.bbox_y !== null &&
    currentCitation.bbox_y !== undefined &&
    currentCitation.bbox_w !== null &&
    currentCitation.bbox_w !== undefined &&
    currentCitation.bbox_h !== null &&
    currentCitation.bbox_h !== undefined &&
    pageData !== null &&
    pageData.pageWidth > 0 &&
    pageData.pageHeight > 0;

  // Percentage calculations relative to page dimensions
  let boxLeft = 0;
  let boxTop = 0;
  let boxWidth = 0;
  let boxHeight = 0;

  if (hasBbox && pageData && currentCitation.bbox_x !== undefined && currentCitation.bbox_y !== undefined && currentCitation.bbox_w !== undefined && currentCitation.bbox_h !== undefined) {
    boxLeft = (currentCitation.bbox_x! / pageData.pageWidth) * 100;
    boxTop = (currentCitation.bbox_y! / pageData.pageHeight) * 100;
    boxWidth = (currentCitation.bbox_w! / pageData.pageWidth) * 100;
    boxHeight = (currentCitation.bbox_h! / pageData.pageHeight) * 100;
  }

  // Page display label
  let pageDisplay = '';
  if (isTable && currentCitation.page !== null && currentCitation.page !== undefined) {
    pageDisplay = `Page ${currentCitation.page}`;
  } else if (currentCitation.page_start !== null && currentCitation.page_start !== undefined) {
    pageDisplay =
      currentCitation.page_end && currentCitation.page_end !== currentCitation.page_start
        ? `Pages ${currentCitation.page_start}–${currentCitation.page_end}`
        : `Page ${currentCitation.page_start}`;
  }

  return (
    <aside className="w-full sm:w-[460px] md:w-[500px] lg:w-[540px] flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shadow-2xl z-30 transition-all animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            {isTable ? <Table2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Citation Evidence
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {citations.length > 1
                ? `Citation ${activeIndex + 1} of ${citations.length}`
                : '1 citation found'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {citations.length > 1 && (
            <div className="flex items-center gap-0.5 mr-2 bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setCitationSidebarIndex(activeIndex - 1)}
                disabled={activeIndex === 0}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous citation"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCitationSidebarIndex(activeIndex + 1)}
                disabled={activeIndex === citations.length - 1}
                className="p-1 rounded text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next citation"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={closeCitationSidebar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multiple citations tab strip */}
      {citations.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-950/40 overflow-x-auto text-xs">
          {citations.map((c, idx) => {
            const isTabActive = idx === activeIndex;
            const isTabTable = c.kind === 'table';
            return (
              <button
                key={idx}
                onClick={() => setCitationSidebarIndex(idx)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  isTabActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                {isTabTable ? <Table2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                <span>#{idx + 1}</span>
                <span className="truncate max-w-[90px]">{c.source}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Citation Metadata Header Card */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2 text-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
              <span className="truncate max-w-xs">{currentCitation.source}</span>
            </div>
            {pageDisplay && (
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                {pageDisplay}
              </p>
            )}
          </div>

          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium uppercase border ${
              isTable
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            }`}
          >
            {currentCitation.kind}
          </span>
        </div>

        {currentCitation.caption && (
          <div className="p-2 rounded-lg bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Caption: </span>
            {currentCitation.caption}
          </div>
        )}

        {isTable && currentCitation.bbox_x !== undefined && currentCitation.bbox_x !== null && (
          <div className="text-[10px] font-mono text-slate-400 bg-slate-100/80 dark:bg-slate-950 p-1.5 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span>Bounding Box (LlamaParse Space):</span>
            <span className="text-slate-600 dark:text-slate-300">
              [{currentCitation.bbox_x}, {currentCitation.bbox_y}, {currentCitation.bbox_w}, {currentCitation.bbox_h}]
            </span>
          </div>
        )}

        {!isTable && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-950/60 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">
            Narrative text citation (full page context shown below, no bounding box)
          </div>
        )}
      </div>

      {/* Document Page Preview Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500">
        <span className="text-[11px] font-medium">Page Preview</span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.6, parseFloat((z - 0.2).toFixed(1))))}
            disabled={!pageData}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[10px] w-9 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, parseFloat((z + 0.2).toFixed(1))))}
            disabled={!pageData}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1)}
            disabled={!pageData || zoom === 1}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-40 transition-colors ml-1"
            title="Reset zoom"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 bg-slate-100/60 dark:bg-slate-950/80 relative flex items-start justify-center select-none"
      >
        {isLoadingImage ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center gap-2">
            <Loader2 className="w-7 h-7 text-slate-700 dark:text-slate-300 animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Rendering document page from PDF...
            </p>
          </div>
        ) : imageError ? (
          <div className="flex flex-col items-center justify-center min-h-[260px] text-center max-w-xs p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 mb-2.5">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Page Preview Unavailable
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {imageError}
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
              All citation references and section text are recorded above.
            </p>
          </div>
        ) : pageData ? (
          <div
            style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 100}%` }}
            className="relative transition-all duration-150 shadow-lg rounded-sm border border-slate-300 dark:border-slate-700 overflow-hidden bg-white"
          >
            {/* The Document Page Image */}
            <img
              src={pageData.blobUrl}
              alt={`${currentCitation.source} - ${pageDisplay}`}
              className="w-full h-auto block"
            />

            {/* Bounding Box Highlight Overlay */}
            {hasBbox && (
              <div
                ref={bboxRef}
                style={{
                  left: `${boxLeft}%`,
                  top: `${boxTop}%`,
                  width: `${boxWidth}%`,
                  height: `${boxHeight}%`,
                }}
                className="absolute border-2 border-amber-500 bg-amber-400/25 rounded ring-2 ring-amber-500/20 shadow-md transition-all pointer-events-none"
              >
                <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-mono font-medium shadow-sm whitespace-nowrap">
                  Extracted Table
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </aside>
  );
};
