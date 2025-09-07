// Store principal de la aplicación usando Zustand
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AppState, CanvasLayer, HistoryState, DrawingTool, Project, User, GeminiImageRequest, GeminiImageResponse, GeminiSettings, BrushSettings, CanvasSettings } from '../types';
import * as fabric from 'fabric';
import { CanvasManager } from '../lib/canvas-v6';

// Estado inicial
const initialState: AppState = {
  currentProject: undefined,
  generatedImages: [],
  canvas: {
    fabricCanvas: null,
    settings: {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      zoom: 1,
      panX: 0,
      panY: 0,
      gridVisible: false,
      snapToGrid: false,
      gridSize: 20
    },
    layers: [],
    activeLayerId: undefined,
    history: [],
    historyIndex: -1,
    isModified: false,
    comparisonMode: false,
    comparisonStateA: null,
    comparisonStateB: null,
    showingStateA: true
  },
  ui: {
    panels: {
      leftPanel: {
        visible: true,
        width: 280,
        collapsed: false
      },
      rightPanel: {
        visible: true,
        width: 320,
        collapsed: false
      },
      bottomPanel: {
        visible: false,
        height: 200,
        collapsed: false
      }
    },
    toolbar: {
      activeTool: 'brush',
      brushSettings: {
        size: 10,
        color: '#000000',
        opacity: 1,
        hardness: 1,
        spacing: 1
      },
      eraserSettings: {
        size: 20,
        hardness: 1
      },
      selectionSettings: {
        strokeColor: '#007ACC',
        strokeWidth: 2,
        fillColor: 'rgba(0, 122, 204, 0.1)'
      }
    },
    loading: false,
    error: undefined
  },
  gemini: {
    isGenerating: false,
    lastRequest: undefined,
    lastResponse: undefined,
    apiKey: undefined,
    settings: {
      quality: 'standard' as 'standard' | 'high',
      style: 'natural',
      aspectRatio: '1:1',
      negativePrompt: '',
      seed: undefined,
      creativity: 0.7
    }
  },
  user: undefined
};

// Definir el store
export interface AppStore extends AppState {
  // Acciones para el canvas
  setCanvas: (canvas: any) => void;
  setCanvasManager: (manager: CanvasManager) => void;
  canvasManager?: CanvasManager;
  setCanvasSettings: (settings: Partial<AppState['canvas']['settings']>) => void;
  addLayer: (layer: CanvasLayer) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, updates: Partial<CanvasLayer>) => void;
  setActiveLayer: (layerId: string) => void;
  reorderLayers: (layerIds: string[]) => void;
  
  // Acciones para el historial
  addHistoryState: (state: HistoryState) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  captureCanvasState: () => void;
  applyHistoryState: (index: number) => void;
  
  // Acciones para comparación A/B
  setComparisonMode: (enabled: boolean) => void;
  setComparisonStates: (stateA: any, stateB: any) => void;
  toggleComparisonView: () => void;
  
  // Acciones para la UI
  setActiveTool: (tool: DrawingTool) => void;
  setBrushSettings: (settings: Partial<AppState['ui']['toolbar']['brushSettings']>) => void;
  setEraserSettings: (settings: Partial<AppState['ui']['toolbar']['eraserSettings']>) => void;
  setSelectionSettings: (settings: Partial<AppState['ui']['toolbar']['selectionSettings']>) => void;
  togglePanel: (panel: keyof AppState['ui']['panels']) => void;
  setPanelWidth: (panel: keyof AppState['ui']['panels'], width: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | undefined) => void;
  
  // Acciones para Gemini
  setGeminiGenerating: (generating: boolean) => void;
  setGeminiRequest: (request: GeminiImageRequest) => void;
  setGeminiResponse: (response: GeminiImageResponse) => void;
  setGeminiApiKey: (apiKey: string) => void;
  setGeminiSettings: (settings: Partial<AppState['gemini']['settings']>) => void;
  generateImage: (prompt: string, settings?: any) => Promise<void>;
  editImage: (prompt: string, settings?: any) => Promise<void>;
  
  // Acciones para proyectos
  setCurrentProject: (project: Project | undefined) => void;
  setProjectModified: (modified: boolean) => void;
  
  // Acciones para el usuario
  setUser: (user: User | undefined) => void;
  
  // Acciones de utilidad
  resetCanvas: () => void;
  resetUI: () => void;
  resetAll: () => void;
}

