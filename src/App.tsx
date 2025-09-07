import React from 'react';
import { Toaster } from 'sonner';
import { LeftPanel } from './components/LeftPanel';
import CenterPanelSimple from './components/CenterPanelSimple';
import { RightPanel } from './components/RightPanel';
import { Header } from './components/Header';
import GeneratedImagesGallery from './components/GeneratedImagesGallery';
import { ToastContainer } from './components/ui/Toast';
import { useToastStore } from './hooks/useToast';
import { useAppStore } from './store';
import './App.css';

function App() {
  const isLoading = useAppStore(state => state.ui?.loading || false);
  const error = useAppStore(state => state.ui?.error);
  const toasts = useToastStore(state => state.toasts);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Tools */}
          <LeftPanel />
          
          {/* Center Panel - Canvas */}
          <CenterPanelSimple />
          
          {/* Right Panel - Controls */}
          <RightPanel />
        </div>
        
        {/* Generated Images Gallery */}
        <GeneratedImagesGallery />
      </div>
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700">Procesando...</span>
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50">
          <span className="block sm:inline">{error}</span>
          <button 
            className="ml-2 text-red-500 hover:text-red-700"
            onClick={() => useAppStore.getState().setError(undefined)}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Custom Toast Notifications */}
      <ToastContainer toasts={toasts} />
      
      {/* Toast Notifications */}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default App;