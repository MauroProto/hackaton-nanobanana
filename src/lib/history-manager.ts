/**
 * Sistema de historial con undo/redo para el canvas
 * Gestiona estados del canvas y permite navegación temporal
 */

import { LayeredCanvasManager } from './canvas-layers';

export interface HistoryState {
  id: string;
  timestamp: number;
  description: string;
  thumbnail?: string;
  data: {
    baseImage?: Blob;
    drawingLayer?: Blob;
    textLayer?: Blob;
    maskLayer?: Blob;
    metadata?: any;
  };
}

export class HistoryManager {
  private history: HistoryState[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;
  private canvasManager: LayeredCanvasManager | null = null;
  private isRestoring: boolean = false;
  
  // Callbacks
  private onHistoryChange?: (history: HistoryState[], currentIndex: number) => void;
  private onUndoRedoStateChange?: (canUndo: boolean, canRedo: boolean) => void;
  
  constructor(maxSize: number = 50) {
    this.maxHistorySize = maxSize;
  }
  
  /**
   * Conectar con el canvas manager
   */
  setCanvasManager(manager: LayeredCanvasManager) {
    this.canvasManager = manager;
    
    // Escuchar cambios en el canvas
    manager.addEventListener('content-changed', () => {
      if (!this.isRestoring) {
        this.captureState('Cambio en el canvas');
      }
    });
  }
  
  /**
   * Capturar el estado actual del canvas
   */
  async captureState(description: string = 'Estado guardado'): Promise<void> {
    if (!this.canvasManager) {
      console.warn('No hay canvas manager configurado');
      return;
    }
    
    try {
      // Exportar el estado actual
      const canvasExport = await this.canvasManager.exportForNanoBanana();
      
      // Generar thumbnail (opcional)
      let thumbnail: string | undefined;
      try {
        const fullImage = await this.canvasManager.exportFullImage();
        if (fullImage) {
          thumbnail = await this.createThumbnail(fullImage);
        }
      } catch (error) {
        console.warn('No se pudo generar thumbnail:', error);
      }
      
      // Crear nuevo estado
      const newState: HistoryState = {
        id: `state-${Date.now()}`,
        timestamp: Date.now(),
        description,
        thumbnail,
        data: canvasExport
      };
      
      // Si no estamos al final del historial, eliminar estados posteriores
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
      }
      
      // Añadir nuevo estado
      this.history.push(newState);
      this.currentIndex = this.history.length - 1;
      
      // Limitar tamaño del historial
      if (this.history.length > this.maxHistorySize) {
        const removeCount = this.history.length - this.maxHistorySize;
        this.history = this.history.slice(removeCount);
        this.currentIndex = this.history.length - 1;
      }
      
      // Notificar cambios
      this.notifyChanges();
      
      console.log(`📸 Estado capturado: ${description} (${this.currentIndex + 1}/${this.history.length})`);
      
    } catch (error) {
      console.error('Error capturando estado:', error);
    }
  }
  
  /**
   * Deshacer última acción
   */
  async undo(): Promise<boolean> {
    if (!this.canUndo()) {
      console.warn('No hay acciones para deshacer');
      return false;
    }
    
    try {
      this.currentIndex--;
      await this.restoreState(this.history[this.currentIndex]);
      this.notifyChanges();
      console.log(`↩️ Undo: ${this.history[this.currentIndex].description}`);
      return true;
    } catch (error) {
      console.error('Error en undo:', error);
      this.currentIndex++; // Revertir índice si falla
      return false;
    }
  }
  
  /**
   * Rehacer última acción deshecha
   */
  async redo(): Promise<boolean> {
    if (!this.canRedo()) {
      console.warn('No hay acciones para rehacer');
      return false;
    }
    
    try {
      this.currentIndex++;
      await this.restoreState(this.history[this.currentIndex]);
      this.notifyChanges();
      console.log(`↪️ Redo: ${this.history[this.currentIndex].description}`);
      return true;
    } catch (error) {
      console.error('Error en redo:', error);
      this.currentIndex--; // Revertir índice si falla
      return false;
    }
  }
  
