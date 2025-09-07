// Componente de herramienta de texto mejorada
// FASE 1.2 - Herramienta de texto avanzada

import React, { useState, useEffect } from 'react';
import { Type, Bold, Italic, Palette, Plus, Edit2, Trash2, Move } from 'lucide-react';
import { LayeredCanvasManager } from '../lib/canvas-layers';

interface TextToolProps {
  canvasManager: LayeredCanvasManager | null;
}

interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
}

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Comic Sans MS',
  'Impact',
  'Courier New',
  'Trebuchet MS',
  'Palatino'
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72];

const PRESET_COLORS = [
  '#000000', // Negro
  '#FFFFFF', // Blanco
  '#FF0000', // Rojo
  '#00FF00', // Verde
  '#0000FF', // Azul
  '#FFFF00', // Amarillo
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Naranja
  '#800080', // Púrpura
  '#FFC0CB', // Rosa
  '#A52A2A', // Marrón
];

export const TextTool: React.FC<TextToolProps> = ({ canvasManager }) => {
  const [isActive, setIsActive] = useState(false);
  const [textToAdd, setTextToAdd] = useState('');
  const [textStyle, setTextStyle] = useState<TextStyle>({
    fontSize: 24,
    fontFamily: 'Arial',
    color: '#000000',
    bold: false,
    italic: false
  });
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [textList, setTextList] = useState<Array<{ id: string; text: string }>>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState('#000000');

  // Actualizar lista de textos cuando cambie el canvas
  useEffect(() => {
    if (canvasManager) {
      updateTextList();
    }
  }, [canvasManager]);

  const updateTextList = () => {
    if (!canvasManager) return;
    
    const metadata = canvasManager.exportMetadata();
    if (metadata.textObjects) {
      setTextList(metadata.textObjects.map((obj: any) => ({
        id: obj.id,
        text: obj.text
      })));
    }
  };

  const handleAddText = () => {
    if (!canvasManager || !textToAdd.trim()) return;
    
    const textId = canvasManager.addText(textToAdd, {
      x: 100 + Math.random() * 200, // Posición aleatoria para evitar superposición
      y: 100 + Math.random() * 200,
      fontSize: textStyle.fontSize,
      fontFamily: textStyle.fontFamily,
      color: textStyle.color,
      bold: textStyle.bold,
      italic: textStyle.italic
    });
    
    setTextList([...textList, { id: textId, text: textToAdd }]);
    setTextToAdd('');
    
    console.log('✅ Texto añadido:', textToAdd);
  };

  const handleUpdateText = (textId: string, newText: string) => {
    if (!canvasManager) return;
    
    canvasManager.updateText(textId, newText);
    setTextList(textList.map(item => 
      item.id === textId ? { ...item, text: newText } : item
    ));
  };

  const handleDeleteText = (textId: string) => {
    if (!canvasManager) return;
    
    canvasManager.removeText(textId);
    setTextList(textList.filter(item => item.id !== textId));
    setSelectedTextId(null);
  };

  const handleStyleChange = (property: keyof TextStyle, value: any) => {
    setTextStyle({
      ...textStyle,
      [property]: value
    });
  };

  const handleColorSelect = (color: string) => {
    handleStyleChange('color', color);
    setCustomColor(color);
    setShowColorPicker(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddText();
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Type className="h-5 w-5" />
          <h3 className="font-semibold">Herramienta de Texto</h3>
        </div>
        <button
          onClick={() => setIsActive(!isActive)}
          className={`px-3 py-1 rounded text-sm ${
            isActive 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {isActive ? 'Activa' : 'Inactiva'}
        </button>
      </div>

      {isActive && (
        <>
          {/* Input de texto */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Texto a añadir:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={textToAdd}
                onChange={(e) => setTextToAdd(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu texto aquí..."
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={handleAddText}
                disabled={!textToAdd.trim()}
                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Controles de estilo */}
          <div className="space-y-3 mb-4">
            {/* Fuente */}
            <div>
              <label className="block text-sm font-medium mb-1">Fuente:</label>
              <select
                value={textStyle.fontFamily}
                onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {FONT_FAMILIES.map(font => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
            </div>

            {/* Tamaño */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Tamaño: {textStyle.fontSize}px
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="8"
                  max="72"
                  value={textStyle.fontSize}
                  onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                  className="flex-1"
                />
                <select
                  value={textStyle.fontSize}
                  onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
                  className="px-2 py-1 border rounded text-sm"
                >
                  {FONT_SIZES.map(size => (
                    <option key={size} value={size}>{size}px</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Estilo de texto */}
            <div>
              <label className="block text-sm font-medium mb-1">Estilo:</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStyleChange('bold', !textStyle.bold)}
                  className={`px-3 py-2 rounded ${
                    textStyle.bold
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Negrita"
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleStyleChange('italic', !textStyle.italic)}
                  className={`px-3 py-2 rounded ${
                    textStyle.italic
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  title="Cursiva"
                >
                  <Italic className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium mb-1">Color:</label>
              <div className="space-y-2">
                <div className="grid grid-cols-6 gap-1">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={`w-8 h-8 rounded border-2 ${
                        textStyle.color === color ? 'border-blue-500' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-10 h-10 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    placeholder="#000000"
                  />
                  <button
                    onClick={() => handleColorSelect(customColor)}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Vista previa del estilo */}
          <div className="mb-4 p-3 border rounded bg-gray-50">
            <label className="block text-sm font-medium mb-1">Vista previa:</label>
            <div
              style={{
                fontFamily: textStyle.fontFamily,
                fontSize: Math.min(textStyle.fontSize, 32) + 'px',
                color: textStyle.color,
                fontWeight: textStyle.bold ? 'bold' : 'normal',
                fontStyle: textStyle.italic ? 'italic' : 'normal'
              }}
              className="text-center py-2"
            >
              {textToAdd || 'Texto de ejemplo'}
            </div>
          </div>

          {/* Lista de textos existentes */}
          {textList.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Textos en el canvas:</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {textList.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2 border rounded ${
                      selectedTextId === item.id ? 'bg-blue-50 border-blue-300' : 'bg-white'
                    }`}
                  >
                    <div
                      className="flex-1 cursor-pointer truncate"
                      onClick={() => setSelectedTextId(item.id)}
                    >
                      {item.text}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          // TODO: Implementar edición in-place
                          const newText = prompt('Editar texto:', item.text);
                          if (newText) {
                            handleUpdateText(item.id, newText);
                          }
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteText(item.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instrucciones */}
          <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
            <p className="font-medium mb-1">💡 Consejos:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Presiona Enter para añadir texto rápidamente</li>
              <li>Haz clic en un texto de la lista para seleccionarlo</li>
              <li>Puedes mover los textos directamente en el canvas</li>
              <li>Los textos se guardan en una capa independiente</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};