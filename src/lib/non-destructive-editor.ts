/**
 * Sistema de Edición No Destructiva
 * Mantiene la imagen original intacta y aplica modificaciones como capas
 */

import { LayeredCanvasManager } from './canvas-layers';
import { VersionManager, Version } from './version-manager';

export interface ModificationLayer {
  id: string;
  name: string;
  type: 'drawing' | 'text' | 'filter' | 'adjustment' | 'mask';
  enabled: boolean;
  opacity: number;
  blendMode: string;
  data: Blob | ImageData | any;
  timestamp: number;
  description: string;
  parentLayerId?: string;
  metadata?: {
    tool?: string;
    color?: string;
    size?: number;
    [key: string]: any;
  };
}

export interface EditSession {
  id: string;
  originalImage: Blob | null;
  modifications: ModificationLayer[];
  activeLayerId: string | null;
  compositeCache?: Blob;
  lastModified: number;
}

export class NonDestructiveEditor {
  private sessions: Map<string, EditSession> = new Map();
  private currentSessionId: string | null = null;
  private canvasManager: LayeredCanvasManager | null = null;
  private versionManager: VersionManager | null = null;
  
  // Callbacks
  private onLayerChange?: (session: EditSession) => void;
  private onSessionChange?: (sessionId: string) => void;
  
  constructor() {
    this.createNewSession();
  }
  
  /**
   * Conectar con el canvas manager
   */
  setCanvasManager(manager: LayeredCanvasManager) {
    this.canvasManager = manager;
  }
  
  /**
   * Conectar con el version manager
   */
  setVersionManager(manager: VersionManager) {
    this.versionManager = manager;
  }
  
  /**
   * Crear una nueva sesión de edición
   */
  createNewSession(originalImage?: Blob): string {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: EditSession = {
      id: sessionId,
      originalImage: originalImage || null,
      modifications: [],
      activeLayerId: null,
      lastModified: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    if (this.onSessionChange) {
      this.onSessionChange(sessionId);
    }
    
    console.log(`📝 Nueva sesión de edición creada: ${sessionId}`);
    return sessionId;
  }
  
  /**
   * Cargar imagen original en la sesión actual
   */
  async loadOriginalImage(image: Blob): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }
    
    // Guardar imagen original
    session.originalImage = image;
    session.lastModified = Date.now();
    
    // Cargar en el canvas si está disponible
    if (this.canvasManager) {
      await this.canvasManager.addImage(image, 'base');
    }
    
