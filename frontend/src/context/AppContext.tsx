import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  ChatMessage,
  Citation,
  DeleteResponse,
  DocumentOut,
  JobStatus,
  LLMConfigRequest,
  LLMConfigStatus,
  ToastNotification,
} from '../types';
import { api } from '../services/api';

interface AppContextType {
  // Navigation
  activeTab: 'chat' | 'documents';
  setActiveTab: (tab: 'chat' | 'documents') => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Chat State
  messages: ChatMessage[];
  isSending: boolean;
  threadId: string | null;
  sendMessage: (content: string) => Promise<void>;
  resetChat: () => void;

  // Citations Sidebar State
  citationSidebar: {
    isOpen: boolean;
    citations: Citation[];
    activeIndex: number;
  };
  openCitationSidebar: (citations: Citation[], initialIndex?: number) => void;
  closeCitationSidebar: () => void;
  setCitationSidebarIndex: (index: number) => void;

  // Documents & Ingestion State
  documents: DocumentOut[];
  isLoadingDocs: boolean;
  activeJob: JobStatus | null;
  isIngesting: boolean;
  refreshDocuments: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  deleteDocument: (name: string) => Promise<DeleteResponse>;
  clearAllDocuments: () => Promise<void>;

  // LLM Configuration & Settings
  llmConfig: LLMConfigStatus | null;
  loadLLMConfig: () => Promise<void>;
  updateLLMConfig: (req: LLMConfigRequest) => Promise<void>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;

  // Notifications
  toasts: ToastNotification[];
  addToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<'chat' | 'documents'>('chat');

  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const savedTheme = localStorage.getItem('rag_theme');
      return savedTheme === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Citation Sidebar
  const [citationSidebar, setCitationSidebar] = useState<{
    isOpen: boolean;
    citations: Citation[];
    activeIndex: number;
  }>({
    isOpen: false,
    citations: [],
    activeIndex: 0,
  });

  const openCitationSidebar = (citations: Citation[], initialIndex = 0) => {
    if (!citations || citations.length === 0) return;
    setCitationSidebar({
      isOpen: true,
      citations,
      activeIndex: Math.max(0, Math.min(initialIndex, citations.length - 1)),
    });
  };

  const closeCitationSidebar = () => {
    setCitationSidebar((prev) => ({ ...prev, isOpen: false }));
  };

  const setCitationSidebarIndex = (index: number) => {
    setCitationSidebar((prev) => ({
      ...prev,
      activeIndex: Math.max(0, Math.min(index, prev.citations.length - 1)),
    }));
  };

  // Documents & Ingestion
  const [documents, setDocuments] = useState<DocumentOut[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [activeJob, setActiveJob] = useState<JobStatus | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // LLM Config
  const [llmConfig, setLLmConfig] = useState<LLMConfigStatus | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Apply dark/light class to root element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('rag_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastNotification = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after 4.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Refresh documents list
  const refreshDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Load LLM config
  const loadLLMConfig = async () => {
    try {
      const config = await api.getLLMConfig();
      setLLmConfig(config);
    } catch (err: any) {
      console.error('Failed to load LLM config:', err);
    }
  };

  // Initial load
  useEffect(() => {
    refreshDocuments();
    loadLLMConfig();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const isIngesting = Boolean(
    activeJob && (activeJob.status === 'pending' || activeJob.status === 'running')
  );

  // Upload documents and poll job status
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    try {
      const job = await api.uploadDocuments(files);
      const initialJobStatus: JobStatus = {
        job_id: job.job_id,
        status: 'pending',
        added: 0,
        skipped: 0,
        documents: [],
      };
      setActiveJob(initialJobStatus);
      addToast(
        `Started indexing ${files.length} file(s). Chat is disabled until complete.`,
        'info'
      );

      // Start polling every 2s
      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(async () => {
        try {
          const status = await api.getJobStatus(job.job_id);
          setActiveJob(status);

          if (status.status === 'done') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            // Refresh documents list
            await refreshDocuments();
            addToast(
              `Indexing complete: Added ${status.added} file(s), skipped ${status.skipped}.`,
              'success'
            );
            setTimeout(() => {
              setActiveJob(null);
            }, 3000);
          } else if (status.status === 'error') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            addToast(`Indexing failed: ${status.error || 'Unknown error occurred'}`, 'error');
            setTimeout(() => {
              setActiveJob(null);
            }, 5000);
          }
        } catch (pollErr: any) {
          console.error('Error polling job status:', pollErr);
        }
      }, 2000);
    } catch (err: any) {
      addToast(err.message || 'Failed to upload documents', 'error');
      throw err;
    }
  };

  // Delete a single document
  const deleteDocument = async (name: string): Promise<DeleteResponse> => {
    try {
      const res = await api.deleteDocument(name);
      setDocuments((prev) => prev.filter((d) => d.name !== name));
      addToast(
        `Deleted "${name}" (${res.child_chunks} vectors, ${res.tables} tables removed).`,
        'success'
      );
      return res;
    } catch (err: any) {
      addToast(err.message || `Failed to delete "${name}"`, 'error');
      throw err;
    }
  };

  // Clear all documents
  const clearAllDocuments = async () => {
    try {
      await api.clearDocuments();
      setDocuments([]);
      closeCitationSidebar();
      addToast('Knowledge base cleared successfully.', 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to clear documents', 'error');
      throw err;
    }
  };

  // Switch LLM configuration
  const updateLLMConfig = async (req: LLMConfigRequest) => {
    try {
      const updated = await api.setLLMConfig(req);
      setLLmConfig(updated);

      // Reset conversation because changing models rebuilds backend graph
      setThreadId(null);
      setMessages([]);
      closeCitationSidebar();

      addToast(
        `Switched to ${updated.provider.toUpperCase()} (${updated.model}) — starting a new conversation.`,
        'info'
      );
    } catch (err: any) {
      addToast(err.message || 'Failed to update LLM configuration', 'error');
      throw err;
    }
  };

  // Reset chat session
  const resetChat = () => {
    setThreadId(null);
    setMessages([]);
    closeCitationSidebar();
    addToast('Started a new conversation session.', 'info');
  };

  // Send message
  const sendMessage = async (content: string) => {
    if (!content.trim() || isSending || isIngesting) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setIsSending(true);

    try {
      const response = await api.chat(content, threadId || undefined);

      // Store returned thread_id for multi-turn continuity
      setThreadId(response.thread_id);

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== assistantMessageId) return msg;
          return {
            ...msg,
            content: response.answer,
            sources: response.sources || [],
            citations: response.citations || [],
            needsClarification: response.needs_clarification,
            isLoading: false,
          };
        })
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== assistantMessageId) return msg;
          return {
            ...msg,
            content: '',
            error: err.message || 'Failed to generate answer',
            isLoading: false,
          };
        })
      );
      addToast(err.message || 'Error communicating with assistant', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        theme,
        toggleTheme,
        messages,
        isSending,
        threadId,
        sendMessage,
        resetChat,
        citationSidebar,
        openCitationSidebar,
        closeCitationSidebar,
        setCitationSidebarIndex,
        documents,
        isLoadingDocs,
        activeJob,
        isIngesting,
        refreshDocuments,
        uploadFiles,
        deleteDocument,
        clearAllDocuments,
        llmConfig,
        loadLLMConfig,
        updateLLMConfig,
        isSettingsOpen,
        setIsSettingsOpen,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
