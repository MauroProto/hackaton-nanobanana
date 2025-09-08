import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as fabric from 'fabric';
import { 
  Sparkles, 
  Image, 
  Wand2, 
  Settings, 
  Layers, 
  Eye, 
  EyeOff, 
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  Brain,
  Zap
} from 'lucide-react';
import { useAppStore } from '../store';
import { 
  selectGeminiSettings,
  selectIsGenerating,
  selectLayers,
  selectActiveLayerId
} from '../store/selectors';
import { CollapsibleSection } from './ui/CollapsibleSection';
import { HistoryPanel } from './HistoryPanel';
import { GeminiPromptType, CanvasLayer } from '../types';
import { smartGenerate, analyzeCanvasContext, filterDrawingObjects, createDrawingOnlyCanvas } from '../lib/gemini';
import { LayeredCanvasManager } from '../lib/canvas-layers';
import { useNanoBananaToasts } from '../hooks/useToast';

const RightPanel: React.FC = React.memo(() => {
  // Usar selectores optimizados para evitar re-renders innecesarios
  const geminiSettingsRaw = useAppStore(selectGeminiSettings);
  const isGenerating = useAppStore(selectIsGenerating);
  const layers = useAppStore(selectLayers);
  const activeLayerId = useAppStore(selectActiveLayerId);
  const generateImage = useAppStore(state => state.generateImage);
  const editImage = useAppStore(state => state.editImage);
  const setGeminiSettings = useAppStore(state => state.setGeminiSettings);
  const addLayerAction = useAppStore(state => state.addLayer);
  const removeLayer = useAppStore(state => state.removeLayer);
  const updateLayer = useAppStore(state => state.updateLayer);
  const setActiveLayer = useAppStore(state => state.setActiveLayer);
  
  // Proporcionar valores por defecto para geminiSettings
  const geminiSettings = geminiSettingsRaw || {
    quality: 'standard' as 'standard' | 'high',
    style: 'natural',
    aspectRatio: '1:1',
    negativePrompt: '',
    seed: undefined,
    creativity: 0.7
  };

  const [promptType, setPromptType] = useState<GeminiPromptType>('generate');
  const [customPrompt, setCustomPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState<number | ''>('');
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [smartMode, setSmartMode] = useState(true); // Modo inteligente activado por defecto
  const [detectedMode, setDetectedMode] = useState<string>(''); // Modo detectado automáticamente
  const [canvasAnalysis, setCanvasAnalysis] = useState<any>(null);

  // Obtener el canvas manager del store (si existe)
  const canvasManager = useAppStore(state => (state as any).canvasManager);
  
  // Hook para notificaciones
  const toast = useNanoBananaToasts();

  // Analizar el canvas cuando cambie
  useEffect(() => {
    const analyzeCanvas = async () => {
      if (!canvasManager || !(canvasManager instanceof LayeredCanvasManager)) return;
      
      try {
        const state = canvasManager.getCanvasState();
        const analysis = await analyzeCanvasContext(state);
        setCanvasAnalysis(analysis);
        
        // Determinar modo detectado
        let mode = '';
        if (analysis.user_intent.action === 'create') {
          mode = 'Generación desde dibujo';
        } else if (analysis.user_intent.action === 'edit') {
          mode = 'Edición de imagen';
        } else if (analysis.user_intent.action === 'enhance') {
          mode = 'Mejora de imagen';
        } else {
          mode = 'Generación libre';
        }
        
        // Solo mostrar notificación si el modo cambió
        if (mode !== detectedMode && smartMode) {
          setDetectedMode(mode);
          if (mode !== 'Generación libre') {
            toast.modeDetected(mode);
          }
        } else {
          setDetectedMode(mode);
        }
      } catch (error) {
        console.error('Error analizando canvas:', error);
      }
    };
    
    analyzeCanvas();
  }, [canvasManager, smartMode]);

  const handleGenerate = useCallback(async () => {
    console.log('🍌 GENERANDO CON NANO BANANA - Capturando imagen actual del canvas...');
    
    // Add to prompt history si hay prompt
    if (customPrompt.trim() && !promptHistory.includes(customPrompt)) {
      setPromptHistory(prev => [customPrompt, ...prev.slice(0, 9)]); // Keep last 10
    }
    
    let loadingToastId: string | null = null;
    
    try {
      const enhancedSettings = {
        ...geminiSettings,
        negativePrompt: negativePrompt.trim() || undefined,
        seed: seed || undefined
      };
      
      // SIEMPRE capturar el estado actual del canvas - SOLO DIBUJOS NUEVOS
      let canvasImage: Blob | null = null;
      
      if (canvasManager) {
        console.log('📸 Capturando imagen del canvas...');
        
        // Si es LayeredCanvasManager, usar exportForNanoBanana
        if (canvasManager instanceof LayeredCanvasManager) {
          const canvasExport = await canvasManager.exportForNanoBanana();
          // Preferir drawingLayer (dibujos nuevos) sobre baseImage (imagen previa)
          canvasImage = canvasExport.drawingLayer || canvasExport.baseImage || null;
        } else if (typeof canvasManager.exportCanvas === 'function') {
          // Si tiene método exportCanvas, usarlo
          canvasImage = await canvasManager.exportCanvas();
        } else {
          // Obtener fabricCanvas del store
          const fabricCanvas = useAppStore.getState().canvas.fabricCanvas;
          if (fabricCanvas) {
            console.log('🔍 Filtrando solo dibujos del usuario...');
            
            // Usar función auxiliar para filtrar objetos de dibujo
            const drawingObjects = filterDrawingObjects(fabricCanvas.getObjects());
            
            if (drawingObjects.length > 0) {
              // Usar función auxiliar para crear canvas temporal
              canvasImage = await createDrawingOnlyCanvas(fabricCanvas, drawingObjects);
            } else {
              console.log('ℹ️ No hay dibujos nuevos, solo imágenes previas');
              canvasImage = null;
            }
          }
        }
        
        console.log('✅ Imagen capturada del canvas:', canvasImage ? 'Sí' : 'No');
      }
      
      if (smartMode && canvasManager instanceof LayeredCanvasManager) {
        // MODO INTELIGENTE: Usar smartGenerate
        console.log('🤖 Usando modo inteligente de generación...');
        
        // Verificar si el canvas está vacío
        const canvasState = canvasManager.getCanvasState();
        if (!canvasImage && !customPrompt.trim()) {
          toast.emptyCanvas();
          return;
        }
        
        // Mostrar notificación de generación
        loadingToastId = toast.generatingImage();
        
        // Exportar todo el canvas para Nano Banana
        const canvasExport = await canvasManager.exportForNanoBanana();
        
        // Si hay análisis, mostrar qué se detectó
        if (canvasAnalysis && canvasAnalysis.user_intent.action !== 'create') {
          toast.analyzingCanvas();
        }
        
        // Llamar a smartGenerate
        const result = await smartGenerate(
          canvasExport,
          customPrompt.trim() || undefined,
          enhancedSettings
        );
        
        // Añadir la imagen generada al canvas
        if (result) {
          await canvasManager.addImage(result, 'generated');
          console.log('✅ Imagen añadida al canvas');
          
          // Cerrar loading toast y mostrar éxito
          if (loadingToastId) {
            toast.removeToast(loadingToastId);
          }
          toast.imageGenerated();
        }
      } else {
        // MODO CLÁSICO: Usar generación/edición directa
        loadingToastId = toast.generatingImage();
        
        if (promptType === 'generate') {
          await generateImage(customPrompt, enhancedSettings);
        } else {
          await editImage(customPrompt, enhancedSettings);
        }
        
        if (loadingToastId) {
          toast.removeToast(loadingToastId);
        }
        toast.imageGenerated();
      }
    } catch (error) {
      console.error('Error generando/editando imagen:', error);
      
      // Cerrar loading toast si existe
      if (loadingToastId) {
        toast.removeToast(loadingToastId);
      }
      
      // Mostrar error
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.generationError(errorMessage);
    }
  }, [customPrompt, promptHistory, geminiSettings, negativePrompt, seed, promptType, generateImage, editImage, smartMode, canvasManager, canvasAnalysis, toast]);

  // Sugerencias inteligentes basadas en el contexto del canvas
  const promptSuggestions = useMemo(() => {
    if (smartMode && canvasAnalysis) {
      // Sugerencias basadas en el análisis del canvas
      const action = canvasAnalysis.user_intent.action;
      
      if (action === 'create' && canvasAnalysis.canvas_state.has_drawing) {
        return [
          'Convertir en ilustración profesional con colores vibrantes',
          'Estilo realista fotográfico con alta definición',
          'Arte digital estilizado con efectos de luz',
          'Pintura al óleo con texturas visibles',
          'Estilo anime/manga con colores saturados'
        ];
      } else if (action === 'edit') {
        return [
          'Mejorar los detalles y añadir profundidad',
          'Cambiar el fondo por un paisaje natural',
          'Añadir efectos de iluminación dramática',
          'Convertir en versión nocturna con luces',
          'Aplicar estilo cyberpunk futurista'
        ];
      } else if (action === 'enhance') {
        return [
          'Aumentar resolución y nitidez',
          'Mejorar colores y contraste',
          'Añadir detalles finos y texturas',
          'Corregir imperfecciones y artefactos',
          'Aplicar estilo cinematográfico'
        ];
      }
    }
    
    // Sugerencias por defecto para modo clásico
    return promptType === 'generate' ? [
      'Un paisaje montañoso al atardecer con colores cálidos',
      'Un gato espacial flotando entre estrellas',
      'Una ciudad futurista con edificios de cristal',
      'Un bosque mágico con luces brillantes'
    ] : [
      'Cambiar el color del cielo a púrpura',
      'Añadir flores en el primer plano',
      'Hacer que el objeto sea más brillante',
      'Cambiar la iluminación a luz dorada'
    ];
  }, [smartMode, canvasAnalysis, promptType]);

  // Memoizar handlers
  const handlePromptTypeChange = useCallback((type: GeminiPromptType) => {
    setPromptType(type);
  }, []);

  const handleCustomPromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomPrompt(e.target.value);
  }, []);

  const handleNegativePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNegativePrompt(e.target.value);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setCustomPrompt(suggestion);
  }, []);

  const handlePromptHistoryClick = useCallback((prompt: string) => {
    setCustomPrompt(prompt);
  }, []);

  const handleClearHistory = useCallback(() => {
    setPromptHistory([]);
  }, []);

  const handleSeedChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSeed(e.target.value ? parseInt(e.target.value) : '');
  }, []);

  const handleRandomSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 1000000));
  }, []);

  const handleAddLayer = useCallback(() => {
    const newLayer: CanvasLayer = {
      id: `layer-${Date.now()}`,
      type: 'base',
      name: `Capa ${(layers || []).length + 1}`,
      visible: true,
      opacity: 1,
      zIndex: (layers || []).length,
      data: null,
      locked: false,
      blendMode: 'normal'
    };
    addLayerAction(newLayer);
  }, [layers, addLayerAction]);

  const handleLayerVisibilityToggle = useCallback((layerId: string, visible: boolean) => {
    updateLayer(layerId, { visible: !visible });
  }, [updateLayer]);

  const handleLayerSelect = useCallback((layerId: string) => {
    setActiveLayer(layerId);
  }, [setActiveLayer]);

  const handleLayerRemove = useCallback((layerId: string) => {
    removeLayer(layerId);
  }, [removeLayer]);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
      {/* AI Generation Section */}
      <CollapsibleSection title="Generación con IA">
        <div className="space-y-4">
          {/* Smart Mode Toggle */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Brain className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Modo Inteligente</span>
              </div>
              <button
                onClick={() => setSmartMode(!smartMode)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  smartMode ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    smartMode ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {smartMode && (
              <div className="text-xs text-blue-600">
                <div className="flex items-center space-x-1">
                  <Zap className="h-3 w-3" />
                  <span className="font-medium">Detección automática:</span>
                  <span className="text-blue-800 font-semibold">{detectedMode || 'Analizando...'}</span>
                </div>
                {canvasAnalysis && (
                  <div className="mt-1 text-blue-500">
                    {canvasAnalysis.workflow_suggestion.next_step}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt Type - Solo mostrar si no está en modo inteligente */}
          {!smartMode && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Tipo de operación
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePromptTypeChange('generate')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    promptType === 'generate'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Image className="h-3 w-3 inline mr-1" />
                  Generar
                </button>
                <button
                  onClick={() => handlePromptTypeChange('edit')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    promptType === 'edit'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Wand2 className="h-3 w-3 inline mr-1" />
                  Editar
                </button>
              </div>
            </div>
          )}

          {/* Prompt Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              {smartMode ? 'Descripción (opcional)' : 'Descripción'}
            </label>
            <textarea
              value={customPrompt}
              onChange={handleCustomPromptChange}
              placeholder={
                smartMode 
                  ? 'Añade detalles adicionales o deja vacío para generación automática...'
                  : `Describe lo que quieres ${promptType === 'generate' ? 'generar' : 'editar'}...`
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={(!smartMode && !customPrompt.trim()) || isGenerating}
            className={`w-full flex items-center justify-center space-x-2 px-4 py-2 text-white text-sm font-medium rounded-md transition-all ${
              smartMode 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            } disabled:bg-gray-400`}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Procesando...</span>
              </>
            ) : (
              <>
                {smartMode ? (
                  <Brain className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span>
                  {smartMode 
                    ? 'Generar con Nano Banana' 
                    : (promptType === 'generate' ? 'Generar' : 'Editar')}
                </span>
              </>
            )}
          </button>

          {/* Prompt Suggestions */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              {smartMode ? 'Sugerencias Inteligentes' : 'Sugerencias'}
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {(Array.isArray(promptSuggestions) ? promptSuggestions : promptSuggestions[promptType] || []).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={`w-full text-left px-2 py-1 text-xs rounded border transition-colors ${
                    smartMode 
                      ? 'text-blue-700 hover:bg-blue-50 border-blue-200' 
                      : 'text-gray-600 hover:bg-gray-100 border-gray-200'
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Negative Prompt */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Prompt negativo (opcional)
            </label>
            <textarea
              value={negativePrompt}
              onChange={handleNegativePromptChange}
              placeholder="Describe lo que NO quieres en la imagen..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
            />
          </div>

          {/* Prompt History */}
          {promptHistory.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-700">
                  Historial de prompts
                </label>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Limpiar
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {promptHistory.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => handlePromptHistoryClick(prompt)}
                    className="w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-blue-50 rounded border border-gray-200 transition-colors truncate"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* AI Settings */}
      <CollapsibleSection title="Configuración de IA" defaultOpen={false}>
        <div className="space-y-4">
          {/* Quality */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Calidad: {geminiSettings.quality}
            </label>
            <select
              value={geminiSettings.quality}
              onChange={(e) => setGeminiSettings({ 
                ...geminiSettings, 
                quality: e.target.value as 'standard' | 'high' 
              })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
            >
              <option value="standard">Estándar</option>
              <option value="high">Alta</option>
            </select>
          </div>

          {/* Style */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Estilo
            </label>
            <select
              value={geminiSettings.style || 'natural'}
              onChange={(e) => setGeminiSettings({ 
                ...geminiSettings, 
                style: e.target.value 
              })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
            >
              <option value="natural">Natural</option>
              <option value="artistic">Artístico</option>
              <option value="photographic">Fotográfico</option>
              <option value="digital-art">Arte Digital</option>
            </select>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Proporción
            </label>
            <select
              value={geminiSettings.aspectRatio || '1:1'}
              onChange={(e) => setGeminiSettings({ 
                ...geminiSettings, 
                aspectRatio: e.target.value 
              })}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
            >
              <option value="1:1">Cuadrado (1:1)</option>
              <option value="16:9">Panorámico (16:9)</option>
              <option value="4:3">Estándar (4:3)</option>
              <option value="3:4">Retrato (3:4)</option>
            </select>
          </div>

          {/* Seed */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Semilla (para reproducibilidad)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                value={seed}
                onChange={handleSeedChange}
                placeholder="Opcional"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
              />
              <button
                onClick={handleRandomSeed}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                Aleatorio
              </button>
            </div>
          </div>

          {/* Creativity Level */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Creatividad: {geminiSettings.creativity || 0.7}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={geminiSettings.creativity || 0.7}
              onChange={(e) => setGeminiSettings({ 
                ...geminiSettings, 
                creativity: parseFloat(e.target.value) 
              })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Conservador</span>
              <span>Creativo</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Layers Section */}
      <CollapsibleSection title="Capas">
        <div className="space-y-2">
          {/* Add Layer Button */}
          <button
            onClick={handleAddLayer}
            className="w-full flex items-center justify-center space-x-1 px-2 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Nueva Capa</span>
          </button>

          {/* Layers List */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(layers || []).map((layer) => (
              <div
                key={layer.id}
                className={`flex items-center space-x-2 p-2 rounded border ${
                  layer.id === activeLayerId
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <button
                  onClick={() => handleLayerVisibilityToggle(layer.id, layer.visible)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {layer.visible ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </button>
                
                <button
                  onClick={() => handleLayerSelect(layer.id)}
                  className="flex-1 text-left text-xs font-medium text-gray-700 truncate"
                >
                  {layer.name}
                </button>
                
                <button
                  onClick={() => handleLayerRemove(layer.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* History Section */}
      <CollapsibleSection title="Historial" defaultOpen={false}>
        <HistoryPanel />
      </CollapsibleSection>

      {/* Export Section */}
      <CollapsibleSection title="Exportar" defaultOpen={false}>
        <div className="space-y-3">
          <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
            <strong>Aviso SynthID:</strong> Las imágenes generadas con IA pueden contener marcas de agua invisibles para identificación.
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
              PNG
            </button>
            <button className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
              JPG
            </button>
            <button className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
              SVG
            </button>
            <button className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors">
              PDF
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
});

RightPanel.displayName = 'RightPanel';

export { RightPanel };