    this.notifyLayerChange(session);
    console.log('🖼️ Imagen original cargada en sesión no destructiva');
  }
  
  /**
   * Agregar una nueva capa de modificación
   */
  async addModificationLayer(
    type: ModificationLayer['type'],
    data: Blob | ImageData | any,
    name?: string,
    metadata?: any
  ): Promise<ModificationLayer> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }
    
    const layer: ModificationLayer = {
      id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name || `${type} ${session.modifications.length + 1}`,
      type,
      enabled: true,
      opacity: 100,
      blendMode: 'normal',
      data,
      timestamp: Date.now(),
      description: `Capa de ${type}`,
      metadata
    };
    
    session.modifications.push(layer);
    session.activeLayerId = layer.id;
    session.lastModified = Date.now();
    
    // Invalidar caché
    delete session.compositeCache;
    
    // Aplicar cambios al canvas
    await this.applyModifications();
    
    this.notifyLayerChange(session);
    console.log(`➕ Nueva capa de modificación agregada: ${layer.name}`);
    
    return layer;
  }
  
  /**
   * Activar/desactivar una capa
   */
  toggleLayer(layerId: string, enabled?: boolean): void {
    const session = this.getCurrentSession();
    if (!session) return;
    
    const layer = session.modifications.find(l => l.id === layerId);
    if (layer) {
      layer.enabled = enabled !== undefined ? enabled : !layer.enabled;
      session.lastModified = Date.now();
      delete session.compositeCache;
      
      this.applyModifications();
      this.notifyLayerChange(session);
      
      console.log(`🔄 Capa ${layer.enabled ? 'activada' : 'desactivada'}: ${layer.name}`);
    }
  }
  
  /**
   * Cambiar opacidad de una capa
   */
  setLayerOpacity(layerId: string, opacity: number): void {
    const session = this.getCurrentSession();
    if (!session) return;
    
    const layer = session.modifications.find(l => l.id === layerId);
    if (layer) {
      layer.opacity = Math.max(0, Math.min(100, opacity));
      session.lastModified = Date.now();
      delete session.compositeCache;
      
      this.applyModifications();
      this.notifyLayerChange(session);
    }
  }
  
  /**
   * Cambiar modo de mezcla de una capa
   */
  setLayerBlendMode(layerId: string, blendMode: string): void {
    const session = this.getCurrentSession();
    if (!session) return;
    
    const layer = session.modifications.find(l => l.id === layerId);
    if (layer) {
      layer.blendMode = blendMode;
      session.lastModified = Date.now();
      delete session.compositeCache;
      
      this.applyModifications();
      this.notifyLayerChange(session);
    }
  }
  
  /**
   * Reordenar capas
   */
  reorderLayers(fromIndex: number, toIndex: number): void {
    const session = this.getCurrentSession();
    if (!session) return;
    
    const [removed] = session.modifications.splice(fromIndex, 1);
    session.modifications.splice(toIndex, 0, removed);
    session.lastModified = Date.now();
    delete session.compositeCache;
    
    this.applyModifications();
    this.notifyLayerChange(session);
  }
  
  /**
   * Eliminar una capa
   */
  removeLayer(layerId: string): void {
    const session = this.getCurrentSession();
    if (!session) return;
    
    const index = session.modifications.findIndex(l => l.id === layerId);
    if (index !== -1) {
      const [removed] = session.modifications.splice(index, 1);
      session.lastModified = Date.now();
      delete session.compositeCache;
      
      // Si era la capa activa, seleccionar la anterior
      if (session.activeLayerId === layerId) {
        session.activeLayerId = session.modifications[Math.max(0, index - 1)]?.id || null;
      }
      
      this.applyModifications();
      this.notifyLayerChange(session);
      
      console.log(`🗑️ Capa eliminada: ${removed.name}`);
    }
  }
  
  /**
   * Combinar capas seleccionadas
   */
  async mergeLayers(layerIds: string[], newName?: string): Promise<ModificationLayer | null> {
    const session = this.getCurrentSession();
    if (!session || !this.canvasManager) return null;
    
    const layersToMerge = session.modifications.filter(l => layerIds.includes(l.id));
    if (layersToMerge.length < 2) return null;
    
    // Crear canvas temporal para fusionar
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;
    
    // Configurar tamaño del canvas
    const canvasState = this.canvasManager.getCanvasState();
    tempCanvas.width = 512; // TODO: Obtener tamaño real
    tempCanvas.height = 512;
    
    // Aplicar cada capa en orden
    for (const layer of layersToMerge) {
      if (!layer.enabled) continue;
      
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      
      // Dibujar la capa según su tipo
      if (layer.data instanceof Blob) {
        const img = await this.blobToImage(layer.data);
        ctx.drawImage(img, 0, 0);
      } else if (layer.data instanceof ImageData) {
        ctx.putImageData(layer.data, 0, 0);
      }
    }
    
    // Convertir a blob
    const mergedBlob = await new Promise<Blob>((resolve) => {
      tempCanvas.toBlob((blob) => {
        resolve(blob || new Blob());
      }, 'image/png');
    });
    
    // Eliminar capas originales
    session.modifications = session.modifications.filter(l => !layerIds.includes(l.id));
    
    // Crear nueva capa fusionada
    const mergedLayer = await this.addModificationLayer(
      'drawing',
      mergedBlob,
      newName || `Fusión de ${layersToMerge.length} capas`
    );
    
    console.log(`🔀 ${layersToMerge.length} capas fusionadas en: ${mergedLayer.name}`);
    return mergedLayer;
  }
  
  /**
   * Aplicar modificaciones al canvas
   */
  private async applyModifications(): Promise<void> {
    const session = this.getCurrentSession();
    if (!session || !this.canvasManager) return;
    
    // Limpiar canvas
    this.canvasManager.clear();
    
    // Cargar imagen original si existe
    if (session.originalImage) {
      await this.canvasManager.addImage(session.originalImage, 'base');
    }
    
    // Aplicar cada modificación activa
    for (const layer of session.modifications) {
      if (!layer.enabled) continue;
      
      // Aplicar según el tipo de capa
      switch (layer.type) {
        case 'drawing':
          if (layer.data instanceof Blob) {
            await this.canvasManager.addImage(layer.data, 'drawing');
          }
          break;
          
        case 'text':
          // TODO: Aplicar capa de texto
          break;
          
        case 'mask':
          if (layer.data instanceof Blob) {
            await this.canvasManager.loadMaskLayer(layer.data);
          }
          break;
          
        case 'filter':
        case 'adjustment':
          // TODO: Aplicar filtros y ajustes
          break;
      }
    }
    
    // Actualizar caché de composición
    session.compositeCache = await this.canvasManager.exportFullImage();
  }
  
  /**
   * Exportar composición final
   */
  async exportComposite(format: 'png' | 'jpeg' = 'png', quality: number = 0.95): Promise<Blob> {
    const session = this.getCurrentSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }
    
    // Si hay caché y está actualizado, usarlo
    if (session.compositeCache) {
      return session.compositeCache;
    }
    
    // Generar nueva composición
    await this.applyModifications();
    
    if (!session.compositeCache) {
      throw new Error('No se pudo generar la composición');
    }
    
    return session.compositeCache;
  }
  
  /**
   * Exportar solo las capas activas (sin la imagen original)
   */
  async exportModificationsOnly(): Promise<Blob | null> {
    const session = this.getCurrentSession();
    if (!session || !this.canvasManager) return null;
    
    // Guardar estado actual
    const originalImage = session.originalImage;
    
    // Temporalmente quitar imagen original
    session.originalImage = null;
    
    // Aplicar solo modificaciones
    await this.applyModifications();
    
    // Exportar resultado
    const result = await this.canvasManager.exportFullImage();
    
    // Restaurar imagen original
    session.originalImage = originalImage;
    await this.applyModifications();
    
    return result;
  }
  
  /**
   * Guardar sesión como versión
   */
  async saveAsVersion(name?: string, description?: string): Promise<void> {
    const session = this.getCurrentSession();
    if (!session || !this.versionManager) return;
    
    // Crear versión con el estado actual
    await this.versionManager.createVersion(
      name || `Edición ${new Date().toLocaleTimeString()}`,
      description || `${session.modifications.length} modificaciones aplicadas`
    );
    
    console.log('💾 Sesión guardada como nueva versión');
  }
  
  /**
   * Revertir a la imagen original
   */
  async revertToOriginal(): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;
    
    // Limpiar todas las modificaciones
    session.modifications = [];
    session.activeLayerId = null;
    session.lastModified = Date.now();
    delete session.compositeCache;
    
    // Recargar imagen original
    if (session.originalImage && this.canvasManager) {
      this.canvasManager.clear();
      await this.canvasManager.addImage(session.originalImage, 'base');
    }
    
    this.notifyLayerChange(session);
    console.log('⏪ Revertido a imagen original');
  }
  
  /**
   * Obtener sesión actual
   */
  getCurrentSession(): EditSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }
  
  /**
   * Obtener todas las capas de la sesión actual
   */
  getLayers(): ModificationLayer[] {
    const session = this.getCurrentSession();
    return session ? session.modifications : [];
  }
  
  /**
   * Obtener información de una capa específica
   */
  getLayer(layerId: string): ModificationLayer | null {
    const session = this.getCurrentSession();
    if (!session) return null;
    return session.modifications.find(l => l.id === layerId) || null;
  }
  
  /**
   * Exportar historial de modificaciones
   */
  exportHistory(): any {
    const session = this.getCurrentSession();
    if (!session) return null;
    
    return {
      sessionId: session.id,
      hasOriginal: !!session.originalImage,
      modificationsCount: session.modifications.length,
      lastModified: new Date(session.lastModified).toISOString(),
      layers: session.modifications.map(layer => ({
        id: layer.id,
        name: layer.name,
        type: layer.type,
        enabled: layer.enabled,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        timestamp: new Date(layer.timestamp).toISOString(),
        description: layer.description,
        metadata: layer.metadata
      }))
    };
  }
  
  /**
   * Convertir blob a imagen
   */
  private blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(blob);
    });
  }
  
  /**
   * Notificar cambios en las capas
   */
  private notifyLayerChange(session: EditSession) {
    if (this.onLayerChange) {
      this.onLayerChange(session);
    }
  }
  
  /**
   * Establecer callback para cambios en capas
   */
  onLayersUpdate(callback: (session: EditSession) => void) {
    this.onLayerChange = callback;
  }
  
  /**
   * Establecer callback para cambios de sesión
   */
  onSessionUpdate(callback: (sessionId: string) => void) {
    this.onSessionChange = callback;
  }
}

// Singleton para gestión global
let globalNonDestructiveEditor: NonDestructiveEditor | null = null;

export function getNonDestructiveEditor(): NonDestructiveEditor {
  if (!globalNonDestructiveEditor) {
    globalNonDestructiveEditor = new NonDestructiveEditor();
  }
  return globalNonDestructiveEditor;
}

export default NonDestructiveEditor;