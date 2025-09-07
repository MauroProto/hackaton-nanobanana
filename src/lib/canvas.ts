import * as fabric from 'fabric';
import { ExtendedCanvas } from '../types/fabric';
import { CanvasLayer, DrawingTool, HistoryEntry } from '../types';

// Performance optimization utilities
const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};

/**
 * Utilidades para el manejo del canvas con Fabric.js optimizado para rendimiento
 */
export class CanvasManager {
  private canvas: ExtendedCanvas;
  private layers: Map<string, CanvasLayer> = new Map();
  private history: HistoryEntry[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 50;
  private isDrawing: boolean = false;
  private lastRenderTime: number = 0;
  private renderQueue: Set<string> = new Set();
  private renderRequestId: number | null = null;
  private isDirty = false;
  private performanceMode = false;
  
  // Throttled and debounced methods
  private throttledRender: () => void;
  private debouncedSaveState: () => void;

  // Method to mark canvas as dirty
  private markDirty = () => {
    this.isDirty = true;
    this.throttledRender();
  };

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = new fabric.Canvas(canvasElement, {
      width: 800,
      height: 600,
      enableRetinaScaling: true,
      imageSmoothingEnabled: true,
      preserveObjectStacking: true,
      renderOnAddRemove: false, // Optimize rendering
      skipTargetFind: false,
      perPixelTargetFind: true
    }) as ExtendedCanvas;
    
    // Initialize throttled methods
    this.throttledRender = () => {
      if (this.renderRequestId) {
        cancelAnimationFrame(this.renderRequestId);
      }
      
      this.renderRequestId = requestAnimationFrame(() => {
        const now = performance.now();
        if (this.isDirty && now - this.lastRenderTime > 16) { // ~60fps
          this.canvas.renderAll();
          this.lastRenderTime = now;
          this.isDirty = false;
        }
        this.renderRequestId = null;
      });
    };
    
    // Mark canvas as needing render
    
    this.debouncedSaveState = debounce(() => {
      if (!this.isDrawing) {
        this.saveState();
      }
    }, 300);
    
    this.initializeCanvas();
  }

  private initializeCanvas(): void {
    // Configuración optimizada del canvas
    this.canvas.preserveObjectStacking = true;
    this.canvas.imageSmoothingEnabled = true;
    this.canvas.enableRetinaScaling = true;
    
    // Event handlers básicos para el historial
    this.canvas.on('path:created', () => {
      console.log('Path created - saving state');
      this.debouncedSaveState();
      this.markDirty();
    });
    
    this.canvas.on('object:modified', () => {
      this.debouncedSaveState();
      this.markDirty();
    });
    
    // NO agregar eventos de mouse aquí - Fabric.js los maneja internamente para el dibujo
    // Los eventos de dibujo son manejados automáticamente por isDrawingMode
  }

  /**
   * Configura el modo de dibujo del canvas (optimizado y corregido)
   */
  setDrawingMode(tool: DrawingTool, options: any = {}): void {
    const { brushSize = 5, brushColor = '#000000' } = options;
    
    // Limpiar modo anterior completamente
    this.canvas.isDrawingMode = false;
    this.canvas.selection = true;
    this.canvas.defaultCursor = 'default';
    
    // NO limpiar eventos de mouse aquí porque eso rompe el dibujo
    // Los eventos de mouse para dibujo están en initializeCanvas
    
    switch (tool) {
      case 'brush':
        this.canvas.isDrawingMode = true;
        this.canvas.selection = false;
        this.setupOptimizedBrush(brushSize, brushColor);
        this.canvas.defaultCursor = 'crosshair';
        this.canvas.freeDrawingCursor = 'crosshair';
        this.canvas.hoverCursor = 'crosshair';
        console.log('Modo pincel activado:', { brushSize, brushColor });
        break;
        
      case 'eraser':
        this.canvas.isDrawingMode = true;
        this.canvas.selection = false;
        this.setupOptimizedBrush(brushSize, '#ffffff');
        this.canvas.defaultCursor = 'crosshair';
        this.canvas.freeDrawingCursor = 'crosshair';
        this.canvas.hoverCursor = 'crosshair';
        console.log('Modo borrador activado:', { brushSize });
        break;
        
      case 'select':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'default';
        console.log('Modo selección activado');
        break;
        
      case 'move':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'move';
        console.log('Modo mover activado');
        break;
        
      case 'lasso':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.setupLassoSelection();
        this.canvas.defaultCursor = 'crosshair';
        console.log('Modo lazo activado');
        break;
        
      default:
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'default';
        console.log('Modo por defecto activado');
    }
    
    // Forzar actualización del cursor y renderizado
    this.throttledRender();
  }

