import React, { useCallback, useMemo } from 'react';
import { 
  MousePointer2, 
  Paintbrush, 
  Eraser, 
  Lasso, 
  Square, 
  Circle, 
  Type, 
  Move, 
  RotateCcw, 
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';
import { useAppStore } from '../store';
import { 
  selectActiveTool, 
  selectBrushSettings, 
  selectEraserSettings,
  selectCanvasZoom,
  selectCanUndo,
  selectCanRedo,
  selectToolbarActions,
  selectCanvasActions
} from '../store/selectors';
import { DrawingTool } from '../types';

interface ToolButtonProps {
  tool: DrawingTool;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = React.memo(({ tool, icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
        ${
          isActive
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'text-gray-700 hover:bg-gray-100'
        }
      `}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
});

const LeftPanel: React.FC = React.memo(() => {
  // Usar selectores optimizados para evitar re-renders innecesarios
  const activeTool = useAppStore(selectActiveTool);
  const brushSettings = useAppStore(selectBrushSettings);
  const eraserSettings = useAppStore(selectEraserSettings);
  const zoom = useAppStore(selectCanvasZoom);
  const canUndo = useAppStore(selectCanUndo);
  const canRedo = useAppStore(selectCanRedo);
  // Memoizar las acciones para evitar bucles infinitos
  const setActiveTool = useAppStore(state => state.setActiveTool);
  const setBrushSettings = useAppStore(state => state.setBrushSettings);
  const setEraserSettings = useAppStore(state => state.setEraserSettings);
  const setCanvasSettings = useAppStore(state => state.setCanvasSettings);
  const undo = useAppStore(state => state.undo);
  const redo = useAppStore(state => state.redo);
  
  const currentTool = activeTool;
  const brushSize = brushSettings.size;
  const brushColor = brushSettings.color;
  const canvasZoom = zoom;

  // Memoizar la lista de herramientas para evitar recrearla en cada render
  const tools = useMemo(() => [
    { tool: 'select' as DrawingTool, icon: <MousePointer2 className="h-4 w-4" />, label: 'Seleccionar' },
    { tool: 'brush' as DrawingTool, icon: <Paintbrush className="h-4 w-4" />, label: 'Pincel' },
    { tool: 'eraser' as DrawingTool, icon: <Eraser className="h-4 w-4" />, label: 'Goma' },
    { tool: 'lasso' as DrawingTool, icon: <Lasso className="h-4 w-4" />, label: 'Lazo' },
    { tool: 'rectangle' as DrawingTool, icon: <Square className="h-4 w-4" />, label: 'Rectángulo' },
    { tool: 'circle' as DrawingTool, icon: <Circle className="h-4 w-4" />, label: 'Círculo' },
    { tool: 'text' as DrawingTool, icon: <Type className="h-4 w-4" />, label: 'Texto' },
    { tool: 'move' as DrawingTool, icon: <Move className="h-4 w-4" />, label: 'Mover' },
  ], []);

  // Memoizar los handlers de zoom
  const handleZoomIn = useCallback(() => {
    setCanvasSettings({ zoom: Math.min(canvasZoom * 1.2, 5) });
  }, [canvasZoom, setCanvasSettings]);

  const handleZoomOut = useCallback(() => {
    setCanvasSettings({ zoom: Math.max(canvasZoom / 1.2, 0.1) });
  }, [canvasZoom, setCanvasSettings]);

  const handleZoomFit = useCallback(() => {
    setCanvasSettings({ zoom: 1 });
  }, [setCanvasSettings]);

  // Memoizar los handlers de brush settings
  const handleBrushSizeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushSettings({ size: Number(e.target.value) });
  }, [setBrushSettings]);

  const handleBrushColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBrushSettings({ color: e.target.value });
  }, [setBrushSettings]);

  // Memoizar el handler de selección de herramienta
  const handleToolSelect = useCallback((tool: DrawingTool) => {
    setActiveTool(tool);
  }, [setActiveTool]);

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Tools Section */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Herramientas</h3>
        <div className="space-y-1">
          {tools.map(({ tool, icon, label }) => (
            <ToolButton
              key={tool}
              tool={tool}
              icon={icon}
              label={label}
              isActive={currentTool === tool}
              onClick={() => handleToolSelect(tool)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200"></div>

      {/* Brush Settings */}
      {(currentTool === 'brush' || currentTool === 'eraser') && (
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {currentTool === 'brush' ? 'Configuración del Pincel' : 'Configuración de la Goma'}
          </h3>
          
          <div className="space-y-4">
            {/* Brush Size */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Tamaño: {brushSize}px
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={brushSize}
                onChange={handleBrushSizeChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Brush Color (only for brush) */}
            {currentTool === 'brush' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={brushColor}
                    onChange={handleBrushColorChange}
                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={brushColor}
                    onChange={handleBrushColorChange}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-gray-200"></div>

      {/* Zoom Controls */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Zoom</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">{Math.round(canvasZoom * 100)}%</span>
            <div className="flex space-x-1">
              <button
                onClick={handleZoomOut}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                title="Alejar"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={handleZoomFit}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                title="Ajustar"
              >
                <Maximize className="h-4 w-4" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                title="Acercar"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200"></div>

      {/* History Controls */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Historial</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => undo()}
            className="flex-1 flex items-center justify-center space-x-1 px-2 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Deshacer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Deshacer</span>
          </button>
          <button
            onClick={() => redo()}
            className="flex-1 flex items-center justify-center space-x-1 px-2 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Rehacer"
          >
            <RotateCw className="h-3 w-3" />
            <span>Rehacer</span>
          </button>
        </div>
      </div>
    </div>
  );
});

LeftPanel.displayName = 'LeftPanel';

export { LeftPanel };