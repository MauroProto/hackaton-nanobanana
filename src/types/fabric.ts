// Tipos específicos para Fabric.js y canvas
import * as fabric from 'fabric';

// Extensiones de tipos de Fabric.js
export interface ExtendedCanvas extends fabric.Canvas {
  _historyStep: number;
  _historyProcessing: boolean;
  _historyUndo: any[];
  _historyRedo: any[];
  _historyNext: () => void;
  _historySaveAction: () => void;
  _historyInit: () => void;
}

// Tipos para objetos personalizados del canvas
export interface CanvasObject extends fabric.Object {
  id?: string;
  layerId?: string;
  isTemporary?: boolean;
  metadata?: {
    createdBy: 'user' | 'ai';
    timestamp: Date;
    prompt?: string;
    aiModel?: string;
  };
}

// Tipos para máscaras
export interface MaskObject extends fabric.Object {
  isMask: true;
  maskType: 'additive' | 'subtractive';
  opacity: number;
  blendMode: 'source-over' | 'source-atop' | 'multiply' | 'screen';
}

// Tipos para selecciones
export interface SelectionArea {
  x: number;
  y: number;
  width: number;
  height: number;
  points?: { x: number; y: number }[]; // Para selecciones de lazo
  type: 'rectangle' | 'lasso' | 'ellipse';
}

// Tipos para herramientas de dibujo personalizadas
export interface CustomBrush extends fabric.BaseBrush {
  hardness: number;
  spacing: number;
  texture?: string;
  pressureSensitive: boolean;
}

// Tipos para filtros y efectos
export interface CanvasFilter {
  type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'hue' | 'noise' | 'pixelate';
  value: number;
  enabled: boolean;
}

// Tipos para animaciones
export interface CanvasAnimation {
  id: string;
  target: fabric.Object;
  property: string;
  from: any;
  to: any;
  duration: number;
  easing: string;
  onComplete?: () => void;
}

// Tipos para eventos personalizados del canvas
export interface CustomCanvasEvent {
  type: 'layer:added' | 'layer:removed' | 'layer:modified' | 'mask:created' | 'mask:applied' | 'ai:generated';
  data: any;
  timestamp: Date;
}

// Tipos para la serialización del canvas
export interface SerializedCanvas {
  version: string;
  objects: any[];
  background: string | fabric.Pattern | fabric.Gradient;
  backgroundImage?: any;
  overlayImage?: any;
  width: number;
  height: number;
  layers: SerializedLayer[];
  metadata: {
    createdAt: Date;
    modifiedAt: Date;
    appVersion: string;
    canvasVersion: string;
  };
}

export interface SerializedLayer {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
  objects: any[];
  filters: CanvasFilter[];
  blendMode: string;
  locked: boolean;
}

// Tipos para herramientas de transformación
export interface TransformTool {
  type: 'move' | 'rotate' | 'scale' | 'skew' | 'flip';
  cursor: string;
  icon: string;
  shortcut: string;
}

// Tipos para guías y rejilla
export interface GridSettings {
  enabled: boolean;
  size: number;
  color: string;
  opacity: number;
  snapToGrid: boolean;
  snapThreshold: number;
}

export interface GuideSettings {
  enabled: boolean;
  color: string;
  opacity: number;
  snapToGuides: boolean;
  snapThreshold: number;
  magneticGuides: boolean;
}

// Tipos para el zoom y navegación
export interface ViewportState {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  panX: number;
  panY: number;
  centerX: number;
  centerY: number;
  viewportTransform: number[];
}

// Tipos para la selección múltiple
export interface MultiSelection {
  objects: fabric.Object[];
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  center: {
    x: number;
    y: number;
  };
}

// Tipos para patrones y texturas
export interface PatternSettings {
  type: 'image' | 'gradient' | 'noise';
  source?: string | HTMLImageElement | HTMLCanvasElement;
  repeat: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';
  offsetX: number;
  offsetY: number;
  patternTransform?: number[];
}

// Tipos para gradientes
export interface GradientSettings {
  type: 'linear' | 'radial';
  coords: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    r1?: number; // Para gradientes radiales
    r2?: number; // Para gradientes radiales
  };
  colorStops: {
    offset: number;
    color: string;
    opacity?: number;
  }[];
}

// Tipos para la gestión de memoria del canvas
export interface CanvasMemoryInfo {
  objectCount: number;
  imageCount: number;
  totalMemoryUsage: number; // en bytes
  canvasSize: number; // en bytes
  historySize: number; // en bytes
  cacheSize: number; // en bytes
}

// Tipos para la optimización del rendimiento
export interface PerformanceSettings {
  enableCaching: boolean;
  maxCacheSize: number;
  renderOnAddRemove: boolean;
  stateful: boolean;
  skipTargetFind: boolean;
  perPixelTargetFind: boolean;
  enableRetinaScaling: boolean;
}

// Tipos para exportación específica del canvas
export interface CanvasExportOptions {
  format: 'png' | 'jpeg' | 'svg' | 'pdf';
  quality: number;
  multiplier: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  withoutTransform?: boolean;
  withoutShadow?: boolean;
  enableRetinaScaling?: boolean;
}