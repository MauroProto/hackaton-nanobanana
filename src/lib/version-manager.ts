/**
 * Sistema de versiones y ramificaciones para el canvas
 * Permite gestionar múltiples versiones de un proyecto y crear ramificaciones
 */

import { LayeredCanvasManager } from './canvas-layers';
import { HistoryManager } from './history-manager';

export interface Version {
  id: string;
  parentId?: string;
  timestamp: number;
  name: string;
  description: string;
  thumbnail?: string;
  data: {
    baseImage?: Blob;
    drawingLayer?: Blob;
    textLayer?: Blob;
    maskLayer?: Blob;
    metadata?: any;
  };
  children: string[]; // IDs de versiones hijas
  tags: string[];
  isMainBranch: boolean;
}

export interface VersionTree {
  root: Version;
  versions: Map<string, Version>;
  currentVersionId: string;
}

export class VersionManager {
  private versionTree: VersionTree;
  private canvasManager: LayeredCanvasManager | null = null;
  private historyManager: HistoryManager | null = null;
  private maxVersions: number = 100;
  
  // Callbacks
  private onVersionChange?: (tree: VersionTree) => void;
  private onVersionCreated?: (version: Version) => void;
  
  constructor() {
    // Crear versión raíz inicial
    const rootVersion: Version = {
      id: 'root',
      timestamp: Date.now(),
      name: 'Versión inicial',
      description: 'Canvas vacío',
      data: {},
      children: [],
      tags: ['root'],
      isMainBranch: true
    };
    
    this.versionTree = {
      root: rootVersion,
      versions: new Map([[rootVersion.id, rootVersion]]),
      currentVersionId: rootVersion.id
    };
  }
  
  /**
   * Conectar con el canvas manager
   */
  setCanvasManager(manager: LayeredCanvasManager) {
    this.canvasManager = manager;
  }
  
  /**
   * Conectar con el history manager
   */
  setHistoryManager(manager: HistoryManager) {
    this.historyManager = manager;
  }
  
