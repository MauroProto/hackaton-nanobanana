// Sistema de capas avanzado para el canvas
// FASE 1.1 - Sistema de capas mejorado

import * as fabric from 'fabric';
import { DrawingTool } from '../types';

// Tipos para el sistema de capas
export interface LayerConfig {
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  type: 'base' | 'drawing' | 'text' | 'mask' | 'reference';
}

export interface CanvasState {
  hasBaseImage: boolean;
  hasDrawing: boolean;
  hasText: boolean;
  hasMask: boolean;
  layers: Map<string, LayerData>;
  metadata: {
    lastModified: Date;
    mode: 'generate' | 'edit';
    width: number;
    height: number;
  };
}

export interface LayerData {
  config: LayerConfig;
  canvas: fabric.Canvas;
  objects: fabric.Object[];
}

export interface TextObject {
  id: string;
  text: string;
  position: { x: number; y: number };
  style: {
    fontSize: number;
    fontFamily: string;
    color: string;
    bold?: boolean;
    italic?: boolean;
  };
}

// Tipos para callbacks de cambios
export type CanvasChangeEvent = 
  | 'drawing-added'
  | 'drawing-modified'
  | 'drawing-removed'
  | 'text-added'
  | 'text-modified'
  | 'text-removed'
  | 'base-image-added'
  | 'base-image-removed'
  | 'mask-added'
  | 'mask-modified'
  | 'layer-visibility-changed'
  | 'canvas-cleared';

export interface CanvasChangeData {
  event: CanvasChangeEvent;
  timestamp: Date;
  details?: any;
  state: CanvasState;
}

export class LayeredCanvasManager {
  private mainCanvas: fabric.Canvas;
  private layers: Map<string, LayerData>;
  private activeLayer: string;
  private width: number;
  private height: number;
  private baseImage: fabric.Image | null = null;
  private textObjects: Map<string, TextObject> = new Map();
  
  // Sistema de detección de cambios
  private changeListeners: Map<string, (data: CanvasChangeData) => void> = new Map();
  private changeHistory: CanvasChangeData[] = [];
  private maxHistorySize: number = 100;
  private lastState: CanvasState | null = null;
  
  constructor(canvasElement: HTMLCanvasElement, width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
    this.layers = new Map();
    this.activeLayer = 'drawing';
    
    // Canvas principal que muestra todas las capas combinadas
    this.mainCanvas = new fabric.Canvas(canvasElement, {
      width: this.width,
      height: this.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      imageSmoothingEnabled: true
    });
    
    // Inicializar capas predefinidas
    this.initializeLayers();
    this.setupEventListeners();
  }
  
  private initializeLayers(): void {
    // Capa base para imagen original
    this.createLayer('base', {
      name: 'Base Image',
      visible: true,
      locked: false,
      opacity: 1,
      type: 'base'
    });
    
    // Capa de dibujo para trazos del usuario
    this.createLayer('drawing', {
      name: 'Drawing',
      visible: true,
      locked: false,
      opacity: 1,
      type: 'drawing'
    });
    
    // Capa de texto para elementos de texto
    this.createLayer('text', {
      name: 'Text',
      visible: true,
      locked: false,
      opacity: 1,
      type: 'text'
    });
    
    // Capa de máscara para indicar áreas de modificación
    this.createLayer('mask', {
      name: 'Mask',
      visible: false,
      locked: false,
      opacity: 0.5,
      type: 'mask'
    });
    
    console.log('✅ Capas inicializadas:', Array.from(this.layers.keys()));
  }
  
  private createLayer(id: string, config: LayerConfig): void {
    // Crear un canvas virtual para cada capa
    const layerCanvas = new fabric.Canvas(document.createElement('canvas'), {
      width: this.width,
      height: this.height,
      backgroundColor: 'transparent'
    });
    
    this.layers.set(id, {
      config,
      canvas: layerCanvas,
      objects: []
    });
  }
  
  private setupEventListeners(): void {
    // Escuchar cambios en el canvas principal
    this.mainCanvas.on('path:created', (e: any) => {
      if (this.activeLayer === 'drawing' && e.path) {
        this.addObjectToLayer('drawing', e.path);
      }
    });
    
    this.mainCanvas.on('object:added', (e: any) => {
      // Registrar objetos en la capa activa
      console.log('Objeto añadido a capa:', this.activeLayer);
    });
    
    this.mainCanvas.on('object:modified', () => {
      this.updateLayerObjects();
    });
  }
  
  // Añadir objeto a una capa específica
  private addObjectToLayer(layerId: string, object: fabric.Object): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.objects.push(object);
      console.log(`Objeto añadido a capa ${layerId}:`, object.type);
    }
  }
  
  // MÉTODOS PÚBLICOS PARA GESTIÓN DE CAPAS
  
  // Cambiar capa activa
  public setActiveLayer(layerId: string): void {
    if (this.layers.has(layerId)) {
      this.activeLayer = layerId;
      console.log('Capa activa:', layerId);
    }
  }
  
  // Obtener capa activa
  public getActiveLayer(): string {
    return this.activeLayer;
  }
  
  // Cambiar visibilidad de una capa
  public setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.config.visible = visible;
      this.renderAllLayers();
    }
  }
  
  // Bloquear/desbloquear capa
  public setLayerLocked(layerId: string, locked: boolean): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      layer.config.locked = locked;
    }
  }
  
  // MÉTODOS PARA IMAGEN BASE
  
  public async setBaseImage(imageUrl: string | Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = typeof imageUrl === 'string' ? imageUrl : URL.createObjectURL(imageUrl);
      
      fabric.Image.fromURL(url).then((img) => {
        // Escalar imagen para ajustar al canvas
        const scale = Math.min(
          this.width / (img.width || 1),
          this.height / (img.height || 1)
        );
        
        img.set({
          scaleX: scale,
          scaleY: scale,
          left: (this.width - (img.width || 0) * scale) / 2,
          top: (this.height - (img.height || 0) * scale) / 2,
          selectable: false,
          evented: false
        });
        
        // Limpiar capa base anterior
        const baseLayer = this.layers.get('base');
        if (baseLayer) {
          baseLayer.objects = [img];
          this.baseImage = img;
        }
        
        this.renderAllLayers();
        console.log('✅ Imagen base establecida');
        this.emitChange('base-image-added', { image: img });
        resolve();
      }).catch(reject);
    });
  }
  
  public clearBaseImage(): void {
    const baseLayer = this.layers.get('base');
    if (baseLayer) {
      baseLayer.objects = [];
      this.baseImage = null;
      this.renderAllLayers();
    }
  }
  
  // MÉTODOS PARA TEXTO
  
  public addText(text: string, options: any = {}): string {
    const textId = `text_${Date.now()}`;
    
    const textObj = new fabric.IText(text, {
      left: options.x || 100,
      top: options.y || 100,
      fontSize: options.fontSize || 24,
      fontFamily: options.fontFamily || 'Arial',
      fill: options.color || '#000000',
      fontWeight: options.bold ? 'bold' : 'normal',
      fontStyle: options.italic ? 'italic' : 'normal',
      editable: true,
      id: textId
    });
    
    // Guardar en el registro de textos
    this.textObjects.set(textId, {
      id: textId,
      text: text,
      position: { x: options.x || 100, y: options.y || 100 },
      style: {
        fontSize: options.fontSize || 24,
        fontFamily: options.fontFamily || 'Arial',
        color: options.color || '#000000',
        bold: options.bold,
        italic: options.italic
      }
    });
    
    // Añadir a la capa de texto
    const textLayer = this.layers.get('text');
    if (textLayer) {
      textLayer.objects.push(textObj);
      this.mainCanvas.add(textObj);
      this.mainCanvas.setActiveObject(textObj);
      this.mainCanvas.requestRenderAll();
    }
    
    console.log('✅ Texto añadido:', textId);
    return textId;
  }
  
  public updateText(textId: string, newText: string): void {
    const textData = this.textObjects.get(textId);
    if (textData) {
      textData.text = newText;
      // Actualizar objeto en canvas
      const objects = this.mainCanvas.getObjects();
      const textObj = objects.find((obj: any) => obj.id === textId);
      if (textObj && textObj.type === 'i-text') {
        (textObj as fabric.IText).set('text', newText);
        this.mainCanvas.requestRenderAll();
      }
    }
  }
  
  public removeText(textId: string): void {
    this.textObjects.delete(textId);
    const objects = this.mainCanvas.getObjects();
    const textObj = objects.find((obj: any) => obj.id === textId);
    if (textObj) {
      this.mainCanvas.remove(textObj);
      this.mainCanvas.requestRenderAll();
    }
  }
  
  // MÉTODOS PARA MÁSCARA
  
  public startMaskDrawing(): void {
    this.setActiveLayer('mask');
    this.setLayerVisibility('mask', true);
    
    // Configurar pincel para máscara
    this.mainCanvas.isDrawingMode = true;
    const brush = new fabric.PencilBrush(this.mainCanvas);
    brush.color = 'rgba(255, 0, 0, 0.5)'; // Rojo semi-transparente para visualización
    brush.width = 20;
    this.mainCanvas.freeDrawingBrush = brush;
    
    console.log('🎭 Modo máscara activado');
  }
  
  public endMaskDrawing(): void {
    this.mainCanvas.isDrawingMode = false;
    this.setActiveLayer('drawing');
    console.log('🎭 Modo máscara desactivado');
  }
  
  // MÉTODOS DE DETECCIÓN DE CAMBIOS
  
  public getCanvasState(): CanvasState {
    const hasDrawing = this.layers.get('drawing')?.objects.length! > 0;
    const hasText = this.textObjects.size > 0;
    const hasMask = this.layers.get('mask')?.objects.length! > 0;
    
    return {
      hasBaseImage: this.baseImage !== null,
      hasDrawing,
      hasText,
      hasMask,
      layers: this.layers,
      metadata: {
        lastModified: new Date(),
        mode: this.baseImage ? 'edit' : 'generate',
        width: this.width,
        height: this.height
      }
    };
  }
  
  // ===== MÉTODOS DE EXPORTACIÓN INTELIGENTE (FASE 1.4) =====
  
  // Exportar solo la capa de dibujo (sin imagen base)
  public async exportDrawingLayer(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      const tempFabric = new fabric.Canvas(tempCanvas, {
        backgroundColor: 'transparent'
      });
      
      // Copiar solo objetos de la capa de dibujo
      const drawingLayer = this.layers.get('drawing');
      if (drawingLayer && drawingLayer.objects.length > 0) {
        drawingLayer.objects.forEach(obj => {
          // Clonar objeto para no afectar el original
          obj.clone().then((cloned: fabric.Object) => {
            tempFabric.add(cloned);
          });
        });
        
        // Esperar un momento para que se renderice
        setTimeout(() => {
          tempCanvas.toBlob((blob) => {
            if (blob) {
              console.log('✅ Capa de dibujo exportada:', blob.size, 'bytes');
              resolve(blob);
            } else {
              reject(new Error('No se pudo exportar la capa de dibujo'));
            }
            tempFabric.dispose();
          }, 'image/png');
        }, 100);
      } else {
        // Si no hay dibujos, devolver imagen transparente
        tempCanvas.toBlob((blob) => {
          resolve(blob || new Blob());
          tempFabric.dispose();
        }, 'image/png');
      }
    });
  }
  
  // Exportar imagen completa (todas las capas visibles fusionadas)
  public async exportFullImage(format: 'png' | 'jpeg' | 'webp' = 'png', quality: number = 1): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        // Renderizar todas las capas
        this.renderAllLayers();
        
        const dataUrl = this.mainCanvas.toDataURL({
          format: format,
          quality: quality,
          multiplier: 1,
          enableRetinaScaling: false
        });
        
        // Convertir dataURL a Blob
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            console.log(`✅ Imagen completa exportada (${format}):`, blob.size, 'bytes');
            resolve(blob);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Exportar máscara de modificaciones (blanco = modificar, negro = preservar)
  public async exportMask(): Promise<Blob> {
    return new Promise((resolve) => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      const ctx = tempCanvas.getContext('2d')!;
      
      // Fondo negro (áreas a preservar)
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Obtener objetos de la capa de máscara
      const maskLayer = this.layers.get('mask');
      if (maskLayer && maskLayer.objects.length > 0) {
        // Crear canvas temporal con Fabric para renderizar la máscara
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = this.width;
        maskCanvas.height = this.height;
        const maskFabric = new fabric.Canvas(maskCanvas);
        
        // Añadir objetos de máscara en blanco
        maskLayer.objects.forEach(obj => {
          obj.clone().then((cloned: fabric.Object) => {
            cloned.set({
              fill: 'white',
              stroke: 'white',
              opacity: 1
            });
            maskFabric.add(cloned);
          });
        });
        
        // Renderizar máscara
        setTimeout(() => {
          const maskData = maskFabric.toDataURL({
            format: 'png',
            multiplier: 1
          });
          
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            tempCanvas.toBlob((blob) => {
              console.log('✅ Máscara exportada:', blob?.size, 'bytes');
              resolve(blob || new Blob());
              maskFabric.dispose();
            }, 'image/png');
          };
          img.src = maskData;
        }, 100);
      } else {
        // Si no hay máscara, devolver imagen negra (sin modificaciones)
        tempCanvas.toBlob((blob) => {
          console.log('ℹ️ No hay máscara, exportando imagen negra');
          resolve(blob || new Blob());
        }, 'image/png');
      }
    });
  }
  
  // Exportar imagen base sola (sin modificaciones)
  public async exportBaseImage(): Promise<Blob | null> {
    if (!this.baseImage) {
      console.log('⚠️ No hay imagen base para exportar');
      return null;
    }
    
    return new Promise((resolve) => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.width;
      tempCanvas.height = this.height;
      const tempFabric = new fabric.Canvas(tempCanvas, {
        backgroundColor: '#ffffff'
      });
      
      this.baseImage.clone().then((cloned: fabric.Object) => {
        tempFabric.add(cloned);
        tempFabric.requestRenderAll();
        
        setTimeout(() => {
          tempCanvas.toBlob((blob) => {
            console.log('✅ Imagen base exportada:', blob?.size, 'bytes');
            resolve(blob);
            tempFabric.dispose();
          }, 'image/png');
        }, 100);
      });
    });
  }
  
  // Exportar composición inteligente para Nano Banana
  public async exportForNanoBanana(): Promise<{
    baseImage: Blob | null;
    drawingLayer: Blob;
    maskLayer: Blob;
    fullComposite: Blob;
    metadata: any;
  }> {
    console.log('🍌 Exportando para Nano Banana...');
    
    const [baseImage, drawingLayer, maskLayer, fullComposite] = await Promise.all([
      this.exportBaseImage(),
      this.exportDrawingLayer(),
      this.exportMask(),
      this.exportFullImage()
    ]);
    
    const metadata = this.exportMetadata();
    const analysis = this.analyzeContent();
    
    return {
      baseImage,
      drawingLayer,
      maskLayer,
      fullComposite,
      metadata: {
        ...metadata,
        analysis,
        exportTime: new Date().toISOString(),
        canvasSize: { width: this.width, height: this.height }
      }
    };
  }
  
  // Exportar capas específicas
  public async exportLayers(layerIds: string[]): Promise<Map<string, Blob>> {
    const exports = new Map<string, Blob>();
    
    for (const layerId of layerIds) {
      const layer = this.layers.get(layerId);
      if (layer && layer.objects.length > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = this.height;
        const tempFabric = new fabric.Canvas(tempCanvas, {
          backgroundColor: 'transparent'
        });
        
        // Copiar objetos de la capa
        for (const obj of layer.objects) {
          const cloned = await obj.clone();
          tempFabric.add(cloned);
        }
        
        tempFabric.requestRenderAll();
        
        // Exportar capa
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            tempCanvas.toBlob((blob) => {
              if (blob) {
                exports.set(layerId, blob);
                console.log(`✅ Capa ${layerId} exportada:`, blob.size, 'bytes');
              }
              tempFabric.dispose();
              resolve();
            }, 'image/png');
          }, 100);
        });
      }
    }
    
    return exports;
  }
  
  // Exportar región específica del canvas
  public async exportRegion(x: number, y: number, width: number, height: number): Promise<Blob> {
    return new Promise((resolve) => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const ctx = tempCanvas.getContext('2d')!;
      
      // Obtener imagen del canvas principal
      const mainDataUrl = this.mainCanvas.toDataURL();
      const img = new Image();
      
      img.onload = () => {
        // Recortar región específica
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        
        tempCanvas.toBlob((blob) => {
          console.log(`✅ Región exportada (${width}x${height}):`, blob?.size, 'bytes');
          resolve(blob || new Blob());
        }, 'image/png');
      };
      
      img.src = mainDataUrl;
    });
  }
  
  // Exportar metadatos del canvas
  public exportMetadata(): any {
    const state = this.getCanvasState();
    return {
      ...state.metadata,
      layers: Array.from(this.layers.entries()).map(([id, layer]) => ({
        id,
        name: layer.config.name,
        type: layer.config.type,
        visible: layer.config.visible,
        objectCount: layer.objects.length
      })),
      textObjects: Array.from(this.textObjects.values())
    };
  }
  
  // MÉTODOS AUXILIARES
  
  private renderAllLayers(): void {
    // Limpiar canvas principal
    this.mainCanvas.clear();
    this.mainCanvas.backgroundColor = '#ffffff';
    
    // Renderizar capas en orden
    const layerOrder = ['base', 'drawing', 'text', 'mask'];
    
    layerOrder.forEach(layerId => {
      const layer = this.layers.get(layerId);
      if (layer && layer.config.visible) {
        layer.objects.forEach(obj => {
          if (!this.mainCanvas.contains(obj)) {
            this.mainCanvas.add(obj);
          }
        });
      }
    });
    
    this.mainCanvas.requestRenderAll();
  }
  
  private updateLayerObjects(): void {
    // Sincronizar objetos del canvas principal con las capas
    const objects = this.mainCanvas.getObjects();
    
    // Actualizar objetos en sus capas correspondientes
    objects.forEach(obj => {
      // Determinar a qué capa pertenece el objeto
      if (obj === this.baseImage) {
        const baseLayer = this.layers.get('base');
        if (baseLayer && !baseLayer.objects.includes(obj)) {
          baseLayer.objects = [obj];
        }
      }
      // Similar para otras capas...
    });
  }
  
  // Método para integración con CanvasManager existente
  public getMainCanvas(): fabric.Canvas {
    return this.mainCanvas;
  }
  
  // Limpiar todo
  public clearAll(): void {
    this.mainCanvas.clear();
    this.layers.forEach(layer => {
      layer.objects = [];
    });
    this.textObjects.clear();
    this.baseImage = null;
    this.mainCanvas.backgroundColor = '#ffffff';
    this.mainCanvas.requestRenderAll();
  }
  
  // Limpiar solo dibujos
  public clearDrawing(): void {
    const drawingLayer = this.layers.get('drawing');
    if (drawingLayer) {
      drawingLayer.objects.forEach(obj => {
        this.mainCanvas.remove(obj);
      });
      drawingLayer.objects = [];
      this.mainCanvas.requestRenderAll();
    }
  }
  
  // Método de limpieza
  public dispose(): void {
    this.layers.forEach(layer => {
      layer.canvas.dispose();
    });
    this.mainCanvas.dispose();
    this.changeListeners.clear();
    this.changeHistory = [];
  }
  
  // ===== SISTEMA DE DETECCIÓN DE CAMBIOS (FASE 1.3) =====
  
  // Registrar listener para cambios
  public onCanvasChange(id: string, callback: (data: CanvasChangeData) => void): void {
    this.changeListeners.set(id, callback);
    console.log(`📡 Listener de cambios registrado: ${id}`);
  }
  
  // Desregistrar listener
  public offCanvasChange(id: string): void {
    this.changeListeners.delete(id);
    console.log(`📡 Listener de cambios desregistrado: ${id}`);
  }
  
  // Emitir evento de cambio
  private emitChange(event: CanvasChangeEvent, details?: any): void {
    const currentState = this.getCanvasState();
    const changeData: CanvasChangeData = {
      event,
      timestamp: new Date(),
      details,
      state: currentState
    };
    
    // Agregar al historial
    this.changeHistory.push(changeData);
    if (this.changeHistory.length > this.maxHistorySize) {
      this.changeHistory.shift(); // Eliminar el más antiguo
    }
    
    // Notificar a todos los listeners
    this.changeListeners.forEach(callback => {
      try {
        callback(changeData);
      } catch (error) {
        console.error('Error en listener de cambios:', error);
      }
    });
    
    console.log(`📢 Evento emitido: ${event}`, details);
    this.lastState = currentState;
  }
  
  // Detectar cambios comparando estados
  public detectChanges(): CanvasChangeEvent[] {
    const currentState = this.getCanvasState();
    const changes: CanvasChangeEvent[] = [];
    
    if (!this.lastState) {
      this.lastState = currentState;
      return changes;
    }
    
    // Detectar cambios en imagen base
    if (currentState.hasBaseImage !== this.lastState.hasBaseImage) {
      changes.push(currentState.hasBaseImage ? 'base-image-added' : 'base-image-removed');
    }
    
    // Detectar cambios en dibujos
    if (currentState.hasDrawing !== this.lastState.hasDrawing) {
      if (currentState.hasDrawing && !this.lastState.hasDrawing) {
        changes.push('drawing-added');
      } else if (!currentState.hasDrawing && this.lastState.hasDrawing) {
        changes.push('drawing-removed');
      }
    }
    
    // Detectar cambios en texto
    if (currentState.hasText !== this.lastState.hasText) {
      if (currentState.hasText && !this.lastState.hasText) {
        changes.push('text-added');
      } else if (!currentState.hasText && this.lastState.hasText) {
        changes.push('text-removed');
      }
    }
    
    // Detectar cambios en máscara
    if (currentState.hasMask !== this.lastState.hasMask) {
      changes.push('mask-added');
    }
    
    this.lastState = currentState;
    return changes;
  }
  
  // Obtener historial de cambios
  public getChangeHistory(): CanvasChangeData[] {
    return [...this.changeHistory];
  }
  
  // Obtener último cambio
  public getLastChange(): CanvasChangeData | null {
    return this.changeHistory.length > 0 
      ? this.changeHistory[this.changeHistory.length - 1]
      : null;
  }
  
  // Verificar si hay cambios sin guardar
  public hasUnsavedChanges(): boolean {
    const currentState = this.getCanvasState();
    return currentState.hasDrawing || currentState.hasText || currentState.hasMask;
  }
  
  // Obtener resumen de cambios
  public getChangeSummary(): {
    totalChanges: number;
    recentChanges: CanvasChangeEvent[];
    hasContent: boolean;
    mode: 'generate' | 'edit';
  } {
    const state = this.getCanvasState();
    const recentChanges = this.changeHistory.slice(-5).map(c => c.event);
    
    return {
      totalChanges: this.changeHistory.length,
      recentChanges,
      hasContent: state.hasBaseImage || state.hasDrawing || state.hasText,
      mode: state.metadata.mode
    };
  }
  
  // Método para análisis inteligente del contenido
  public analyzeContent(): {
    contentType: 'empty' | 'drawing-only' | 'image-only' | 'image-with-edits' | 'complex';
    hasModifications: boolean;
    readyForGeneration: boolean;
    suggestedAction: string;
  } {
    const state = this.getCanvasState();
    
    let contentType: 'empty' | 'drawing-only' | 'image-only' | 'image-with-edits' | 'complex' = 'empty';
    let hasModifications = false;
    let readyForGeneration = false;
    let suggestedAction = '';
    
    // Determinar tipo de contenido
    if (!state.hasBaseImage && !state.hasDrawing && !state.hasText) {
      contentType = 'empty';
      suggestedAction = 'Dibuja algo o carga una imagen para empezar';
    } else if (state.hasDrawing && !state.hasBaseImage) {
      contentType = 'drawing-only';
      readyForGeneration = true;
      suggestedAction = 'Genera una imagen basada en tu dibujo';
    } else if (state.hasBaseImage && !state.hasDrawing && !state.hasText && !state.hasMask) {
      contentType = 'image-only';
      suggestedAction = 'Dibuja modificaciones sobre la imagen o añade texto';
    } else if (state.hasBaseImage && (state.hasDrawing || state.hasText || state.hasMask)) {
      contentType = 'image-with-edits';
      hasModifications = true;
      readyForGeneration = true;
      suggestedAction = 'Genera una nueva versión con tus modificaciones';
    } else {
      contentType = 'complex';
      hasModifications = true;
      readyForGeneration = true;
      suggestedAction = 'Contenido complejo detectado - listo para generar';
    }
    
    return {
      contentType,
      hasModifications,
      readyForGeneration,
      suggestedAction
    };
  }
}