  /**
   * Ir a un estado específico del historial
   */
  async goToState(stateId: string): Promise<boolean> {
    const index = this.history.findIndex(s => s.id === stateId);
    
    if (index === -1) {
      console.warn('Estado no encontrado:', stateId);
      return false;
    }
    
    if (index === this.currentIndex) {
      console.log('Ya estás en ese estado');
      return true;
    }
    
    try {
      this.currentIndex = index;
      await this.restoreState(this.history[index]);
      this.notifyChanges();
      console.log(`🔄 Navegando a: ${this.history[index].description}`);
      return true;
    } catch (error) {
      console.error('Error navegando al estado:', error);
      return false;
    }
  }
  
  /**
   * Restaurar un estado en el canvas
   */
  private async restoreState(state: HistoryState): Promise<void> {
    if (!this.canvasManager) {
      throw new Error('No hay canvas manager configurado');
    }
    
    this.isRestoring = true;
    
    try {
      // Limpiar canvas actual
      this.canvasManager.clear();
      
      // Restaurar imagen base si existe
      if (state.data.baseImage) {
        await this.canvasManager.addImage(state.data.baseImage, 'base');
      }
      
      // Restaurar capa de dibujo si existe
      if (state.data.drawingLayer) {
        await this.canvasManager.loadDrawingLayer(state.data.drawingLayer);
      }
      
      // Restaurar capa de texto si existe
      if (state.data.textLayer) {
        await this.canvasManager.loadTextLayer(state.data.textLayer);
      }
      
      // Restaurar máscara si existe
      if (state.data.maskLayer) {
        await this.canvasManager.loadMaskLayer(state.data.maskLayer);
      }
      
      // Restaurar metadata si existe
      if (state.data.metadata) {
        // Aplicar metadata adicional si es necesario
        console.log('Metadata restaurado:', state.data.metadata);
      }
      
    } finally {
      this.isRestoring = false;
    }
  }
  
  /**
   * Crear thumbnail de una imagen
   */
  private async createThumbnail(imageBlob: Blob, maxSize: number = 100): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('No se pudo crear contexto 2D'));
        return;
      }
      
      img.onload = () => {
        // Calcular dimensiones del thumbnail
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convertir a base64
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      
      img.onerror = () => {
        reject(new Error('Error cargando imagen'));
      };
      
      img.src = URL.createObjectURL(imageBlob);
    });
  }
  
  /**
   * Verificar si se puede deshacer
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }
  
  /**
   * Verificar si se puede rehacer
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
  
  /**
   * Obtener historial actual
   */
  getHistory(): HistoryState[] {
    return [...this.history];
  }
  
  /**
   * Obtener índice actual
   */
  getCurrentIndex(): number {
    return this.currentIndex;
  }
  
  /**
   * Obtener estado actual
   */
  getCurrentState(): HistoryState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }
  
  /**
   * Limpiar todo el historial
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.notifyChanges();
    console.log('🗑️ Historial limpiado');
  }
  
  /**
   * Establecer callback para cambios en el historial
   */
  onHistoryUpdate(callback: (history: HistoryState[], currentIndex: number) => void): void {
    this.onHistoryChange = callback;
  }
  
  /**
   * Establecer callback para cambios en undo/redo
   */
  onUndoRedoUpdate(callback: (canUndo: boolean, canRedo: boolean) => void): void {
    this.onUndoRedoStateChange = callback;
  }
  
  /**
   * Notificar cambios a los listeners
   */
  private notifyChanges(): void {
    if (this.onHistoryChange) {
      this.onHistoryChange(this.getHistory(), this.currentIndex);
    }
    
    if (this.onUndoRedoStateChange) {
      this.onUndoRedoStateChange(this.canUndo(), this.canRedo());
    }
  }
  
  /**
   * Obtener estadísticas del historial
   */
  getStats(): {
    totalStates: number;
    currentPosition: number;
    canUndo: boolean;
    canRedo: boolean;
    oldestState: Date | null;
    newestState: Date | null;
  } {
    return {
      totalStates: this.history.length,
      currentPosition: this.currentIndex + 1,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      oldestState: this.history.length > 0 ? new Date(this.history[0].timestamp) : null,
      newestState: this.history.length > 0 ? new Date(this.history[this.history.length - 1].timestamp) : null
    };
  }
}

// Singleton para gestión global del historial
let globalHistoryManager: HistoryManager | null = null;

export function getHistoryManager(): HistoryManager {
  if (!globalHistoryManager) {
    globalHistoryManager = new HistoryManager();
  }
  return globalHistoryManager;
}

export default HistoryManager;