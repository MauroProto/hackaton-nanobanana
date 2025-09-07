// Orquestador de Lienzo para TLDraw + Gemini 2.5 Flash Image
import { Editor, TLShape, TLImageShape, TLTextShape, TLDrawShape, TLGeoShape, TLArrowShape } from 'tldraw';

// Tipos para el orquestador
export interface CanvasOperation {
  target_image_id: string | null;
  mask_png_b64: string | null;
  region_instruction: string;
  preserve_outside_mask: boolean;
  priority: number;
}

export interface ImageInput {
  image_id: string;
  png_b64: string;
  z_index: number;
}

export interface ReferenceImage {
  image_id: string;
  png_b64: string;
  usage: 'style' | 'palette' | 'layout';
}

export interface OrchestrationPlan {
  mode: 'generate' | 'edit' | 'compose';
  model: 'gemini-2.5-flash-image-preview';
  global_prompt: string;
  style_prompts: string[];
  operations: CanvasOperation[];
  inputs: {
    base_images: ImageInput[];
    reference_images: ReferenceImage[];
  };
  generation: {
    count: number;
    width: number;
    height: number;
    seed?: number;
  };
  negative_prompt?: string;
}

// Mapeo de presets de estilo
const STYLE_PRESETS: Record<string, string> = {
  anime_moderno: "2D cel-shading, clean lineart, contornos finos, gradientes suaves, paleta vibrante, iluminación de estudio suave, estilo anime contemporáneo",
  realista: "fotografía, enfoque nítido, profundidad de campo natural, balance de blancos correcto, texturas de piel/materia fieles, grano sutil",
  ultra_realista: "fotografía de alta fidelidad, microdetalles, óptica profesional, bokeh cremoso, sombras físicas, materiales PBR",
  manga_bn: "lineart monocromo, tramados/dither, negros profundos, composición tipo manga",
  pixel_art: "malla de píxel visible, paleta limitada, sin antialias, clusters de píxeles limpios, proporciones chibi opcional",
  line_art: "trazo continuo limpio, alto contraste, sin relleno de color, aspecto técnico/ilustración"
};

export class CanvasOrchestrator {
  private editor: Editor;
  
  constructor(editor: Editor) {
    this.editor = editor;
  }

  // Analizar el lienzo y generar plan de edición
  async analyzeCanvas(selectedStyles: string[] = []): Promise<OrchestrationPlan> {
    const shapes = this.editor.getCurrentPageShapes();
    
    // Clasificar shapes por tipo
    const images = shapes.filter(s => s.type === 'image') as TLImageShape[];
    const texts = shapes.filter(s => s.type === 'text') as TLTextShape[];
    const masks = shapes.filter(s => 
      s.type === 'draw' || 
      s.type === 'geo' || 
      s.type === 'arrow'
    ) as (TLDrawShape | TLGeoShape | TLArrowShape)[];
    
    // Ordenar por z-index (simulado por orden de creación)
    images.sort((a, b) => a.index.localeCompare(b.index));
    
    // Determinar modo de operación
    const mode = this.determineMode(images, masks, texts);
    
    // Generar prompts de estilo
    const stylePrompts = selectedStyles.map(style => STYLE_PRESETS[style]).filter(Boolean);
    
    // Analizar textos para instrucciones
    const { globalPrompt, regionalInstructions } = this.analyzeTexts(texts, masks);
    
    // Generar operaciones basadas en máscaras
    const operations = await this.generateOperations(masks, regionalInstructions, images);
    
    // Preparar imágenes base
    const baseImages = await this.prepareBaseImages(images);
    
    return {
      mode,
      model: 'gemini-2.5-flash-image-preview',
      global_prompt: globalPrompt,
      style_prompts: stylePrompts,
      operations,
      inputs: {
        base_images: baseImages,
        reference_images: []
      },
      generation: {
        count: 1,
        width: 1024,
        height: 1024
      }
    };
  }

  // Determinar modo de operación
  private determineMode(
    images: TLImageShape[], 
    masks: TLShape[], 
    texts: TLTextShape[]
  ): 'generate' | 'edit' | 'compose' {
    if (images.length === 0) {
      return 'generate'; // Sin imágenes, generar desde cero
    }
    if (images.length === 1 && masks.length > 0) {
      return 'edit'; // Una imagen con máscaras = edición
    }
    if (images.length > 1) {
      return 'compose'; // Múltiples imágenes = composición
    }
    return 'edit'; // Por defecto, edición
  }

  // Analizar textos para extraer instrucciones
  private analyzeTexts(texts: TLTextShape[], masks: TLShape[]) {
    let globalPrompt = '';
    const regionalInstructions = new Map<string, string>();
    
    for (const text of texts) {
      const textContent = (text.props as any).text || '';
      if (!textContent) continue;
      
      // Buscar máscara cercana (dentro de 50px)
      const nearbyMask = this.findNearbyMask(text, masks, 50);
      
      if (nearbyMask) {
        // Instrucción regional
        regionalInstructions.set(nearbyMask.id, textContent);
      } else {
        // Instrucción global
        globalPrompt += (globalPrompt ? ' ' : '') + textContent;
      }
    }
    
    return { globalPrompt, regionalInstructions };
  }