  /**
   * Configura un brush optimizado y corregido
   */
  private setupOptimizedBrush(width: number, color: string) {
    // Configuración simple y directa del brush
    const brush = new fabric.PencilBrush(this.canvas);
    brush.width = width;
    brush.color = color;
    brush.limitedToCanvasSize = true;
    
    // Asignar el brush al canvas
    this.canvas.freeDrawingBrush = brush;
    
    console.log('Brush configurado:', { width, color });
  }

  /**
   * Configura la selección con lazo
   */
  private setupLassoSelection(): void {
    let isDrawing = false;
    let lassoPath: fabric.Path | null = null;
    let pathString = '';

    const handleMouseDown = (e: fabric.TEvent) => {
      isDrawing = true;
      const pointer = this.canvas.getPointer(e.e as MouseEvent);
      pathString = `M ${pointer.x} ${pointer.y}`;
    };

    const handleMouseMove = (e: fabric.TEvent) => {
      if (!isDrawing) return;
      
      const pointer = this.canvas.getPointer(e.e as MouseEvent);
      pathString += ` L ${pointer.x} ${pointer.y}`;
      
      if (lassoPath) {
        this.canvas.remove(lassoPath);
      }
      
      lassoPath = new fabric.Path(pathString + ' Z', {
        fill: 'transparent',
        stroke: '#007bff',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false
      });
      
      this.canvas.add(lassoPath);
      this.canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (!isDrawing || !lassoPath) return;
      
      isDrawing = false;
      
      // Seleccionar objetos dentro del lazo
      this.selectObjectsInPath(lassoPath);
      
      // Remover el path del lazo
      this.canvas.remove(lassoPath);
      lassoPath = null;
      pathString = '';
      
      // Limpiar eventos
      this.canvas.off('mouse:down', handleMouseDown);
      this.canvas.off('mouse:move', handleMouseMove);
      this.canvas.off('mouse:up', handleMouseUp);
    };

    this.canvas.on('mouse:down', handleMouseDown);
    this.canvas.on('mouse:move', handleMouseMove);
    this.canvas.on('mouse:up', handleMouseUp);
  }

  /**
   * Selecciona objetos que están dentro de un path
   */
  private selectObjectsInPath(path: fabric.Path): void {
    const objects = this.canvas.getObjects();
    const selectedObjects: fabric.Object[] = [];

    objects.forEach(obj => {
      if (obj === path) return;
      
      const objCenter = obj.getCenterPoint();
      if (this.isPointInPath(objCenter, path)) {
        selectedObjects.push(obj);
      }
    });

    if (selectedObjects.length > 0) {
      const selection = new fabric.ActiveSelection(selectedObjects, {
        canvas: this.canvas
      });
      this.canvas.setActiveObject(selection);
      this.canvas.renderAll();
    }
  }

  /**
   * Verifica si un punto está dentro de un path
   */
  private isPointInPath(point: fabric.Point, path: fabric.Path): boolean {
    // Implementación simplificada - en producción usar algoritmos más precisos
    const pathBounds = path.getBoundingRect();
    return (
      point.x >= pathBounds.left &&
      point.x <= pathBounds.left + pathBounds.width &&
      point.y >= pathBounds.top &&
      point.y <= pathBounds.top + pathBounds.height
    );
  }