// Crear el store
export const useAppStore = create<AppStore>()(devtools(
  persist(
    (set, get) => ({
        ...initialState,
        
        // Implementación de acciones para el canvas
        setCanvas: (canvas) => set((state) => ({
          canvas: {
            ...state.canvas,
            fabricCanvas: canvas
          }
        }), false, 'setCanvas'),
        
        setCanvasManager: (manager) => set(() => ({
          canvasManager: manager
        }), false, 'setCanvasManager'),
        
        setCanvasSettings: (settings) => set((state) => ({
          canvas: {
            ...state.canvas,
            settings: { ...state.canvas.settings, ...settings },
            isModified: true
          }
        }), false, 'setCanvasSettings'),
        
        addLayer: (layer) => set((state) => ({
          canvas: {
            ...state.canvas,
            layers: [...state.canvas.layers, layer],
            activeLayerId: layer.id,
            isModified: true
          }
        }), false, 'addLayer'),
        
        removeLayer: (layerId) => set((state) => {
          const newLayers = state.canvas.layers.filter(l => l.id !== layerId);
          const newActiveLayerId = state.canvas.activeLayerId === layerId 
            ? (newLayers.length > 0 ? newLayers[newLayers.length - 1].id : undefined)
            : state.canvas.activeLayerId;
          
          return {
            canvas: {
              ...state.canvas,
              layers: newLayers,
              activeLayerId: newActiveLayerId,
              isModified: true
            }
          };
        }, false, 'removeLayer'),
        
        updateLayer: (layerId, updates) => set((state) => ({
          canvas: {
            ...state.canvas,
            layers: state.canvas.layers.map(layer => 
              layer.id === layerId ? { ...layer, ...updates } : layer
            ),
            isModified: true
          }
        }), false, 'updateLayer'),
        
        setActiveLayer: (layerId) => set((state) => ({
          canvas: {
            ...state.canvas,
            activeLayerId: layerId
          }
        }), false, 'setActiveLayer'),
        
        reorderLayers: (layerIds) => set((state) => {
          const layerMap = new Map(state.canvas.layers.map(layer => [layer.id, layer]));
          const reorderedLayers = layerIds.map(id => layerMap.get(id)!).filter(Boolean);
          
          return {
            canvas: {
              ...state.canvas,
              layers: reorderedLayers,
              isModified: true
            }
          };
        }, false, 'reorderLayers'),
        
        // Implementación de acciones para el historial
        addHistoryState: (historyState) => set((state) => {
          const newHistory = [...state.canvas.history.slice(0, state.canvas.historyIndex + 1), historyState];
          const maxHistorySize = 50; // Limitar el historial
          
          if (newHistory.length > maxHistorySize) {
            newHistory.shift();
          }
          
          return {
            canvas: {
              ...state.canvas,
              history: newHistory,
              historyIndex: newHistory.length - 1
            }
          };
        }, false, 'addHistoryState'),
        
        undo: () => set((state) => {
          if (state.canvas.historyIndex > 0) {
            return {
              canvas: {
                ...state.canvas,
                historyIndex: state.canvas.historyIndex - 1
              }
            };
          }
          return state;
        }, false, 'undo'),
        
        redo: () => set((state) => {
          if (state.canvas.historyIndex < state.canvas.history.length - 1) {
            return {
              canvas: {
                ...state.canvas,
                historyIndex: state.canvas.historyIndex + 1
              }
            };
          }
          return state;
        }, false, 'redo'),
        
        clearHistory: () => set((state) => ({
          canvas: {
            ...state.canvas,
            history: [],
            historyIndex: -1
          }
        }), false, 'clearHistory'),
        
        // Funciones para capturar y aplicar estados del canvas
        captureCanvasState: () => {
          const { canvas: { fabricCanvas }, addHistoryState } = get();
          if (fabricCanvas) {
            const canvasState = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              data: JSON.stringify(fabricCanvas.toJSON()),
              thumbnail: fabricCanvas.toDataURL({ format: 'png', multiplier: 0.1 })
            };
            addHistoryState(canvasState);
          }
        },
        
        applyHistoryState: (index: number) => set((state) => {
          const historyState = state.canvas.history[index];
          if (historyState && state.canvas.fabricCanvas) {
            // Aplicar el estado del historial al canvas
            state.canvas.fabricCanvas.loadFromJSON(historyState.data, () => {
              state.canvas.fabricCanvas?.renderAll();
            });
            
            return {
              canvas: {
                ...state.canvas,
                historyIndex: index
              }
            };
          }
          return state;
        }, false, 'applyHistoryState'),
        
        // Funciones para comparación A/B
        setComparisonMode: (enabled: boolean) => set((state) => ({
          canvas: {
            ...state.canvas,
            comparisonMode: enabled
          }
        }), false, 'setComparisonMode'),
        
        setComparisonStates: (stateA: any, stateB: any) => set((state) => ({
          canvas: {
            ...state.canvas,
            comparisonStateA: stateA,
            comparisonStateB: stateB
          }
        }), false, 'setComparisonStates'),
        
        toggleComparisonView: () => set((state) => ({
          canvas: {
            ...state.canvas,
            showingStateA: !state.canvas.showingStateA
          }
        }), false, 'toggleComparisonView'),
        
        // Implementación de acciones para la UI
        setActiveTool: (tool) => set((state) => ({
          ui: {
            ...state.ui,
            toolbar: {
              ...state.ui.toolbar,
              activeTool: tool
            }
          }
        }), false, 'setActiveTool'),
        
        setBrushSettings: (settings) => set((state) => ({
          ui: {
            ...state.ui,
            toolbar: {
              ...state.ui.toolbar,
              brushSettings: { ...state.ui.toolbar.brushSettings, ...settings }
            }
          }
        }), false, 'setBrushSettings'),
        
        setEraserSettings: (settings) => set((state) => ({
          ui: {
            ...state.ui,
            toolbar: {
              ...state.ui.toolbar,
              eraserSettings: { ...state.ui.toolbar.eraserSettings, ...settings }
            }
          }
        }), false, 'setEraserSettings'),
        
        setSelectionSettings: (settings) => set((state) => ({
          ui: {
            ...state.ui,
            toolbar: {
              ...state.ui.toolbar,
              selectionSettings: { ...state.ui.toolbar.selectionSettings, ...settings }
            }
          }
        }), false, 'setSelectionSettings'),
        
        togglePanel: (panel) => set((state) => ({
          ui: {
            ...state.ui,
            panels: {
              ...state.ui.panels,
              [panel]: {
                ...state.ui.panels[panel],
                visible: !state.ui.panels[panel].visible
              }
            }
          }
        }), false, 'togglePanel'),
        
        setPanelWidth: (panel, width) => set((state) => ({
          ui: {
            ...state.ui,
            panels: {
              ...state.ui.panels,
              [panel]: {
                ...state.ui.panels[panel],
                width: Math.max(200, Math.min(600, width)) // Limitar ancho
              }
            }
          }
        }), false, 'setPanelWidth'),
        
        setLoading: (loading) => set((state) => ({
          ui: {
            ...state.ui,
            loading
          }
        }), false, 'setLoading'),
        
        setError: (error) => set((state) => ({
          ui: {
            ...state.ui,
            error
          }
        }), false, 'setError'),
        
        // Implementación de acciones para Gemini
        setGeminiGenerating: (generating) => set((state) => ({
          gemini: {
            ...state.gemini,
            isGenerating: generating
          }
        }), false, 'setGeminiGenerating'),
        
        setGeminiRequest: (request) => set((state) => ({
          gemini: {
            ...state.gemini,
            lastRequest: request
          }
        }), false, 'setGeminiRequest'),
        
        setGeminiResponse: (response) => set((state) => ({
          gemini: {
            ...state.gemini,
            lastResponse: response
          }
        }), false, 'setGeminiResponse'),
        
        setGeminiApiKey: (apiKey) => set((state) => ({
          gemini: {
            ...state.gemini,
            apiKey
          }
        }), false, 'setGeminiApiKey'),
        
        setGeminiSettings: (settings) => set((state) => ({
          gemini: {
            ...state.gemini,
            settings: { ...state.gemini.settings, ...settings }
          }
        }), false, 'setGeminiSettings'),
        
        generateImage: async (prompt, settings) => {
          const { setGeminiGenerating, setGeminiRequest, setGeminiResponse, setError } = get();
          
          try {
            // Validaciones iniciales
            if (!prompt || prompt.trim().length === 0) {
              throw new Error('El prompt no puede estar vacío');
            }
            
            if (prompt.trim().length > 1000) {
              throw new Error('El prompt es demasiado largo (máximo 1000 caracteres)');
            }
            
            setGeminiGenerating(true);
            setError(undefined);
            
            // Validar configuración de Gemini
            const { validateGeminiConfig } = await import('../lib/gemini');
            const configValidation = validateGeminiConfig();
            if (!configValidation.valid) {
              throw new Error(configValidation.error || 'Configuración de Gemini inválida');
            }
            
            // Importar dinámicamente la función de Gemini
            const { generateWithGemini, canvasToBlob } = await import('../lib/gemini');
            
            // IMPORTANTE: Capturar el contenido actual del canvas como imagen base
            const { canvas: { fabricCanvas }, canvasManager } = get();
            let baseImage: Blob | null = null;
            
            if (fabricCanvas && fabricCanvas.getObjects().length > 0) {
              // Si hay contenido en el canvas, usarlo como referencia
              console.log('Capturando contenido del canvas como referencia para la IA...');
              
              // Usar CanvasManager para optimizar la captura si está disponible
              if (canvasManager) {
                canvasManager.forceRender();
              }
              
              baseImage = await canvasToBlob(fabricCanvas);
              console.log('Canvas capturado como imagen base:', baseImage?.size, 'bytes');
            }
            
            // Crear la request para Gemini
            // Si hay imagen base, usar modo 'edit' para mejorar el dibujo existente
            const request: GeminiImageRequest = {
              mode: baseImage ? 'edit' : 'generate',
              user_prompt: baseImage 
                ? `Mejora y perfecciona este dibujo: ${prompt.trim()}. Mantén la composición y estructura general pero hazlo más detallado y profesional.`
                : prompt.trim(),
              base_image: baseImage, // Incluir el canvas actual como referencia
              edit_strength: settings?.creativity || 0.7,
              preservation_bias: baseImage ? 'high' : 'med', // Preservar más si hay dibujo base
              character_consistency: 'high',
              quality_vs_speed: settings?.quality === 'high' ? 'high' : 'balanced',
              seed: settings?.seed || null
            };
            
            console.log('Request mode:', request.mode, 'Has base image:', !!baseImage);
            setGeminiRequest(request);
            
            // Generar la imagen con timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Timeout: La generación de imagen tardó demasiado')), 30000);
            });
            
            const response = await Promise.race([
              generateWithGemini(request),
              timeoutPromise
            ]);
            
            setGeminiResponse(response);
            
            if (response.success && response.image) {
              // Validar que la imagen sea válida
              if (response.image.size === 0) {
                throw new Error('La imagen generada está vacía');
              }
              
              // Crear URL de la imagen
              const imageUrl = URL.createObjectURL(response.image);
              console.log('URL de imagen generada:', imageUrl);
              
              // Guardar la imagen en el array de imágenes generadas
              const newImage = {
                id: Date.now().toString(),
                url: imageUrl,
                prompt: prompt,
                timestamp: Date.now(),
                settings: settings
              };
              
              set((state) => ({
                ...state,
                generatedImages: [...state.generatedImages, newImage]
              }));
              
              console.log('Imagen guardada en la galería');
              
              // No limpiamos la URL inmediatamente porque la necesitamos para la galería
              // La limpiaremos cuando el componente se desmonte o se genere una nueva imagen
              
              console.log('Image generated successfully:', response.brief_note);
            } else {
              throw new Error(response.error || 'Error desconocido al generar la imagen');
            }
            
          } catch (error) {
            console.error('Error generating image:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido al generar imagen';
            setError(errorMessage);
            
            // Mostrar toast de error si está disponible
            if (typeof window !== 'undefined' && (window as any).showToast) {
              (window as any).showToast(errorMessage, 'error');
            }
          } finally {
            setGeminiGenerating(false);
          }
        },
        
        editImage: async (prompt, settings) => {
          const { setGeminiGenerating, setGeminiRequest, setGeminiResponse, setError } = get();
          
          try {
            setGeminiGenerating(true);
            setError(undefined);
            
            // Importar dinámicamente la función de Gemini
            const { generateWithGemini, canvasToBlob } = await import('../lib/gemini');
            
            // Obtener el canvas actual como imagen base con optimizaciones
            const { canvas: { fabricCanvas }, canvasManager } = get();
            let baseImage: Blob | null = null;
            
            if (fabricCanvas) {
              const { canvasToBlob } = await import('../lib/gemini');
              
              // Usar CanvasManager para optimizar la captura si está disponible
              if (canvasManager) {
                // Forzar render antes de capturar para asegurar estado actualizado
                canvasManager.forceRender();
              }
              
              baseImage = await canvasToBlob(fabricCanvas);
            }
            
            // Crear la request para Gemini
            const request: GeminiImageRequest = {
              mode: 'edit',
              user_prompt: prompt,
              base_image: baseImage,
              edit_strength: settings?.creativity || 0.7,
              preservation_bias: 'med',
              character_consistency: 'med',
              quality_vs_speed: settings?.quality === 'high' ? 'high' : 'balanced',
              seed: settings?.seed || null
            };
            
            setGeminiRequest(request);
            
            // Editar la imagen
            const response = await generateWithGemini(request);
            setGeminiResponse(response);
            
            if (response.success && response.image) {
              // Reemplazar el contenido del canvas con la imagen editada usando optimizaciones
              const { canvas: { fabricCanvas }, canvasManager } = get();
              if (fabricCanvas) {
                // Limpiar el canvas actual de forma optimizada
                if (canvasManager) {
                  // Usar CanvasManager para limpiar eficientemente
                  fabricCanvas.clear();
                  canvasManager.forceRender();
                } else {
                  fabricCanvas.clear();
                }
                
                const imageUrl = URL.createObjectURL(response.image);
                
                // Cargar imagen con optimizaciones
                // Cargar imagen con Fabric v6 async API
                try {
                  const fabricImg = await fabric.Image.fromURL(imageUrl, {
                    crossOrigin: 'anonymous'
                  });
                  
                  if (!fabricImg) return;
                  
                  // Ajustar la imagen al tamaño del canvas
                  const canvasAspect = fabricCanvas.width! / fabricCanvas.height!;
                  const imageAspect = fabricImg.width! / fabricImg.height!;
                  
                  let scale = 1;
                  if (imageAspect > canvasAspect) {
                    scale = fabricCanvas.width! / fabricImg.width!;
                  } else {
                    scale = fabricCanvas.height! / fabricImg.height!;
                  }
                  
                  fabricImg.set({
                    left: fabricCanvas.width! / 2,
                    top: fabricCanvas.height! / 2,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    selectable: true,
                    // Optimizaciones de rendimiento
                    objectCaching: true,
                    statefullCache: true,
                    noScaleCache: false
                  });
                  
                  fabricCanvas.add(fabricImg);
                  
                  // Usar CanvasManager para mejor rendimiento
                  if (canvasManager) {
                    canvasManager.forceRender();
                    canvasManager.saveState();
                  } else {
                    fabricCanvas.renderAll();
                    get().captureCanvasState();
                  }
                  
                  // Limpiar la URL del objeto después de usarla
                  setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
                } catch (error) {
                  console.error('Error al cargar imagen editada:', error);
                }
              }
              console.log('Image edited successfully:', response.brief_note);
            } else {
              throw new Error(response.error || 'Failed to edit image');
            }
            
          } catch (error) {
            console.error('Error editing image:', error);
            setError(error instanceof Error ? error.message : 'Error editing image');
          } finally {
            setGeminiGenerating(false);
          }
        },
        
        // Implementación de acciones para proyectos
        setCurrentProject: (project) => set(() => ({
          currentProject: project
        }), false, 'setCurrentProject'),
        
        setProjectModified: (modified) => set((state) => ({
          canvas: {
            ...state.canvas,
            isModified: modified
          }
        }), false, 'setProjectModified'),
        
        // Implementación de acciones para el usuario
        setUser: (user) => set(() => ({
          user
        }), false, 'setUser'),
        
        // Implementación de acciones de utilidad
        resetCanvas: () => set((state) => ({
          canvas: {
            ...initialState.canvas,
            settings: { ...state.canvas.settings } // Mantener configuraciones del canvas
          }
        }), false, 'resetCanvas'),
        
        resetUI: () => set(() => ({
          ui: initialState.ui
        }), false, 'resetUI'),
        
        resetAll: () => set(() => initialState, false, 'resetAll')
      }),
      {
        name: 'lienzo-app-storage',
        partialize: (state) => ({
          // Solo persistir configuraciones de UI y preferencias del usuario
          ui: {
            panels: state.ui.panels,
            toolbar: state.ui.toolbar
          },
          canvas: {
            settings: state.canvas.settings
          },
          gemini: {
            apiKey: state.gemini.apiKey
          }
        })
      }
    ),
    {
      name: 'lienzo-app-store'
    }
  ));

// Selectores útiles
export const useCanvasSettings = () => useAppStore(state => state.canvas.settings);
export const useCanvasLayers = () => useAppStore(state => state.canvas.layers);
export const useActiveLayer = () => useAppStore(state => {
  const layers = state.canvas.layers;
  const activeId = state.canvas.activeLayerId;
  return layers.find(layer => layer.id === activeId);
});
export const useActiveTool = () => useAppStore(state => state.ui.toolbar.activeTool);
export const useBrushSettings = () => useAppStore(state => state.ui.toolbar.brushSettings);
export const useEraserSettings = () => useAppStore(state => state.ui.toolbar.eraserSettings);
export const useSelectionSettings = () => useAppStore(state => state.ui.toolbar.selectionSettings);
export const usePanelState = () => useAppStore(state => state.ui.panels);
export const useGeminiState = () => useAppStore(state => state.gemini);
export const useHistoryState = () => useAppStore(state => ({
  history: state.canvas.history,
  historyIndex: state.canvas.historyIndex,
  canUndo: state.canvas.historyIndex > 0,
  canRedo: state.canvas.historyIndex < state.canvas.history.length - 1
}));