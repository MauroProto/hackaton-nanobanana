// Selectores optimizados para el store de Zustand
import { AppStore } from './index';
import { DrawingTool, BrushSettings, CanvasSettings } from '../types';

// Selectores para UI
export const selectActiveTool = (state: AppStore): DrawingTool => state.ui.toolbar.activeTool;
export const selectBrushSettings = (state: AppStore): BrushSettings => state.ui.toolbar.brushSettings;
export const selectEraserSettings = (state: AppStore) => state.ui.toolbar.eraserSettings;
export const selectSelectionSettings = (state: AppStore) => state.ui.toolbar.selectionSettings;
export const selectIsLoading = (state: AppStore): boolean => state.ui.loading;
export const selectError = (state: AppStore): string | undefined => state.ui.error;

// Selectores para Canvas
export const selectCanvasSettings = (state: AppStore): CanvasSettings => state.canvas.settings;
export const selectCanvasZoom = (state: AppStore): number => state.canvas.settings.zoom;
export const selectCanvasSize = (state: AppStore) => ({
  width: state.canvas.settings.width,
  height: state.canvas.settings.height
});
export const selectCanvasBackground = (state: AppStore): string => state.canvas.settings.backgroundColor;
export const selectFabricCanvas = (state: AppStore) => state.canvas.fabricCanvas;
export const selectCanvasManager = (state: AppStore) => state.canvasManager;
export const selectIsCanvasModified = (state: AppStore): boolean => state.canvas.isModified;

// Selectores para Layers
export const selectLayers = (state: AppStore) => state.canvas.layers;
export const selectActiveLayerId = (state: AppStore) => state.canvas.activeLayerId;
export const selectActiveLayer = (state: AppStore) => {
  const layers = state.canvas.layers;
  const activeId = state.canvas.activeLayerId;
  return layers.find(layer => layer.id === activeId);
};
export const selectLayerCount = (state: AppStore): number => state.canvas.layers.length;

// Selectores para History
export const selectHistory = (state: AppStore) => state.canvas.history || [];
export const selectHistoryIndex = (state: AppStore): number => state.canvas.historyIndex || -1;
export const selectCanUndo = (state: AppStore): boolean => (state.canvas.historyIndex || -1) > 0;
export const selectCanRedo = (state: AppStore): boolean => {
  const history = state.canvas.history || [];
  const historyIndex = state.canvas.historyIndex || -1;
  return historyIndex < history.length - 1;
};

// Selectores para Gemini
export const selectGeminiSettings = (state: AppStore) => state.gemini?.settings;
export const selectIsGenerating = (state: AppStore): boolean => state.gemini?.isGenerating || false;
export const selectGeminiApiKey = (state: AppStore) => state.gemini?.apiKey;
export const selectLastGeminiRequest = (state: AppStore) => state.gemini?.lastRequest;
export const selectLastGeminiResponse = (state: AppStore) => state.gemini?.lastResponse;

// Selectores para Panels
export const selectLeftPanelVisible = (state: AppStore): boolean => state.ui.panels.leftPanel.visible;
export const selectRightPanelVisible = (state: AppStore): boolean => state.ui.panels.rightPanel.visible;
export const selectBottomPanelVisible = (state: AppStore): boolean => state.ui.panels.bottomPanel.visible;
export const selectPanelWidths = (state: AppStore) => ({
  left: state.ui.panels.leftPanel.width,
  right: state.ui.panels.rightPanel.width,
  bottom: state.ui.panels.bottomPanel.height
});

// Selectores para Project
export const selectCurrentProject = (state: AppStore) => state.currentProject;
export const selectUser = (state: AppStore) => state.user;

// Selectores compuestos para optimización
export const selectToolbarState = (state: AppStore) => ({
  activeTool: state.ui.toolbar.activeTool,
  brushSettings: state.ui.toolbar.brushSettings,
  eraserSettings: state.ui.toolbar.eraserSettings,
  selectionSettings: state.ui.toolbar.selectionSettings
});

export const selectCanvasState = (state: AppStore) => ({
  settings: state.canvas.settings,
  layers: state.canvas.layers,
  activeLayerId: state.canvas.activeLayerId,
  isModified: state.canvas.isModified
});

export const selectGeminiState = (state: AppStore) => ({
  isGenerating: state.gemini?.isGenerating || false,
  settings: state.gemini?.settings,
  apiKey: state.gemini?.apiKey,
  lastRequest: state.gemini?.lastRequest,
  lastResponse: state.gemini?.lastResponse
});

// Selectores para acciones específicas (evitar recrear funciones)
export const selectCanvasActions = (state: AppStore) => ({
  setCanvasSettings: state.setCanvasSettings,
  addLayer: state.addLayer,
  removeLayer: state.removeLayer,
  updateLayer: state.updateLayer,
  setActiveLayer: state.setActiveLayer,
  undo: state.undo,
  redo: state.redo
});

export const selectToolbarActions = (state: AppStore) => ({
  setActiveTool: state.setActiveTool,
  setBrushSettings: state.setBrushSettings,
  setEraserSettings: state.setEraserSettings,
  setSelectionSettings: state.setSelectionSettings
});

export const selectGeminiActions = (state: AppStore) => ({
  generateImage: state.generateImage,
  editImage: state.editImage,
  setGeminiSettings: state.setGeminiSettings,
  setGeminiGenerating: state.setGeminiGenerating
});