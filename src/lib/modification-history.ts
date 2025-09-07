/**
 * Sistema de Historial de Modificaciones Detallado
 * Registra y describe automáticamente cada cambio realizado
 */

import { NonDestructiveEditor, ModificationLayer } from './non-destructive-editor';
import { LayeredCanvasManager } from './canvas-layers';

export interface ModificationEntry {
  id: string;
  timestamp: number;
  type: 'add' | 'remove' | 'modify' | 'reorder' | 'merge' | 'revert';
  action: string;
  description: string;
  details: {
    layerId?: string;
    layerName?: string;
    layerType?: string;
    previousState?: any;
    newState?: any;
    affectedLayers?: string[];
    tool?: string;
    parameters?: any;
  };
  canUndo: boolean;
  undoData?: any;
}

export interface ModificationSnapshot {
  id: string;
  timestamp: number;
  layers: ModificationLayer[];
  activeLayerId: string | null;
  description: string;
}

export class ModificationHistory {
  private history: ModificationEntry[] = [];
  private snapshots: Map<string, ModificationSnapshot> = new Map();
  private currentIndex: number = -1;
  private maxHistorySize: number = 200;
  private nonDestructiveEditor: NonDestructiveEditor | null = null;
  private canvasManager: LayeredCanvasManager | null = null;
  
  // Callbacks
  private onHistoryChange?: (history: ModificationEntry[]) => void;
  private onSnapshotCreate?: (snapshot: ModificationSnapshot) => void;
  
  constructor() {
    this.initializeHistory();
  }
  
  /**
   * Conectar con el editor no destructivo
   */
  setNonDestructiveEditor(editor: NonDestructiveEditor) {
    this.nonDestructiveEditor = editor;
    this.setupEditorListeners();
  }
  
  /**
   * Conectar con el canvas manager
   */
  setCanvasManager(manager: LayeredCanvasManager) {
    this.canvasManager = manager;
    this.setupCanvasListeners();
  }
  
  /**
   * Configurar listeners del editor
   */
  private setupEditorListeners() {
    if (!this.nonDestructiveEditor) return;
    
    // Escuchar cambios en las capas
    this.nonDestructiveEditor.onLayersUpdate((session) => {
      // Auto-registrar cambios
      this.autoDetectChanges(session);
    });
  }
  
  /**
   * Configurar listeners del canvas
   */
  private setupCanvasListeners() {
    if (!this.canvasManager) return;
    
    // Escuchar eventos del canvas
    this.canvasManager.addEventListener('drawing-added', (event) => {
      this.recordDrawing(event.detail);
    });
    
    this.canvasManager.addEventListener('text-added', (event) => {
      this.recordTextAdded(event.detail);
    });
    
    this.canvasManager.addEventListener('base-image-added', (event) => {
      this.recordImageLoaded(event.detail);
    });
  }
  
  /**
   * Inicializar historial
   */
  private initializeHistory() {
    const initialEntry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'add',
      action: 'initialize',
      description: 'Historial inicializado',
      details: {},
      canUndo: false
    };
    
    this.history.push(initialEntry);
    this.currentIndex = 0;
  }
  
  /**
   * Registrar dibujo agregado
   */
  recordDrawing(details: any) {
    const entry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'add',
      action: 'drawing_added',
      description: this.generateDrawingDescription(details),
      details: {
        tool: details.tool || 'brush',
        parameters: {
          color: details.color,
          size: details.size,
          opacity: details.opacity
        }
      },
      canUndo: true,
      undoData: details.layerId
    };
    
    this.addEntry(entry);
  }
  
  /**
   * Registrar texto agregado
   */
  recordTextAdded(details: any) {
    const entry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'add',
      action: 'text_added',
      description: `Texto agregado: "${details.text?.substring(0, 30)}..."`,
      details: {
        layerType: 'text',
        parameters: {
          text: details.text,
          font: details.font,
          size: details.fontSize,
          color: details.color
        }
      },
      canUndo: true,
      undoData: details.layerId
    };
    
    this.addEntry(entry);
  }
  
  /**
   * Registrar imagen cargada
   */
  recordImageLoaded(details: any) {
    const entry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'add',
      action: 'image_loaded',
      description: 'Imagen base cargada',
      details: {
        layerType: 'base',
        parameters: {
          source: details.source || 'upload'
        }
      },
      canUndo: true
    };
    
    this.addEntry(entry);
  }
  
  /**
   * Registrar modificación de capa
   */
  recordLayerModified(layer: ModificationLayer, changeType: string, previousState?: any) {
    const entry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'modify',
      action: `layer_${changeType}`,
      description: this.generateModificationDescription(layer, changeType),
      details: {
        layerId: layer.id,
        layerName: layer.name,
        layerType: layer.type,
        previousState,
        newState: {
          enabled: layer.enabled,
          opacity: layer.opacity,
          blendMode: layer.blendMode
        }
      },
      canUndo: true,
      undoData: { layerId: layer.id, previousState }
    };
    
    this.addEntry(entry);
  }
  
  /**
   * Registrar capas fusionadas
   */
  recordLayersMerged(mergedLayers: string[], resultLayer: ModificationLayer) {
    const entry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'merge',
      action: 'layers_merged',
      description: `${mergedLayers.length} capas fusionadas en "${resultLayer.name}"`,
      details: {
        affectedLayers: mergedLayers,
        layerId: resultLayer.id,
        layerName: resultLayer.name
      },
      canUndo: true,
      undoData: { mergedLayers, resultId: resultLayer.id }
    };
    
    this.addEntry(entry);
  }
  
  /**
   * Registrar reversión a original
   */
  recordRevertToOriginal() {
    const entry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'revert',
      action: 'revert_to_original',
      description: 'Revertido a imagen original',
      details: {},
      canUndo: false
    };
    
    this.addEntry(entry);
  }
  
  /**
   * Generar descripción automática de dibujo
   */
  private generateDrawingDescription(details: any): string {
    const tool = details.tool || 'pincel';
    const color = details.color || 'negro';
    const size = details.size || 'mediano';
    
    const descriptions = [
      `Trazo con ${tool} ${color}`,
      `Dibujo agregado con ${tool}`,
      `Nueva capa de dibujo (${tool})`,
      `Trazo de ${size}px en ${color}`
    ];
    
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }
  
  /**
   * Generar descripción automática de modificación
   */
  private generateModificationDescription(layer: ModificationLayer, changeType: string): string {
    switch (changeType) {
      case 'opacity':
        return `Opacidad de "${layer.name}" cambiada a ${layer.opacity}%`;
      case 'blend':
        return `Modo de fusión de "${layer.name}" cambiado a ${layer.blendMode}`;
      case 'toggle':
        return `Capa "${layer.name}" ${layer.enabled ? 'activada' : 'desactivada'}`;
      case 'reorder':
        return `Capa "${layer.name}" reordenada`;
      default:
        return `Capa "${layer.name}" modificada`;
    }
  }
  
  /**
   * Auto-detectar cambios en las capas
   */
  private autoDetectChanges(session: any) {
    // Comparar con snapshot anterior para detectar cambios
    const lastSnapshot = Array.from(this.snapshots.values()).pop();
    
    if (lastSnapshot) {
      // Detectar nuevas capas
      const newLayers = session.modifications.filter((layer: ModificationLayer) => 
        !lastSnapshot.layers.find(l => l.id === layer.id)
      );
      
      // Detectar capas eliminadas
      const removedLayers = lastSnapshot.layers.filter(layer => 
        !session.modifications.find((l: ModificationLayer) => l.id === layer.id)
      );
      
      // Registrar cambios detectados
      newLayers.forEach((layer: ModificationLayer) => {
        this.recordLayerModified(layer, 'added');
      });
      
      removedLayers.forEach(layer => {
        const entry: ModificationEntry = {
          id: `entry-${Date.now()}`,
          timestamp: Date.now(),
          type: 'remove',
          action: 'layer_removed',
          description: `Capa "${layer.name}" eliminada`,
          details: {
            layerId: layer.id,
            layerName: layer.name,
            layerType: layer.type
          },
          canUndo: true,
          undoData: layer
        };
        this.addEntry(entry);
      });
    }
  }
  
  /**
   * Agregar entrada al historial
   */
  private addEntry(entry: ModificationEntry) {
    // Si estamos en medio del historial, eliminar entradas posteriores
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }
    
    // Agregar nueva entrada
    this.history.push(entry);
    this.currentIndex++;
    
    // Limitar tamaño del historial
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
    
    // Notificar cambios
    if (this.onHistoryChange) {
      this.onHistoryChange(this.history);
    }
    
    console.log(`📝 ${entry.description}`);
  }
  
  /**
   * Crear snapshot del estado actual
   */
  createSnapshot(description?: string): ModificationSnapshot {
    if (!this.nonDestructiveEditor) {
      throw new Error('Editor no destructivo no configurado');
    }
    
    const session = this.nonDestructiveEditor.getCurrentSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }
    
    const snapshot: ModificationSnapshot = {
      id: `snapshot-${Date.now()}`,
      timestamp: Date.now(),
      layers: [...session.modifications],
      activeLayerId: session.activeLayerId,
      description: description || `Snapshot ${this.snapshots.size + 1}`
    };
    
    this.snapshots.set(snapshot.id, snapshot);
    
    if (this.onSnapshotCreate) {
      this.onSnapshotCreate(snapshot);
    }
    
    console.log(`📸 Snapshot creado: ${snapshot.description}`);
    return snapshot;
  }
  
  /**
   * Restaurar desde snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot || !this.nonDestructiveEditor) return false;
    
    // Crear nueva sesión con las capas del snapshot
    const session = this.nonDestructiveEditor.getCurrentSession();
    if (!session) return false;
    
    // Reemplazar modificaciones con las del snapshot
    session.modifications = [...snapshot.layers];
    session.activeLayerId = snapshot.activeLayerId;
    
    // Registrar la restauración
    const entry: ModificationEntry = {
      id: `entry-${Date.now()}`,
      timestamp: Date.now(),
      type: 'revert',
      action: 'snapshot_restored',
      description: `Restaurado desde: ${snapshot.description}`,
      details: {
        snapshotId
      },
      canUndo: false
    };
    
    this.addEntry(entry);
    
    console.log(`♻️ Restaurado desde snapshot: ${snapshot.description}`);
    return true;
  }
  
  /**
   * Deshacer última acción
   */
  async undo(): Promise<boolean> {
    if (this.currentIndex <= 0) return false;
    
    const entry = this.history[this.currentIndex];
    if (!entry.canUndo) return false;
    
    // Implementar lógica de deshacer según el tipo
    if (entry.undoData && this.nonDestructiveEditor) {
      switch (entry.type) {
        case 'add':
          // Eliminar la capa agregada
          if (entry.undoData) {
            this.nonDestructiveEditor.removeLayer(entry.undoData);
          }
          break;
          
        case 'remove':
          // Restaurar la capa eliminada
          // TODO: Implementar restauración
          break;
          
        case 'modify':
          // Restaurar estado anterior
          // TODO: Implementar restauración de estado
          break;
      }
    }
    
    this.currentIndex--;
    console.log(`↩️ Deshecho: ${entry.description}`);
    return true;
  }
  
  /**
   * Rehacer acción
   */
  async redo(): Promise<boolean> {
    if (this.currentIndex >= this.history.length - 1) return false;
    
    this.currentIndex++;
    const entry = this.history[this.currentIndex];
    
    // TODO: Implementar lógica de rehacer
    
    console.log(`↪️ Rehecho: ${entry.description}`);
    return true;
  }
  
  /**
   * Obtener historial completo
   */
  getHistory(): ModificationEntry[] {
    return this.history;
  }
  
  /**
   * Obtener historial reciente
   */
  getRecentHistory(count: number = 10): ModificationEntry[] {
    return this.history.slice(-count);
  }
  
  /**
   * Exportar historial completo
   */
  exportHistory(): any {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      totalEntries: this.history.length,
      currentIndex: this.currentIndex,
      entries: this.history.map(entry => ({
        id: entry.id,
        timestamp: new Date(entry.timestamp).toISOString(),
        type: entry.type,
        action: entry.action,
        description: entry.description,
        details: entry.details
      })),
      snapshots: Array.from(this.snapshots.values()).map(snapshot => ({
        id: snapshot.id,
        timestamp: new Date(snapshot.timestamp).toISOString(),
        description: snapshot.description,
        layersCount: snapshot.layers.length
      }))
    };
  }
  
  /**
   * Generar resumen del historial
   */
  generateSummary(): string {
    const actionCounts: Record<string, number> = {};
    
    this.history.forEach(entry => {
      actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    });
    
    const summary = [
      `📊 Resumen del Historial`,
      `Total de acciones: ${this.history.length}`,
      `Snapshots guardados: ${this.snapshots.size}`,
      '',
      'Acciones realizadas:'
    ];
    
    Object.entries(actionCounts).forEach(([action, count]) => {
      const actionName = action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      summary.push(`• ${actionName}: ${count}`);
    });
    
    return summary.join('\n');
  }
  
  /**
   * Limpiar historial
   */
  clearHistory() {
    this.history = [];
    this.snapshots.clear();
    this.currentIndex = -1;
    this.initializeHistory();
    console.log('🗑️ Historial limpiado');
  }
  
  /**
   * Establecer callback para cambios en el historial
   */
  onHistoryUpdate(callback: (history: ModificationEntry[]) => void) {
    this.onHistoryChange = callback;
  }
  
  /**
   * Establecer callback para creación de snapshots
   */
  onSnapshotCreated(callback: (snapshot: ModificationSnapshot) => void) {
    this.onSnapshotCreate = callback;
  }
}

// Singleton para gestión global
let globalModificationHistory: ModificationHistory | null = null;

export function getModificationHistory(): ModificationHistory {
  if (!globalModificationHistory) {
    globalModificationHistory = new ModificationHistory();
  }
  return globalModificationHistory;
}

export default ModificationHistory;