  /**
   * Crear una nueva versión desde el estado actual
   */
  async createVersion(
    name: string = `Versión ${this.versionTree.versions.size + 1}`,
    description: string = '',
    tags: string[] = []
  ): Promise<Version> {
    if (!this.canvasManager) {
      throw new Error('No hay canvas manager configurado');
    }
    
    // Exportar estado actual del canvas
    const canvasExport = await this.canvasManager.exportForNanoBanana();
    
    // Generar thumbnail
    let thumbnail: string | undefined;
    try {
      const fullImage = await this.canvasManager.exportFullImage();
      if (fullImage) {
        thumbnail = await this.createThumbnail(fullImage);
      }
    } catch (error) {
      console.warn('No se pudo generar thumbnail:', error);
    }
    
    // Crear nueva versión
    const newVersion: Version = {
      id: `v-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      parentId: this.versionTree.currentVersionId,
      timestamp: Date.now(),
      name,
      description,
      thumbnail,
      data: canvasExport,
      children: [],
      tags,
      isMainBranch: this.isMainBranch(this.versionTree.currentVersionId)
    };
    
    // Añadir a la versión padre
    const parentVersion = this.versionTree.versions.get(this.versionTree.currentVersionId);
    if (parentVersion) {
      parentVersion.children.push(newVersion.id);
    }
    
    // Añadir al árbol
    this.versionTree.versions.set(newVersion.id, newVersion);
    this.versionTree.currentVersionId = newVersion.id;
    
    // Limpiar versiones antiguas si es necesario
    this.pruneOldVersions();
    
    // Notificar cambios
    this.notifyChanges();
    if (this.onVersionCreated) {
      this.onVersionCreated(newVersion);
    }
    
    console.log(`📌 Nueva versión creada: ${name}`);
    return newVersion;
  }
  
  /**
   * Crear una ramificación desde una versión específica
   */
  async createBranch(
    fromVersionId: string,
    branchName: string,
    description: string = ''
  ): Promise<Version> {
    const sourceVersion = this.versionTree.versions.get(fromVersionId);
    if (!sourceVersion) {
      throw new Error('Versión de origen no encontrada');
    }
    
    // Cambiar a la versión de origen
    await this.switchToVersion(fromVersionId);
    
    // Crear nueva versión como rama
    const branchVersion = await this.createVersion(
      branchName,
      description || `Rama desde ${sourceVersion.name}`,
      ['branch', `from-${fromVersionId}`]
    );
    
    // Marcar como no parte de la rama principal
    branchVersion.isMainBranch = false;
    
    console.log(`🌿 Nueva rama creada: ${branchName} desde ${sourceVersion.name}`);
    return branchVersion;
  }
  
  /**
   * Cambiar a una versión específica
   */
  async switchToVersion(versionId: string): Promise<boolean> {
    const version = this.versionTree.versions.get(versionId);
    if (!version || !this.canvasManager) {
      console.error('Versión no encontrada o canvas no disponible');
      return false;
    }
    
    try {
      // Limpiar canvas actual
      this.canvasManager.clear();
      
      // Restaurar estado de la versión
      if (version.data.baseImage) {
        await this.canvasManager.addImage(version.data.baseImage, 'base');
      }
      
      if (version.data.drawingLayer) {
        await this.canvasManager.loadDrawingLayer(version.data.drawingLayer);
      }
      
      if (version.data.textLayer) {
        await this.canvasManager.loadTextLayer(version.data.textLayer);
      }
      
      if (version.data.maskLayer) {
        await this.canvasManager.loadMaskLayer(version.data.maskLayer);
      }
      
      // Actualizar versión actual
      this.versionTree.currentVersionId = versionId;
      
      // Notificar cambios
      this.notifyChanges();
      
      console.log(`🔄 Cambiado a versión: ${version.name}`);
      return true;
      
    } catch (error) {
      console.error('Error cambiando de versión:', error);
      return false;
    }
  }
  
  /**
   * Fusionar dos versiones
   */
  async mergeVersions(
    versionId1: string,
    versionId2: string,
    mergeName: string = 'Versión fusionada'
  ): Promise<Version> {
    const v1 = this.versionTree.versions.get(versionId1);
    const v2 = this.versionTree.versions.get(versionId2);
    
    if (!v1 || !v2) {
      throw new Error('Una o ambas versiones no existen');
    }
    
    // Cargar primera versión
    await this.switchToVersion(versionId1);
    
    // TODO: Implementar lógica de fusión más sofisticada
    // Por ahora, simplemente creamos una nueva versión desde v1
    
    const mergedVersion = await this.createVersion(
      mergeName,
      `Fusión de "${v1.name}" y "${v2.name}"`,
      ['merge', `from-${versionId1}`, `from-${versionId2}`]
    );
    
    console.log(`🔀 Versiones fusionadas: ${v1.name} + ${v2.name} = ${mergeName}`);
    return mergedVersion;
  }
  
  /**
   * Obtener el árbol de versiones completo
   */
  getVersionTree(): VersionTree {
    return this.versionTree;
  }
  
  /**
   * Obtener versión actual
   */
  getCurrentVersion(): Version | null {
    return this.versionTree.versions.get(this.versionTree.currentVersionId) || null;
  }
  
  /**
   * Obtener historial lineal desde una versión hasta la raíz
   */
  getLinearHistory(versionId?: string): Version[] {
    const startId = versionId || this.versionTree.currentVersionId;
    const history: Version[] = [];
    let currentId: string | undefined = startId;
    
    while (currentId) {
      const version = this.versionTree.versions.get(currentId);
      if (version) {
        history.push(version);
        currentId = version.parentId;
      } else {
        break;
      }
    }
    
    return history.reverse();
  }
  
  /**
   * Obtener todas las ramas desde una versión
   */
  getBranches(fromVersionId?: string): Version[] {
    const startId = fromVersionId || 'root';
    const branches: Version[] = [];
    
    const collectBranches = (versionId: string) => {
      const version = this.versionTree.versions.get(versionId);
      if (!version) return;
      
      // Si tiene más de un hijo, cada hijo es una rama
      if (version.children.length > 1) {
        version.children.forEach(childId => {
          const child = this.versionTree.versions.get(childId);
          if (child) {
            branches.push(child);
          }
        });
      }
      
      // Recursivamente buscar en los hijos
      version.children.forEach(childId => collectBranches(childId));
    };
    
    collectBranches(startId);
    return branches;
  }
  
  /**
   * Verificar si una versión está en la rama principal
   */
  private isMainBranch(versionId: string): boolean {
    const version = this.versionTree.versions.get(versionId);
    if (!version) return false;
    
    // Recorrer hacia arriba hasta la raíz
    let current = version;
    while (current.parentId) {
      const parent = this.versionTree.versions.get(current.parentId);
      if (!parent) break;
      
      // Si el padre tiene múltiples hijos y este no es el primero, no es rama principal
      if (parent.children.length > 1 && parent.children[0] !== current.id) {
        return false;
      }
      
      current = parent;
    }
    
    return true;
  }
  
  /**
   * Limpiar versiones antiguas para mantener el límite
   */
  private pruneOldVersions() {
    if (this.versionTree.versions.size <= this.maxVersions) return;
    
    // Obtener versiones ordenadas por timestamp
    const versions = Array.from(this.versionTree.versions.values())
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Mantener raíz, versión actual y sus ancestros
    const toKeep = new Set<string>(['root', this.versionTree.currentVersionId]);
    
    // Añadir ancestros de la versión actual
    let currentId = this.versionTree.currentVersionId;
    while (currentId) {
      toKeep.add(currentId);
      const version = this.versionTree.versions.get(currentId);
      if (version?.parentId) {
        currentId = version.parentId;
      } else {
        break;
      }
    }
    
    // Eliminar versiones más antiguas que no están en toKeep
    const toRemove = versions
      .filter(v => !toKeep.has(v.id))
      .slice(0, this.versionTree.versions.size - this.maxVersions);
    
    toRemove.forEach(version => {
      // Actualizar referencias de los padres
      if (version.parentId) {
        const parent = this.versionTree.versions.get(version.parentId);
        if (parent) {
          parent.children = parent.children.filter(id => id !== version.id);
        }
      }
      
      // Eliminar del mapa
      this.versionTree.versions.delete(version.id);
      console.log(`🗑️ Versión eliminada por límite: ${version.name}`);
    });
  }
  
  /**
   * Crear thumbnail de una imagen
   */
  private async createThumbnail(imageBlob: Blob, maxSize: number = 150): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('No se pudo crear contexto 2D'));
        return;
      }
      
      img.onload = () => {
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
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      img.onerror = () => reject(new Error('Error cargando imagen'));
      img.src = URL.createObjectURL(imageBlob);
    });
  }
  
  /**
   * Notificar cambios a los listeners
   */
  private notifyChanges() {
    if (this.onVersionChange) {
      this.onVersionChange(this.versionTree);
    }
  }
  
  /**
   * Establecer callback para cambios
   */
  onVersionUpdate(callback: (tree: VersionTree) => void) {
    this.onVersionChange = callback;
  }
  
  /**
   * Establecer callback para nueva versión
   */
  onVersionCreate(callback: (version: Version) => void) {
    this.onVersionCreated = callback;
  }
  
  /**
   * Exportar árbol de versiones como JSON
   */
  exportTree(): string {
    const exportData = {
      tree: this.versionTree,
      metadata: {
        exportDate: new Date().toISOString(),
        totalVersions: this.versionTree.versions.size
      }
    };
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Importar árbol de versiones desde JSON
   */
  async importTree(jsonData: string): Promise<boolean> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (importData.tree) {
        // Reconstruir el Map de versiones
        const versionsMap = new Map<string, Version>();
        Object.entries(importData.tree.versions).forEach(([key, value]) => {
          versionsMap.set(key, value as Version);
        });
        
        this.versionTree = {
          root: importData.tree.root,
          versions: versionsMap,
          currentVersionId: importData.tree.currentVersionId
        };
        
        this.notifyChanges();
        console.log('✅ Árbol de versiones importado exitosamente');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error importando árbol de versiones:', error);
      return false;
    }
  }
}

// Singleton para gestión global de versiones
let globalVersionManager: VersionManager | null = null;

export function getVersionManager(): VersionManager {
  if (!globalVersionManager) {
    globalVersionManager = new VersionManager();
  }
  return globalVersionManager;
}

export default VersionManager;