  /**
   * Añade una forma geométrica al canvas (optimizado)
   */
  addShape(type: 'rectangle' | 'circle', options: any = {}): fabric.Object {
    const { left = 100, top = 100, fill = 'transparent', stroke = '#000000', strokeWidth = 2 } = options;

    let shape: fabric.Object;

    if (type === 'rectangle') {
      shape = new fabric.Rect({
        left,
        top,
        width: 100,
        height: 100,
        fill,
        stroke,
        strokeWidth,
        // Performance optimizations
        objectCaching: true,
        statefullCache: true
      });
    } else {
      shape = new fabric.Circle({
        left,
        top,
        radius: 50,
        fill,
        stroke,
        strokeWidth,
        // Performance optimizations
        objectCaching: true,
        statefullCache: true
      });
    }

    this.canvas.add(shape);
    this.canvas.setActiveObject(shape);
    this.markDirty();
    
    return shape;
  }

  /**
   * Añade texto al canvas (optimizado)
   */
  addText(text: string = 'Texto', options: any = {}): fabric.Text {
    const { left = 100, top = 100, fontSize = 20, fill = '#000000' } = options;

    const textObj = new fabric.Text(text, {
      left,
      top,
      fontSize,
      fill,
      fontFamily: 'Arial',
      // Performance optimizations
      objectCaching: true,
      statefullCache: true
    });

    this.canvas.add(textObj);
    this.canvas.setActiveObject(textObj);
    this.markDirty();
    this.debouncedSaveState();
    return textObj;
  }

  /**
   * Añade una imagen al canvas (optimizado y corregido)
   */
  addImage(imageElement: HTMLImageElement | string, options: any = {}): Promise<fabric.Image> {
    return new Promise((resolve, reject) => {
      const { left = 100, top = 100, scaleX = 1, scaleY = 1, originX = 'left', originY = 'top' } = options;
      
      const imageUrl = typeof imageElement === 'string' ? imageElement : imageElement.src;
      
      console.log('AddImage llamado con URL:', imageUrl);
      
      // Usar fabric.Image.fromURL con async/await (Fabric v6)
      fabric.Image.fromURL(imageUrl, {
        crossOrigin: 'anonymous'
      }).then((fabricImg) => {
        if (!fabricImg) {
          console.error('Fabric no pudo crear la imagen');
          reject(new Error('Error al crear objeto fabric de la imagen'));
          return;
        }
        
        console.log('Imagen creada por Fabric:', {
          width: fabricImg.width,
          height: fabricImg.height
        });
        
        // Configurar propiedades básicas
        fabricImg.set({
          left: left || 100,
          top: top || 100,
          scaleX: scaleX || 0.5,
          scaleY: scaleY || 0.5,
          originX: originX || 'left',
          originY: originY || 'top',
          selectable: true,
          evented: true
        });
        
        // Posicionamiento especial para bottom
        if (originY === 'bottom' && fabricImg.height) {
          const adjustedTop = top - (fabricImg.height * (scaleY || 0.5));
          fabricImg.set({ top: adjustedTop });
        }
        
        // Añadir al canvas
        this.canvas.add(fabricImg);
        this.canvas.setActiveObject(fabricImg);
        
        // Forzar múltiples renderizados para asegurar visualización
        this.canvas.renderAll();
        requestAnimationFrame(() => {
          this.canvas.renderAll();
          console.log('Imagen renderizada en el canvas');
        });
        
        // Guardar estado
        this.debouncedSaveState();
        
        console.log('Imagen añadida al canvas exitosamente');
        resolve(fabricImg);
      }).catch(error => {
        console.error('Error al cargar imagen con Fabric:', error);
        reject(error);
      });
    });
  }

  /**
   * Manejo optimizado de eventos del canvas - Simplificado
   * Los eventos son manejados directamente en initializeCanvas
   */

  /**
   * Gestión del historial optimizada
   */
  private isUndoRedoOperation: boolean = false;
  private lastSavedState: string = '';
  private saveStateTimeout: NodeJS.Timeout | null = null;

