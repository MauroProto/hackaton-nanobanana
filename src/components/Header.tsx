import React, { useEffect } from 'react';
import { 
  Save, 
  FolderOpen, 
  Download, 
  Settings, 
  User, 
  Palette,
  Undo2,
  Redo2,
  History
} from 'lucide-react';
import { useAppStore } from '../store';
import { useToast } from '../hooks/useToast';

export const Header: React.FC = () => {
  const { currentProject, saveProject, exportCanvas } = useAppStore();
  const undo = useAppStore(state => state.undo);
  const redo = useAppStore(state => state.redo);
  const history = useAppStore(state => state.canvas.history);
  const historyIndex = useAppStore(state => state.canvas.historyIndex);
  const captureCanvasState = useAppStore(state => state.captureCanvasState);
  const toast = useToast();
  
  // Estado para undo/redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleSave = () => {
    saveProject?.();
    toast.success('Proyecto guardado');
  };

  const handleExport = () => {
    exportCanvas?.('png');
    toast.success('Imagen exportada');
  };
  
  const handleUndo = () => {
    if (canUndo) {
      undo();
      toast.info('Acción deshecha');
    }
  };
  
  const handleRedo = () => {
    if (canRedo) {
      redo();
      toast.info('Acción rehecha');
    }
  };
  
  // Atajos de teclado para undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Z para undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl/Cmd + Shift + Z o Ctrl/Cmd + Y para redo
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // Ctrl/Cmd + S para guardar
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo]);

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Logo and Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Palette className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Lienzo</h1>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">+ Gemini 2.5</span>
        </div>
      </div>

      {/* Project Name */}
      <div className="flex-1 flex justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-800">
            {currentProject?.name || 'Proyecto sin título'}
          </h2>
          {currentProject?.lastModified && (
            <p className="text-xs text-gray-500">
              Última modificación: {new Date(currentProject.lastModified).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2">
        {/* Undo/Redo Buttons */}
        <div className="flex items-center space-x-1 bg-gray-100 rounded-md p-1">
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-colors ${
              canUndo 
                ? 'text-gray-700 hover:bg-white hover:shadow-sm' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-colors ${
              canRedo 
                ? 'text-gray-700 hover:bg-white hover:shadow-sm' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title="Rehacer (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          
          {history.length > 0 && (
            <div className="px-2 text-xs text-gray-500 border-l border-gray-300 ml-1">
              <span className="font-medium">{historyIndex + 1}</span>
              <span className="mx-0.5">/</span>
              <span>{history.length}</span>
            </div>
          )}
        </div>
        
        <div className="w-px h-6 bg-gray-300"></div>
        
        <button
          onClick={handleSave}
          className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          title="Guardar proyecto (Ctrl+S)"
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Guardar</span>
        </button>

        <button
          className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          title="Abrir proyecto"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">Abrir</span>
        </button>

        <button
          onClick={handleExport}
          className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          title="Exportar imagen"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exportar</span>
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2"></div>

        <button
          className="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title="Configuración"
        >
          <Settings className="h-5 w-5" />
        </button>

        <button
          className="p-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          title="Perfil de usuario"
        >
          <User className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};