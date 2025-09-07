// CanvasManager optimizado para Fabric.js v6.7.1
import * as fabric from 'fabric';
import { DrawingTool } from '../types';

export class CanvasManager {
  private canvas: fabric.Canvas;
  private isDirty: boolean = false;
  private saveStateTimer: number | null = null;
  private onStateChange?: () => void;

  constructor(canvasElement: HTMLCanvasElement) {
    // Inicializar canvas con Fabric v6
    this.canvas = new fabric.Canvas(canvasElement, {
      width: 800,
      height: 600,
      backgroundColor: '#ffffff',
      isDrawingMode: false,
      selection: true,
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      imageSmoothingEnabled: true
    });

    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // Evento cuando se crea un path (al dibujar)
    this.canvas.on('path:created', () => {
      console.log('Path created');
      this.markDirty();
    });

    // Evento cuando se modifica un objeto
    this.canvas.on('object:modified', () => {
      console.log('Object modified');
      this.markDirty();
    });

    // Evento cuando se añade un objeto
    this.canvas.on('object:added', () => {
      console.log('Object added');
      this.markDirty();
    });
  }

  public setDrawingMode(tool: DrawingTool, options: { brushSize?: number; brushColor?: string } = {}): void {
    console.log('Setting drawing mode:', tool, options);
    
    // Resetear el modo de dibujo
    this.canvas.isDrawingMode = false;
    this.canvas.selection = true;
    
    switch (tool) {
      case 'brush':
        this.canvas.isDrawingMode = true;
        this.canvas.selection = false;
        
        // Crear un nuevo brush para Fabric v6
        const pencilBrush = new fabric.PencilBrush(this.canvas);
        pencilBrush.color = options.brushColor || '#000000';
        pencilBrush.width = options.brushSize || 2;
        
        this.canvas.freeDrawingBrush = pencilBrush;
        this.canvas.defaultCursor = 'crosshair';
        console.log('Brush mode activated');
        break;
        
      case 'eraser':
        this.canvas.isDrawingMode = true;
        this.canvas.selection = false;
        
        // Usar PencilBrush con color blanco para simular borrador
        const eraserBrush = new fabric.PencilBrush(this.canvas);
        eraserBrush.color = '#ffffff';  // Color blanco para borrar
        eraserBrush.width = options.brushSize || 10;
        
        this.canvas.freeDrawingBrush = eraserBrush;
        this.canvas.defaultCursor = 'crosshair';
        console.log('Eraser mode activated');
        break;
        
      case 'select':
      case 'move':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'default';
        console.log('Selection mode activated');
        break;
        
      default:
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        break;
    }
    
    this.canvas.requestRenderAll();
  }

  public async addImage(url: string, options: any = {}): Promise<fabric.Image> {
    return new Promise((resolve, reject) => {
      fabric.Image.fromURL(url).then((img) => {
        // Configurar la imagen
        img.set({
          left: options.left || 100,
          top: options.top || 100,
          scaleX: options.scaleX || 0.5,
          scaleY: options.scaleY || 0.5,
          selectable: true,
          evented: true,
          ...options
        });
        
        // Añadir al canvas
        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.canvas.requestRenderAll();
        
        console.log('Image added to canvas');
        resolve(img);
      }).catch(reject);
    });
  }

  public addShape(type: 'rectangle' | 'circle', options: any = {}): fabric.Object {
    let shape: fabric.Object;
    
    if (type === 'rectangle') {
      shape = new fabric.Rect({
        left: options.left || 100,
        top: options.top || 100,
        width: options.width || 100,
        height: options.height || 100,
        fill: options.fill || 'transparent',
        stroke: options.stroke || '#000000',
        strokeWidth: options.strokeWidth || 2,
        ...options
      });
    } else {
      shape = new fabric.Circle({
        left: options.left || 100,
        top: options.top || 100,
        radius: options.radius || 50,
        fill: options.fill || 'transparent',
        stroke: options.stroke || '#000000',
        strokeWidth: options.strokeWidth || 2,
        ...options
      });
    }
    
    this.canvas.add(shape);
    return shape;
  }

  public addText(text: string, options: any = {}): fabric.Text {
    const textObj = new fabric.Text(text, {
      left: options.left || 100,
      top: options.top || 100,
      fontSize: options.fontSize || 20,
      fontFamily: options.fontFamily || 'Arial',
      fill: options.fill || '#000000',
      ...options
    });
    
    this.canvas.add(textObj);
    return textObj;
  }

  public clearCanvas(): void {
    this.canvas.clear();
    this.canvas.backgroundColor = '#ffffff';
    this.canvas.requestRenderAll();
  }

  public getCanvas(): fabric.Canvas {
    return this.canvas;
  }

  public forceRender(): void {
    this.canvas.requestRenderAll();
  }

  public toJSON(): any {
    return this.canvas.toJSON();
  }

  public async loadFromJSON(json: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.canvas.loadFromJSON(json).then(() => {
        this.canvas.requestRenderAll();
        resolve();
      }).catch(reject);
    });
  }

  public setZoom(zoom: number): void {
    this.canvas.setZoom(zoom);
    this.canvas.requestRenderAll();
  }

  public getZoom(): number {
    return this.canvas.getZoom();
  }

  public async exportCanvas(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const dataUrl = this.canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1
        });
        
        // Convertir dataURL a Blob
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => resolve(blob))
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  public async addImageFromBlob(imageBlob: Blob, layerType?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(imageBlob);
      
      fabric.Image.fromURL(url).then(img => {
        // Ajustar imagen al tamaño del canvas si es muy grande
        const canvasWidth = this.canvas.getWidth();
        const canvasHeight = this.canvas.getHeight();
        
        if (img.width && img.height) {
          const scale = Math.min(
            canvasWidth / img.width,
            canvasHeight / img.height,
            1
          );
          
          img.scale(scale);
          img.set({
            left: (canvasWidth - img.width * scale) / 2,
            top: (canvasHeight - img.height * scale) / 2,
            selectable: true,
            evented: true
          });
        }
        
        this.canvas.add(img);
        this.canvas.setActiveObject(img);
        this.canvas.renderAll();
        URL.revokeObjectURL(url);
        resolve();
      }).catch(error => {
        URL.revokeObjectURL(url);
        reject(error);
      });
    });
  }

  public dispose(): void {
    if (this.saveStateTimer) {
      clearTimeout(this.saveStateTimer);
    }
    this.canvas.dispose();
  }

  private markDirty(): void {
    this.isDirty = true;
    this.debouncedSaveState();
  }

  private debouncedSaveState = (): void => {
    if (this.saveStateTimer) {
      clearTimeout(this.saveStateTimer);
    }
    
    this.saveStateTimer = window.setTimeout(() => {
      if (this.isDirty && this.onStateChange) {
        this.onStateChange();
        this.isDirty = false;
      }
    }, 500);
  };

  public setOnStateChange(callback: () => void): void {
    this.onStateChange = callback;
  }

  public setPerformanceMode(enabled: boolean): void {
    // En Fabric v6, usar requestRenderAll para optimizar
    if (enabled) {
      this.canvas.renderOnAddRemove = false;
    } else {
      this.canvas.renderOnAddRemove = true;
      this.canvas.requestRenderAll();
    }
  }
}