  saveState(): void {
    // Debounce state saving to avoid excessive saves
    if (this.saveStateTimeout) {
      clearTimeout(this.saveStateTimeout);
    }
    
    this.saveStateTimeout = setTimeout(() => {
      this.performSaveState();
    }, 100);
  }
  
  private performSaveState(): void {
    const state = JSON.stringify(this.canvas.toJSON());
    
    // Skip if state hasn't changed
    if (state === this.lastSavedState) {
      return;
    }
    
    this.lastSavedState = state;
    
    // Remover estados futuros si estamos en medio del historial
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    // Añadir nuevo estado
    this.history.push({
      id: Date.now().toString(),
      timestamp: Date.now(),
      canvasState: state,
      description: 'Canvas state'
    });
    
    // Limitar tamaño del historial de manera más eficiente
    if (this.history.length > this.maxHistorySize) {
      this.history.shift(); // Remove first element instead of slicing
      this.historyIndex = this.history.length - 1;
    } else {
      this.historyIndex = this.history.length - 1;
    }
  }

  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.loadStateOptimized(this.history[this.historyIndex].canvasState);
      return true;
    }
    return false;
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.loadStateOptimized(this.history[this.historyIndex].canvasState);
      return true;
    }
    return false;
  }

  private loadState(state: string): void {
    this.isUndoRedoOperation = true;
    
    this.canvas.loadFromJSON(state, () => {
      this.canvas.renderAll();
      this.isUndoRedoOperation = false;
    });
  }
  
  /**
   * Versión optimizada de loadState con mejor rendimiento
   */
  private loadStateOptimized(state: string): void {
    this.isUndoRedoOperation = true;
    
    // Disable rendering during load
    this.canvas.renderOnAddRemove = false;
    
    this.canvas.loadFromJSON(state, () => {
      // Re-enable rendering and render once
      this.canvas.renderOnAddRemove = true;
      this.throttledRender();
      this.isUndoRedoOperation = false;
    });
  }

  /**
   * Gestión optimizada de capas
   */
  createLayer(name: string): CanvasLayer {
    const layer: CanvasLayer = {
      id: Date.now().toString(),
      name,
      visible: true,
      locked: false,
      opacity: 1,
      objects: []
    };
    
    this.layers.set(layer.id, layer);
    return layer;
  }

  deleteLayer(layerId: string): boolean {
    const layer = this.layers.get(layerId);
    if (!layer) return false;
    
    // Disable rendering during batch operations
    this.canvas.renderOnAddRemove = false;
    
    // Remover objetos de la capa del canvas
    layer.objects.forEach(obj => {
      this.canvas.remove(obj);
    });
    
    this.layers.delete(layerId);
    
    // Re-enable rendering and render once
    this.canvas.renderOnAddRemove = true;
    this.throttledRender();
    return true;
  }

  toggleLayerVisibility(layerId: string): boolean {
    const layer = this.layers.get(layerId);
    if (!layer) return false;
    
    layer.visible = !layer.visible;
    
    // Batch visibility updates
    this.canvas.renderOnAddRemove = false;
    
    layer.objects.forEach(obj => {
      obj.visible = layer.visible;
    });
    
    this.canvas.renderOnAddRemove = true;
    this.throttledRender();
    return true;
  }

  /**
   * Exportación
   */
  exportCanvas(format: 'png' | 'jpg' | 'svg' = 'png', quality: number = 1): string {
    switch (format) {
      case 'png':
        return this.canvas.toDataURL({
          format: 'png',
          quality,
          multiplier: 1
        });
      case 'jpg':
        return this.canvas.toDataURL({
          format: 'jpeg',
          quality,
          multiplier: 1
        });
      case 'svg':
        return this.canvas.toSVG();
      default:
        return this.canvas.toDataURL();
    }
  }

  /**
   * Dispose of the canvas and clean up resources
   */
  dispose(): void {
    // Cancel any pending render requests
    if (this.renderRequestId) {
      cancelAnimationFrame(this.renderRequestId);
      this.renderRequestId = null;
    }
    
    // Clear all timers and intervals
    if (this.saveStateTimeout) {
      clearTimeout(this.saveStateTimeout);
    }
    
    this.renderQueue.clear();
    
    if (this.canvas) {
      // Remove all event listeners
      this.canvas.off();
      
      // Clear all objects
      this.canvas.clear();
      
      // Dispose canvas
      this.canvas.dispose();
    }
    
    // Clear data
    this.layers.clear();
    this.history = [];
    
    // Reset state
    this.isDirty = false;
    this.isDrawing = false;
    this.lastRenderTime = 0;
  }
  
  /**
   * Métodos adicionales de optimización
   */
  enablePerformanceMode(): void {
    this.canvas.renderOnAddRemove = false;
    this.canvas.skipTargetFind = true;
    this.canvas.perPixelTargetFind = false;
  }
  
  disablePerformanceMode(): void {
    this.canvas.renderOnAddRemove = true;
    this.canvas.skipTargetFind = false;
    this.canvas.perPixelTargetFind = true;
    this.throttledRender();
  }
  
  /**
   * Fuerza un render inmediato (usar con cuidado)
   */
  forceRender(): void {
    if (this.renderRequestId) {
      cancelAnimationFrame(this.renderRequestId);
      this.renderRequestId = null;
    }
    this.canvas.renderAll();
    this.lastRenderTime = performance.now();
    this.isDirty = false;
  }
  
  /**
   * Enable/disable performance mode
   */
  setPerformanceMode(enabled: boolean): void {
    this.performanceMode = enabled;
    // Disable selection and hover effects in performance mode
    this.canvas.selection = !enabled;
    this.canvas.hoverCursor = enabled ? 'default' : 'move';
    this.canvas.moveCursor = enabled ? 'default' : 'move';
  }
  
  /**
   * Get performance statistics
   */
  getPerformanceStats(): { isDirty: boolean; performanceMode: boolean; historySize: number } {
    return {
      isDirty: this.isDirty,
      performanceMode: this.performanceMode,
      historySize: this.history.length
    };
  }

  /**
   * Getters
   */
  getCanvas(): ExtendedCanvas {
    return this.canvas;
  }

  getLayers(): CanvasLayer[] {
    return Array.from(this.layers.values());
  }

  getHistory(): HistoryEntry[] {
    return this.history;
  }

  canUndo(): boolean {
    return this.historyIndex > 0;
  }

  canRedo(): boolean {
    return this.historyIndex < this.history.length - 1;
  }
}

