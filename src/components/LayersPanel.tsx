import React, { useState, useEffect } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  Trash2,
  MoreVertical,
  Plus,
  Merge,
  Image,
  Type,
  Brush,
  Filter,
  Sliders,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  RotateCcw
} from 'lucide-react';
import { getNonDestructiveEditor, ModificationLayer, EditSession } from '../lib/non-destructive-editor';
import { useToast } from '../hooks/useToast';

interface LayerItemProps {
  layer: ModificationLayer;
  isActive: boolean;
  onToggle: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onSelect: (layerId: string) => void;
  onOpacityChange: (layerId: string, opacity: number) => void;
  onBlendModeChange: (layerId: string, blendMode: string) => void;
}

const LayerItem: React.FC<LayerItemProps> = ({
  layer,
  isActive,
  onToggle,
  onDelete,
  onSelect,
  onOpacityChange,
  onBlendModeChange
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showOpacity, setShowOpacity] = useState(false);
  
  const getLayerIcon = () => {
    switch (layer.type) {
      case 'drawing': return <Brush className="h-3 w-3" />;
      case 'text': return <Type className="h-3 w-3" />;
      case 'filter': return <Filter className="h-3 w-3" />;
      case 'adjustment': return <Sliders className="h-3 w-3" />;
      case 'mask': return <Image className="h-3 w-3" />;
      default: return <Layers className="h-3 w-3" />;
    }
  };
  
  const blendModes = [
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'
  ];
  
  return (
    <div className={`
      group relative border rounded-lg p-2 mb-2 transition-all
      ${isActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
    `}>
      <div className="flex items-center space-x-2">
        {/* Visibility Toggle */}
        <button
          onClick={() => onToggle(layer.id)}
          className="p-1 hover:bg-gray-100 rounded"
          title={layer.enabled ? 'Ocultar capa' : 'Mostrar capa'}
        >
          {layer.enabled ? (
            <Eye className="h-4 w-4 text-gray-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-400" />
          )}
        </button>
        
        {/* Layer Icon & Name */}
        <div 
          className="flex-1 flex items-center space-x-2 cursor-pointer"
          onClick={() => onSelect(layer.id)}
        >
          <div className={`p-1 rounded ${
            layer.type === 'drawing' ? 'bg-blue-100' :
            layer.type === 'text' ? 'bg-green-100' :
            layer.type === 'filter' ? 'bg-yellow-100' :
            layer.type === 'adjustment' ? 'bg-blue-100' :
            'bg-gray-100'
          }`}>
            {getLayerIcon()}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">{layer.name}</p>
            <p className="text-xs text-gray-500">{layer.description}</p>
          </div>
        </div>
        
        {/* Opacity Display */}
        <div className="text-xs text-gray-500 w-10 text-right">
          {layer.opacity}%
        </div>
        
        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>
          
          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
              {/* Opacity Slider */}
              <div className="px-3 py-2 border-b border-gray-200">
                <label className="text-xs text-gray-600">Opacidad</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={layer.opacity}
                  onChange={(e) => onOpacityChange(layer.id, Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              {/* Blend Mode */}
              <div className="px-3 py-2 border-b border-gray-200">
                <label className="text-xs text-gray-600">Modo de fusión</label>
                <select
                  value={layer.blendMode}
                  onChange={(e) => onBlendModeChange(layer.id, e.target.value)}
                  className="w-full text-xs mt-1 p-1 border rounded"
                >
                  {blendModes.map(mode => (
                    <option key={mode} value={mode}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1).replace('-', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Actions */}
              <button
                onClick={() => {
                  // TODO: Duplicate layer
                  setShowMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Copy className="h-3 w-3" />
                <span>Duplicar capa</span>
              </button>
              
              <button
                onClick={() => {
                  onDelete(layer.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
                <span>Eliminar capa</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const LayersPanel: React.FC = () => {
  const [session, setSession] = useState<EditSession | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const toast = useToast();
  
  const nonDestructiveEditor = getNonDestructiveEditor();
  
  useEffect(() => {
    // Obtener sesión inicial
    const currentSession = nonDestructiveEditor.getCurrentSession();
    setSession(currentSession);
    
    // Suscribirse a cambios
    nonDestructiveEditor.onLayersUpdate((updatedSession) => {
      setSession({ ...updatedSession });
    });
  }, []);
  
  const handleToggleLayer = (layerId: string) => {
    nonDestructiveEditor.toggleLayer(layerId);
  };
  
  const handleDeleteLayer = (layerId: string) => {
    nonDestructiveEditor.removeLayer(layerId);
    toast.success('Capa eliminada');
  };
  
  const handleSelectLayer = (layerId: string) => {
    if (session) {
      const newSession = { ...session };
      newSession.activeLayerId = layerId;
      setSession(newSession);
    }
  };
  
  const handleOpacityChange = (layerId: string, opacity: number) => {
    nonDestructiveEditor.setLayerOpacity(layerId, opacity);
  };
  
  const handleBlendModeChange = (layerId: string, blendMode: string) => {
    nonDestructiveEditor.setLayerBlendMode(layerId, blendMode);
  };
  
  const handleMergeLayers = async () => {
    if (selectedLayers.length < 2) {
      toast.error('Selecciona al menos 2 capas para fusionar');
      return;
    }
    
    const merged = await nonDestructiveEditor.mergeLayers(selectedLayers);
    if (merged) {
      toast.success(`Capas fusionadas en: ${merged.name}`);
      setSelectedLayers([]);
    }
  };
  
  const handleRevertToOriginal = async () => {
    await nonDestructiveEditor.revertToOriginal();
    toast.success('Revertido a imagen original');
  };
  
  const handleExportComposite = async () => {
    try {
      const blob = await nonDestructiveEditor.exportComposite();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `composicion-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Composición exportada');
    } catch (error) {
      toast.error('Error al exportar');
    }
  };
  
  const handleAddLayer = () => {
    // TODO: Abrir diálogo para elegir tipo de capa
    toast.info('Función en desarrollo');
  };
  
  if (!session) return null;
  
  return (
    <div className="bg-white border rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">
            Capas de Modificación
          </h3>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {session.modifications.length} capas
          </span>
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>
      
      {!collapsed && (
        <>
          {/* Toolbar */}
          <div className="px-4 py-2 border-b flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-1">
              <button
                onClick={handleAddLayer}
                className="p-1.5 hover:bg-white rounded text-gray-600 hover:text-gray-800"
                title="Agregar capa"
              >
                <Plus className="h-4 w-4" />
              </button>
              
              <button
                onClick={handleMergeLayers}
                className="p-1.5 hover:bg-white rounded text-gray-600 hover:text-gray-800"
                title="Fusionar capas"
                disabled={selectedLayers.length < 2}
              >
                <Merge className="h-4 w-4" />
              </button>
              
              <button
                onClick={handleRevertToOriginal}
                className="p-1.5 hover:bg-white rounded text-gray-600 hover:text-gray-800"
                title="Revertir a original"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              
              <button
                onClick={handleExportComposite}
                className="p-1.5 hover:bg-white rounded text-gray-600 hover:text-gray-800"
                title="Exportar composición"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
            
            {session.originalImage && (
              <span className="text-xs text-green-600 flex items-center">
                <Lock className="h-3 w-3 mr-1" />
                Original preservado
              </span>
            )}
          </div>
          
          {/* Layers List */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {session.modifications.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No hay capas de modificación.
                <br />
                Dibuja o agrega elementos para crear capas.
              </p>
            ) : (
              <div>
                {session.modifications.map((layer) => (
                  <LayerItem
                    key={layer.id}
                    layer={layer}
                    isActive={session.activeLayerId === layer.id}
                    onToggle={handleToggleLayer}
                    onDelete={handleDeleteLayer}
                    onSelect={handleSelectLayer}
                    onOpacityChange={handleOpacityChange}
                    onBlendModeChange={handleBlendModeChange}
                  />
                ))}
              </div>
            )}
            
            {/* Original Image Layer (always at bottom) */}
            {session.originalImage && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                  <Lock className="h-4 w-4 text-gray-400" />
                  <Image className="h-4 w-4 text-gray-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Imagen Original</p>
                    <p className="text-xs text-gray-400">Capa base (protegida)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LayersPanel;