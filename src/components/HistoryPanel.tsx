import React from 'react';
import { Undo, Redo, History, Eye, EyeOff, GitCompare } from 'lucide-react';
import { useAppStore, useHistoryState } from '../store';

interface HistoryPanelProps {
  className?: string;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ className = '' }) => {
  const { 
    undo, 
    redo, 
    clearHistory, 
    applyHistoryState,
    setComparisonMode,
    setComparisonStates,
    toggleComparisonView
  } = useAppStore();
  
  const { 
    history, 
    historyIndex, 
    canUndo, 
    canRedo 
  } = useHistoryState();
  
  const canvas = useAppStore(state => state.canvas);
  const comparisonMode = canvas.comparisonMode;
  const showingStateA = canvas.showingStateA;

  const handleHistoryItemClick = (index: number) => {
    applyHistoryState(index);
  };

  const handleComparisonToggle = () => {
    if (!comparisonMode && history.length >= 2) {
      // Activar modo comparación con los dos últimos estados
      const stateA = history[Math.max(0, historyIndex - 1)];
      const stateB = history[historyIndex];
      setComparisonStates(stateA, stateB);
      setComparisonMode(true);
    } else {
      setComparisonMode(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className={`bg-white border-l border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4" />
            Historial
          </h3>
          <button
            onClick={clearHistory}
            className="text-xs text-gray-500 hover:text-red-600 transition-colors"
            disabled={history.length === 0}
          >
            Limpiar
          </button>
        </div>
        
        {/* Controles de Undo/Redo */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-md transition-colors"
          >
            <Undo className="w-4 h-4" />
            Deshacer
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-md transition-colors"
          >
            <Redo className="w-4 h-4" />
            Rehacer
          </button>
        </div>
        
        {/* Control de Comparación A/B */}
        <button
          onClick={handleComparisonToggle}
          disabled={history.length < 2}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
            comparisonMode 
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
              : 'bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400'
          }`}
        >
          <GitCompare className="w-4 h-4" />
          {comparisonMode ? 'Salir de Comparación' : 'Comparar A/B'}
        </button>
        
        {/* Toggle de vista en modo comparación */}
        {comparisonMode && (
          <button
            onClick={toggleComparisonView}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
          >
            {showingStateA ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Mostrando: {showingStateA ? 'Estado A' : 'Estado B'}
          </button>
        )}
      </div>
      
      {/* Lista de historial */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No hay estados en el historial
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {history.map((state, index) => (
              <div
                key={state.id}
                onClick={() => handleHistoryItemClick(index)}
                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                  index === historyIndex
                    ? 'bg-blue-100 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 bg-gray-100 rounded border overflow-hidden flex-shrink-0">
                  {state.thumbnail && (
                    <img
                      src={state.thumbnail}
                      alt={`Estado ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    Estado {index + 1}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTimestamp(state.timestamp)}
                  </div>
                </div>
                
                {/* Indicador de estado actual */}
                {index === historyIndex && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;