  // Encontrar máscara cercana a un texto
  private findNearbyMask(text: TLTextShape, masks: TLShape[], threshold: number): TLShape | null {
    const textBounds = this.editor.getShapePageBounds(text);
    if (!textBounds) return null;
    
    for (const mask of masks) {
      const maskBounds = this.editor.getShapePageBounds(mask);
      if (!maskBounds) continue;
      
      // Calcular distancia entre centros
      const dx = textBounds.center.x - maskBounds.center.x;
      const dy = textBounds.center.y - maskBounds.center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < threshold) {
        return mask;
      }
    }
    
    return null;
  }

  // Generar operaciones basadas en máscaras
  private async generateOperations(
    masks: TLShape[], 
    regionalInstructions: Map<string, string>,
    images: TLImageShape[]
  ): Promise<CanvasOperation[]> {
    const operations: CanvasOperation[] = [];
    
    for (let i = 0; i < masks.length; i++) {
      const mask = masks[i];
      const instruction = regionalInstructions.get(mask.id) || 'editar esta región';
      
      // Generar máscara PNG
      const maskPng = await this.generateMaskPNG(mask);
      
      // Encontrar imagen base más cercana
      const targetImage = this.findTargetImage(mask, images);
      
      operations.push({
        target_image_id: targetImage?.id || null,
        mask_png_b64: maskPng,
        region_instruction: instruction,
        preserve_outside_mask: true,
        priority: i + 1
      });
    }
    
    return operations;
  }

  // Generar PNG de máscara a partir de un shape
  private async generateMaskPNG(shape: TLShape): Promise<string> {
    const bounds = this.editor.getShapePageBounds(shape);
    if (!bounds) return '';
    
    // Crear canvas temporal
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(bounds.width);
    canvas.height = Math.ceil(bounds.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';
    
    // Limpiar canvas (transparente)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar shape como máscara (blanco opaco)
    ctx.fillStyle = 'white';
    
    if (shape.type === 'geo') {
      // Forma geométrica
      const geo = shape as TLGeoShape;
      if (geo.props.geo === 'rectangle') {
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (geo.props.geo === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(
          canvas.width / 2, 
          canvas.height / 2, 
          canvas.width / 2, 
          canvas.height / 2, 
          0, 0, Math.PI * 2
        );
        ctx.fill();
      }
    } else if (shape.type === 'draw') {
      // Trazo libre - simplificado como rectángulo por ahora
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Por defecto, rectángulo
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Convertir a base64
    return canvas.toDataURL('image/png').split(',')[1];
  }

  // Encontrar imagen objetivo para una máscara
  private findTargetImage(mask: TLShape, images: TLImageShape[]): TLImageShape | null {
    const maskBounds = this.editor.getShapePageBounds(mask);
    if (!maskBounds) return null;
    
    // Buscar imagen que contenga o solape con la máscara
    for (const image of images) {
      const imageBounds = this.editor.getShapePageBounds(image);
      if (!imageBounds) continue;
      
      // Verificar solapamiento
      if (this.boundsOverlap(maskBounds, imageBounds)) {
        return image;
      }
    }
    
    return images[0] || null; // Por defecto, primera imagen
  }

  // Verificar si dos bounds se solapan
  private boundsOverlap(a: any, b: any): boolean {
    return !(
      a.maxX < b.minX ||
      a.minX > b.maxX ||
      a.maxY < b.minY ||
      a.minY > b.maxY
    );
  }

  // Preparar imágenes base
  private async prepareBaseImages(images: TLImageShape[]): Promise<ImageInput[]> {
    const baseImages: ImageInput[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const assetId = image.props.assetId;
      
      if (!assetId) continue;
      
      // Obtener asset del store
      const asset = this.editor.getAsset(assetId);
      if (!asset || asset.type !== 'image') continue;
      
      // Extraer base64 del src
      const src = asset.props.src;
      let base64 = '';
      
      if (src.startsWith('data:image')) {
        base64 = src.split(',')[1] || '';
      } else {
        // Si es URL, intentar convertir (requeriría fetch)
        console.warn('URL images not yet supported for base images');
        continue;
      }
      
      baseImages.push({
        image_id: image.id,
        png_b64: base64,
        z_index: i
      });
    }
    
    return baseImages;
  }

  // Método principal para orquestar el lienzo
  async orchestrate(options: {
    selectedStyles?: string[];
    additionalPrompt?: string;
    negativePrompt?: string;
    seed?: number;
  } = {}): Promise<OrchestrationPlan> {
    const plan = await this.analyzeCanvas(options.selectedStyles || []);
    
    // Agregar prompt adicional si existe
    if (options.additionalPrompt) {
      plan.global_prompt = plan.global_prompt 
        ? `${plan.global_prompt}. ${options.additionalPrompt}`
        : options.additionalPrompt;
    }
    
    // Agregar negative prompt si existe
    if (options.negativePrompt) {
      plan.negative_prompt = options.negativePrompt;
    }
    
    // Agregar seed si existe
    if (options.seed !== undefined) {
      plan.generation.seed = options.seed;
    }
    
    return plan;
  }
}

// Función helper para crear orquestador
export function createCanvasOrchestrator(editor: Editor): CanvasOrchestrator {
  return new CanvasOrchestrator(editor);
}