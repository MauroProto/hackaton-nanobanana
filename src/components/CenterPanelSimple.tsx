import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { CanvasManager } from '../lib/canvas-v6';

const CenterPanelSimple: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasManagerRef = useRef<CanvasManager | null>(null);
  
  // Store selectors
  const activeTool = useAppStore((state) => state.ui.toolbar.activeTool);
  const brushSize = useAppStore((state) => state.ui.toolbar.brushSettings.size);
  const brushColor = useAppStore((state) => state.ui.toolbar.brushSettings.color);
  const canvasZoom = useAppStore((state) => state.canvas.settings.zoom);
  const setCanvas = useAppStore((state) => state.setCanvas);
  const setCanvasManager = useAppStore((state) => state.setCanvasManager);
  const captureCanvasState = useAppStore((state) => state.captureCanvasState);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('Initializing canvas...');
    
    // Create canvas manager
    const manager = new CanvasManager(canvasRef.current);
    canvasManagerRef.current = manager;
    
    // Set up state change callback
    manager.setOnStateChange(() => {
      captureCanvasState();
    });
    
    // Store references
    const fabricCanvas = manager.getCanvas();
    setCanvas(fabricCanvas);
    setCanvasManager(manager);
    
    console.log('Canvas initialized successfully');
    
    // Cleanup
    return () => {
      console.log('Cleaning up canvas...');
      if (canvasManagerRef.current) {
        canvasManagerRef.current.dispose();
      }
    };
  }, []);

  // Update drawing mode when tool changes
  useEffect(() => {
    if (!canvasManagerRef.current) return;
    
    console.log('Updating tool:', activeTool, { brushSize, brushColor });
    
    canvasManagerRef.current.setDrawingMode(activeTool, {
      brushSize,
      brushColor
    });
  }, [activeTool, brushSize, brushColor]);

  // Update zoom
  useEffect(() => {
    if (!canvasManagerRef.current) return;
    
    canvasManagerRef.current.setZoom(canvasZoom);
  }, [canvasZoom]);

  return (
    <div className="flex-1 bg-gray-100 flex items-center justify-center p-2">
      <div className="bg-white rounded-lg shadow-lg p-2 w-full h-full flex items-center justify-center">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={1024}
            height={768}
            className="border-2 border-gray-400 rounded"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          
          {/* Canvas info overlay */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
            1024x768 | {Math.round(canvasZoom * 100)}% | {activeTool}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CenterPanelSimple;