/**
 * Utilidades adicionales para el canvas
 */
export const CanvasUtils = {
  /**
   * Redimensiona el canvas manteniendo la proporción
   */
  resizeCanvas(canvas: ExtendedCanvas, width: number, height: number): void {
    canvas.setDimensions({ width, height });
    canvas.renderAll();
  },

  /**
   * Centra el canvas en el viewport
   */
  centerCanvas(canvas: ExtendedCanvas): void {
    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    const group = new fabric.Group(objects);
    const groupCenter = group.getCenterPoint();
    const canvasCenter = canvas.getCenter();

    const deltaX = canvasCenter.left - groupCenter.x;
    const deltaY = canvasCenter.top - groupCenter.y;

    objects.forEach(obj => {
      obj.left! += deltaX;
      obj.top! += deltaY;
      obj.setCoords();
    });

    canvas.renderAll();
  },

  /**
   * Ajusta el zoom para mostrar todo el contenido
   */
  zoomToFit(canvas: ExtendedCanvas, padding: number = 50): void {
    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    const group = new fabric.Group(objects);
    const groupBounds = group.getBoundingRect();
    
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    
    const scaleX = (canvasWidth - padding * 2) / groupBounds.width;
    const scaleY = (canvasHeight - padding * 2) / groupBounds.height;
    const scale = Math.min(scaleX, scaleY);
    
    canvas.setZoom(scale);
    canvas.renderAll();
  }
};