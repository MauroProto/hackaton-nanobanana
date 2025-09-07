import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import * as fabric from 'fabric';
import { useAppStore } from '../store';
import { 
  selectActiveTool, 
  selectBrushSettings, 
  selectCanvasSettings, 
  selectCanvasManager,
  selectToolbarActions,
  selectCanvasActions
} from '../store/selectors';
import { DrawingTool } from '../types';
import { CanvasManager } from '../lib/canvas';

// Utility function for throttling
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

// Debounce utility for performance optimization
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

const CenterPanel: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  const isDrawingRef = useRef(false);
  const lastRenderTime = useRef<number>(0);
  
  // Usar selectores optimizados para evitar re-renders innecesarios
  const activeTool = useAppStore(selectActiveTool);
  const brushSettings = useAppStore(selectBrushSettings);
  const canvasSettings = useAppStore(selectCanvasSettings);
  const canvasManager = useAppStore(selectCanvasManager);
  const setActiveTool = useAppStore(state => state.setActiveTool);
  const setBrushSettings = useAppStore(state => state.setBrushSettings);
  const setCanvasSettings = useAppStore(state => state.setCanvasSettings);
  const setCanvasManager = useAppStore(state => state.setCanvasManager);
  const setCanvas = useAppStore(state => state.setCanvas);
  const captureCanvasState = useAppStore(state => state.captureCanvasState);
  
  const currentTool = activeTool;
  const brushSize = brushSettings.size;
  const brushColor = brushSettings.color;
  const canvasZoom = canvasSettings.zoom;

  // Memoized canvas configuration
  const canvasConfig = useMemo(() => ({
    width: 800,
    height: 600,
    backgroundColor: '#ffffff',
    selection: true,
    preserveObjectStacking: true,
    enableRetinaScaling: true,
    imageSmoothingEnabled: true,
    renderOnAddRemove: false, // Optimize rendering
    skipTargetFind: false,
    perPixelTargetFind: true
  }), []);

  // Throttled render function
  const throttledRender = useCallback(
    throttle(() => {
      if (fabricCanvasRef.current) {
        const now = performance.now();
        if (now - lastRenderTime.current > 16) { // ~60fps
          fabricCanvasRef.current.renderAll();
          lastRenderTime.current = now;
        }
      }
    }, 16),
    []
  );

  // Debounced state capture
  const debouncedCaptureState = useCallback(
    debounce(() => {
      if (!isDrawingRef.current) {
        captureCanvasState();
      }
    }, 300),
    [captureCanvasState]
  );

  // Event handlers moved outside useEffect
  const handlePathCreated = useCallback((e: fabric.TEvent) => {
    isDrawingRef.current = false;
    if (!isDrawingRef.current) {
      captureCanvasState();
    }
  }, [captureCanvasState]);

  const handleObjectModified = useCallback((e: fabric.TEvent) => {
    captureCanvasState();
  }, [captureCanvasState]);

  const handleDrawingStart = useCallback(() => {
    isDrawingRef.current = true;
  }, []);

  const handleDrawingEnd = useCallback(() => {
    isDrawingRef.current = false;
    captureCanvasState();
  }, [captureCanvasState]);

  // Throttled mouse move handler for better performance
  const handleMouseMove = useCallback(
    throttle((e: fabric.TEvent) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;
      
      if ((canvas as any)._currentShape && (currentTool === 'rectangle' || currentTool === 'circle')) {
        const pointer = canvas.getPointer(e.e as MouseEvent);
        const startPointer = (canvas as any)._startPointer;
        const shape = (canvas as any)._currentShape;

        if (currentTool === 'rectangle') {
          const width = Math.abs(pointer.x - startPointer.x);
          const height = Math.abs(pointer.y - startPointer.y);
          
          shape.set({
            width,
            height,
            left: Math.min(startPointer.x, pointer.x),
            top: Math.min(startPointer.y, pointer.y),
          });
        } else {
          const radius = Math.abs(pointer.x - startPointer.x) / 2;
          shape.set({
            radius,
            left: startPointer.x,
            top: startPointer.y,
          });
        }
        
        // Use CanvasManager's optimized render
        if (canvasManagerRef.current) {
          canvasManagerRef.current.forceRender();
        }
      }
    }, 16), // Reduced throttle for smoother drawing
    [currentTool, throttledRender]
  );

  const handleMouseDown = useCallback((e: fabric.TEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'text') {
      // Enable performance mode during drawing
      if (canvasManagerRef.current) {
        canvasManagerRef.current.setPerformanceMode(true);
      }
      
      if (currentTool === 'text') {
        const pointer = canvas.getPointer(e.e as MouseEvent);
        const text = canvasManagerRef.current?.addText('Texto', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Arial',
          fontSize: 20,
          fill: brushColor
        });
        if (text) {
          canvas.setActiveObject(text);
          captureCanvasState();
        }
        return;
      }
      const pointer = canvas.getPointer(e.e as MouseEvent);
      const startX = pointer.x;
      const startY = pointer.y;

      let shape: fabric.Object;
      
      if (currentTool === 'rectangle') {
        shape = canvasManagerRef.current?.addShape('rectangle', {
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: brushColor,
          strokeWidth: 2,
        });
      } else {
        shape = canvasManagerRef.current?.addShape('circle', {
          left: startX,
          top: startY,
          radius: 0,
          fill: 'transparent',
          stroke: brushColor,
          strokeWidth: 2,
        });
      }

      if (shape) {
        canvas.setActiveObject(shape);
        
        // Store reference for mouse move
        (canvas as any)._currentShape = shape;
        (canvas as any)._startPointer = { x: startX, y: startY };
      }
    }
  }, [currentTool, brushColor, captureCanvasState]);

  const handleMouseUp = useCallback((e: fabric.TEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    if ((canvas as any)._currentShape) {
      // Disable performance mode after drawing
      if (canvasManagerRef.current) {
        canvasManagerRef.current.setPerformanceMode(false);
      }
      captureCanvasState();
      (canvas as any)._currentShape = null;
      (canvas as any)._startPointer = null;
    }
  }, [captureCanvasState]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize optimized CanvasManager
    const canvasManager = new CanvasManager(canvasRef.current);
    const canvas = canvasManager.getCanvas();
    
    // Configure canvas
    canvas.setWidth(800);
    canvas.setHeight(600);
    canvas.backgroundColor = '#ffffff';

    fabricCanvasRef.current = canvas;
    canvasManagerRef.current = canvasManager;
    setCanvas(canvas);
    setCanvasManager(canvasManager);

    // Configure canvas based on current tool using CanvasManager
    const updateCanvasMode = () => {
      if (canvasManagerRef.current) {
        canvasManagerRef.current.setDrawingMode(currentTool, {
          brushSize,
          brushColor
        });
      }
    };

    updateCanvasMode();

    // Add simplified event listeners
    canvas.on('path:created', () => {
      console.log('Path created in CenterPanel');
      captureCanvasState();
    });
    
    canvas.on('object:modified', () => {
      captureCanvasState();
    });
    
    // Para herramientas como rectángulos y círculos
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
    
    // Optimize brush performance
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.limitedToCanvasSize = true;
    }

    // Cleanup
    return () => {
      canvas.off(); // Remover todos los eventos
      if (canvasManagerRef.current) {
        canvasManagerRef.current.dispose();
      }
    };
  }, []);

  // Optimized canvas update with memoization and improved brush handling
  const updateCanvasMode = useCallback(() => {
    if (!fabricCanvasRef.current || !canvasManagerRef.current) return;

    const canvas = fabricCanvasRef.current;
    const canvasManager = canvasManagerRef.current;
    
    console.log('Actualizando modo de canvas:', { currentTool, brushSize, brushColor });
    
    // Use CanvasManager for consistent tool configuration
    canvasManager.setDrawingMode(currentTool, {
      brushSize,
      brushColor
    });
    
    // Additional optimizations for brush tools
    if (currentTool === 'brush' || currentTool === 'eraser') {
      // Ensure smooth drawing events
      canvas.freeDrawingCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      
      // Configure for better performance
      if (canvas.freeDrawingBrush) {
        const brush = canvas.freeDrawingBrush as fabric.PencilBrush;
        brush.limitedToCanvasSize = true;
        brush.decimate = 0.4; // Smooth lines
      }
    }
    
    // Configure lasso selection
    if (currentTool === 'lasso') {
      canvas.selectionColor = 'rgba(0, 122, 204, 0.1)';
      canvas.selectionBorderColor = '#007ACC';
      canvas.selectionLineWidth = 2;
    }
    
    // Forzar actualización del canvas después del cambio de modo
    canvas.renderAll();
  }, [currentTool, brushSize, brushColor]);

  useEffect(() => {
    updateCanvasMode();
  }, [updateCanvasMode]);

  // Optimized zoom update
  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    if (Math.abs(canvas.getZoom() - canvasZoom) > 0.001) {
      canvas.setZoom(canvasZoom);
      throttledRender();
    }
  }, [canvasZoom, throttledRender]);

  return (
    <div className="flex-1 bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="border border-gray-300 rounded"
            style={{
              cursor: currentTool === 'move' ? 'move' : 
                     currentTool === 'brush' ? 'crosshair' :
                     currentTool === 'eraser' ? 'crosshair' :
                     currentTool === 'lasso' ? 'crosshair' :
                     currentTool === 'text' ? 'text' :
                     currentTool === 'rectangle' ? 'crosshair' :
                     currentTool === 'circle' ? 'crosshair' :
                     'default'
            }}
          />
          
          {/* Canvas Overlay Info */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            {Math.round(canvasZoom * 100)}% | {currentTool}
          </div>
        </div>
      </div>
    </div>
  );
};

CenterPanel.displayName = 'CenterPanel';

export default CenterPanel;