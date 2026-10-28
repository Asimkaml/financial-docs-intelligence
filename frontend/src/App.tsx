import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { ChatContainer } from './components/chat/ChatContainer';
import { DocumentManager } from './components/documents/DocumentManager';
import { SettingsModal } from './components/settings/SettingsModal';
import { ToastContainer } from './components/common/ToastContainer';
import { CitationSidebar } from './components/citations/CitationSidebar';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/30 dark:bg-slate-950 transition-colors">
      {activeTab === 'chat' && <ChatContainer />}
      {activeTab === 'documents' && <DocumentManager />}
    </div>
  );
};

const AppLayout: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <MainContent />
        <CitationSidebar />
      </div>
      <SettingsModal />
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
};

export default App;
