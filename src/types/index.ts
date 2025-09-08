// Tipos principales// Tipos para la aplicación Lienzo + Gemini

// Tipos para configuración de Gemini
export interface GeminiSettings {
  quality: 'standard' | 'high';
  style: string;
  aspectRatio: string;
  negativePrompt?: string;
  seed?: number;
  creativity?: number;
}

export type GeminiPromptType = 'generate' | 'edit' | 'enhance' | 'create' | 'combine';

// Tipos para la integración con Gemini 2.5 Flash Image
export interface GeminiImageRequest {
  mode: 'generate' | 'edit' | 'enhance' | 'create' | 'combine';
  user_prompt: string;
  base_image?: Blob | null;
  mask_image?: Blob | null;
  reference_images?: Blob[];
  edit_strength: number; // 0.0-1.0
  preservation_bias: 'low' | 'med' | 'high';
  character_consistency: 'low' | 'med' | 'high';
  seed?: number | null;
  quality_vs_speed: 'fast' | 'balanced' | 'high';
}

export interface GeminiImageResponse {
  image: Blob; // PNG/WEBP
  brief_note: string;
  success: boolean;
  error?: string;
}

// Tipos para el canvas y capas
export type LayerType = 'base' | 'mask' | 'result' | 'reference';

export interface CanvasLayer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
  data: any; // Datos específicos de Fabric.js
  locked: boolean;
  blendMode?: string;
}

export interface CanvasSettings {
  width: number;
  height: number;
  backgroundColor: string;
  zoom: number;
  panX: number;
  panY: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

// Tipos para herramientas de dibujo
export type DrawingTool = 'brush' | 'eraser' | 'lasso' | 'rectangle' | 'circle' | 'text' | 'move' | 'zoom' | 'select';

export interface BrushSettings {
  size: number;
  color: string;
  opacity: number;
  hardness: number;
  spacing: number;
}

export interface EraserSettings {
  size: number;
  hardness: number;
}

export interface SelectionSettings {
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
}

// Tipos para el historial y versionado
export interface HistoryState {
  id: string;
  timestamp: number;
  description: string;
  canvasData: any; // Datos serializados del canvas
  data?: string; // Datos adicionales
  thumbnail?: string; // Base64 thumbnail
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  canvasState: string;
  description: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  canvas_data: any;
  description: string;
  created_at: Date;
}

// Tipos para proyectos
export interface Project {
  id: string;
  user_id: string;
  name: string;
  canvas_settings: CanvasSettings;
  thumbnail_url?: string;
  current_version: number;
  created_at: Date;
  updated_at: Date;
  lastModified?: Date;
}

// Tipos para el usuario
export interface User {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  created_at: Date;
  updated_at: Date;
}

export interface UserPreferences {
  canvas_size: { width: number; height: number };
  default_brush_size: number;
  auto_save: boolean;
  quality_preference: 'fast' | 'balanced' | 'high';
  theme: 'light' | 'dark';
  shortcuts: Record<string, string>;
  export_format: 'png' | 'jpg' | 'webp';
  show_synthid_warning: boolean;
}

// Tipos para la UI
export interface PanelState {
  leftPanel: {
    visible: boolean;
    width: number;
    collapsed: boolean;
  };
  rightPanel: {
    visible: boolean;
    width: number;
    collapsed: boolean;
  };
  bottomPanel: {
    visible: boolean;
    height: number;
    collapsed: boolean;
  };
}

export interface ToolbarState {
  activeTool: DrawingTool;
  brushSettings: BrushSettings;
  eraserSettings: EraserSettings;
  selectionSettings: SelectionSettings;
}

// Tipo para imagen generada
export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  settings?: GeminiSettings;
}

// Tipos para el estado de la aplicación
export interface AppState {
  currentProject?: Project;
  generatedImages: GeneratedImage[];
  canvas: {
    fabricCanvas?: any; // Fabric.js canvas instance
    settings: CanvasSettings;
    layers: CanvasLayer[];
    activeLayerId?: string;
    history: HistoryState[];
    historyIndex: number;
    isModified: boolean;
    comparisonMode?: boolean;
    comparisonStateA?: any;
    comparisonStateB?: any;
    showingStateA?: boolean;
  };
  ui: {
    panels: PanelState;
    toolbar: ToolbarState;
    loading: boolean;
    error?: string;
  };
  gemini: {
    isGenerating: boolean;
    lastRequest?: GeminiImageRequest;
    lastResponse?: GeminiImageResponse;
    apiKey?: string;
    settings: GeminiSettings;
  };
  user?: User;
}

// Tipos para eventos del canvas
export interface CanvasEvent {
  type: 'object:added' | 'object:removed' | 'object:modified' | 'path:created' | 'selection:created' | 'selection:cleared';
  target?: any;
  e?: Event;
}

// Tipos para la exportación
export interface ExportOptions {
  format: 'png' | 'jpg' | 'webp' | 'svg';
  quality: number; // 0-1 para jpg/webp
  width?: number;
  height?: number;
  includeBackground: boolean;
  includeLayers: string[]; // IDs de capas a incluir
  showSynthIdWarning: boolean;
}

// Tipos para la comparación A/B
export interface ComparisonState {
  enabled: boolean;
  beforeImage: string; // Base64 o URL
  afterImage: string; // Base64 o URL
  sliderPosition: number; // 0-100
  mode: 'slider' | 'side-by-side' | 'overlay';
}

// Tipos para drag and drop
export interface DropZoneFile {
  file: File;
  preview: string;
  type: 'image' | 'project';
  size: number;
  name: string;
}

// Tipos para la galería
export interface GalleryFilter {
  search: string;
  dateRange: {
    start?: Date;
    end?: Date;
  };
  sortBy: 'name' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
  showArchived: boolean;
}

// Tipos para notificaciones
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: {
    label: string;
    action: () => void;
  }[];
}

// Tipos para shortcuts de teclado
export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: string;
  description: string;
}

// Tipos para la configuración de la aplicación
export interface AppConfig {
  gemini: {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxImageSize: number;
    supportedFormats: string[];
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  canvas: {
    maxCanvasSize: number;
    maxLayers: number;
    maxHistoryStates: number;
    autoSaveInterval: number;
  };
  ui: {
    defaultPanelWidths: {
      left: number;
      right: number;
    };
    minPanelWidth: number;
    maxPanelWidth: number;
  };
}