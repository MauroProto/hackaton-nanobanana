import React, { useState } from 'react';
import * as fabric from 'fabric';
import { useAppStore } from '../store';
import { LayeredCanvasManager } from '../lib/canvas-layers';
import { getVersionManager } from '../lib/version-manager';
import { getHistoryManager } from '../lib/history-manager';
import { useToast, useNanoBananaToasts } from '../hooks/useToast';
import { 
  Edit2, 
  Copy, 
  GitBranch, 
  Clock, 
  Layers,
  MoreVertical,
  Download,
  Trash2
} from 'lucide-react';

const GeneratedImagesGallery: React.FC = () => {
  const generatedImages = useAppStore((state) => state.generatedImages || []);
  const canvasManager = useAppStore((state) => (state as any).canvasManager);
  const fabricCanvas = useAppStore((state) => state.canvas.fabricCanvas);
  const captureCanvasState = useAppStore((state) => state.captureCanvasState);
  
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState<number | null>(null);
  
  const toast = useToast();
  const nanoBananaToast = useNanoBananaToasts();
  
  const handleImageClick = async (imageUrl: string, index: number) => {
    if (!canvasManager && !fabricCanvas) {
      console.error('Canvas no disponible');
      toast.error('Canvas no disponible');
      return;
    }
    
    try {
      // Crear una versión antes de cargar la nueva imagen
      const versionManager = getVersionManager();
      const historyManager = getHistoryManager();
      
      if (canvasManager instanceof LayeredCanvasManager) {
        // Conectar managers si no están conectados
        versionManager.setCanvasManager(canvasManager);
        historyManager.setCanvasManager(canvasManager);
        
        // Crear versión del estado actual antes de cambiar
        const currentState = canvasManager.getCanvasState();
        if (currentState.contentType !== 'empty') {
          await versionManager.createVersion(
            `Antes de cargar imagen ${index + 1}`,
            'Estado guardado antes de cargar nueva imagen'
          );
        }
        
        // Limpiar el canvas actual
        canvasManager.clear();
        
        // Convertir URL a Blob
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // Cargar la imagen como base en el LayeredCanvasManager
        await canvasManager.addImage(blob, 'base');
        
        // Crear nueva versión con la imagen cargada
        await versionManager.createVersion(
          `Imagen ${index + 1} cargada`,
          generatedImages[index]?.prompt || 'Imagen generada cargada para edición'
        );
        
        // Capturar estado para historial
        await historyManager.captureState('Imagen cargada desde galería');
        
        toast.success('Imagen cargada', 'Lista para editar');
        nanoBananaToast.suggestion('Puedes dibujar sobre la imagen para modificarla');
        
      } else if (fabricCanvas) {
        // Fallback con Fabric directamente
        fabricCanvas.clear();
        fabricCanvas.backgroundColor = '#ffffff';
        
        fabric.Image.fromURL(imageUrl).then(img => {
          img.set({
            left: 0,
            top: 0,
            selectable: false,
            evented: false
          });
          fabricCanvas.add(img);
          fabricCanvas.sendToBack(img);
          fabricCanvas.requestRenderAll();
          
          // Capturar estado si está disponible
          if (captureCanvasState) {
            captureCanvasState();
          }
          
          toast.success('Imagen cargada como fondo');
        });
      }
      
      setSelectedImage(index);
    } catch (error) {
      console.error('Error al cargar imagen en canvas:', error);
      toast.error('Error al cargar imagen', error instanceof Error ? error.message : 'Error desconocido');
    }
  };
  
  const handleCreateBranch = async (imageUrl: string, index: number) => {
    try {
      const versionManager = getVersionManager();
      
      // Cargar imagen primero
      await handleImageClick(imageUrl, index);
      
      // Crear rama desde la versión actual
      const currentVersion = versionManager.getCurrentVersion();
      if (currentVersion) {
        await versionManager.createBranch(
          currentVersion.id,
          `Rama desde imagen ${index + 1}`,
          'Nueva línea de edición'
        );
        
        toast.success('Rama creada', 'Puedes editar sin afectar la versión original');
      }
    } catch (error) {
      console.error('Error creando rama:', error);
      toast.error('Error al crear rama');
    }
  };
  
  const handleDownloadImage = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `imagen-generada-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Descargando imagen...');
  };
  
  const handleDeleteImage = (index: number) => {
    // TODO: Implementar eliminación de imagen del store
    toast.warning('Función en desarrollo');
  };
  
  return (
    <div className="w-full bg-gray-50 border-t border-gray-200 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Imágenes Generadas</h3>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <Layers className="h-3 w-3" />
            <span>{generatedImages.length} imágenes</span>
          </div>
        </div>
        
        {generatedImages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No hay imágenes generadas aún. Usa el botón "Generar con Nano Banana" para crear una.
          </p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {generatedImages.map((image, index) => (
              <div
                key={index}
                className="flex-shrink-0 group relative"
              >
                {/* Imagen principal */}
                <div className={`relative ${selectedImage === index ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
                  <img
                    src={image.url}
                    alt={`Generada ${index + 1}`}
                    className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300 hover:border-blue-500 transition-all cursor-pointer"
                    onClick={() => handleImageClick(image.url, index)}
                  />
                  
                  {/* Overlay con opciones */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none" />
                  
                  {/* Botones de acción */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(showMenu === index ? null : index);
                      }}
                      className="p-1 bg-white/90 backdrop-blur rounded-md hover:bg-white transition-colors"
                    >
                      <MoreVertical className="h-4 w-4 text-gray-700" />
                    </button>
                    
                    {/* Menú desplegable */}
                    {showMenu === index && (
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(image.url, index);
                            setShowMenu(null);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>Editar en canvas</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateBranch(image.url, index);
                            setShowMenu(null);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <GitBranch className="h-3 w-3" />
                          <span>Crear rama</span>
                        </button>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadImage(image.url, index);
                            setShowMenu(null);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          <span>Descargar</span>
                        </button>
                        
                        <div className="border-t border-gray-200" />
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(index);
                            setShowMenu(null);
                          }}
                          className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Indicadores en la imagen */}
                  <div className="absolute bottom-2 left-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="px-2 py-1 bg-white/90 backdrop-blur rounded text-xs font-medium text-gray-700">
                      <Edit2 className="h-3 w-3 inline mr-1" />
                      Editar
                    </span>
                  </div>
                </div>
                
                {/* Información de la imagen */}
                <div className="mt-2">
                  <p className="text-xs text-gray-600 truncate max-w-[128px]">
                    {image.prompt || `Imagen ${index + 1}`}
                  </p>
                  {image.timestamp && (
                    <p className="text-xs text-gray-400 flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(image.timestamp).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneratedImagesGallery;