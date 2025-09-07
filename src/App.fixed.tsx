import React from 'react';
import './App.css';

function AppFixed() {
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4">
        <h1 className="text-lg font-semibold">Nanobanan</h1>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tools */}
        <div className="w-64 bg-white border-r border-gray-200 p-4">
          <h2 className="font-medium mb-2">Herramientas</h2>
          <div className="space-y-2">
            <button className="w-full px-3 py-2 text-left hover:bg-gray-100 rounded">🖌️ Pincel</button>
            <button className="w-full px-3 py-2 text-left hover:bg-gray-100 rounded">🧹 Goma</button>
            <button className="w-full px-3 py-2 text-left hover:bg-gray-100 rounded">✏️ Texto</button>
          </div>
        </div>
        
        {/* Center Panel - Canvas */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-semibold mb-4">Canvas Principal</h2>
            <div className="w-96 h-96 border-2 border-gray-300 rounded flex items-center justify-center">
              <p className="text-gray-500">Área de dibujo</p>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Controls */}
        <div className="w-80 bg-white border-l border-gray-200 p-4">
          <h2 className="font-medium mb-2">Controles IA</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Prompt</label>
              <textarea 
                className="w-full h-32 p-2 border rounded resize-none"
                placeholder="Describe tu imagen..."
              />
            </div>
            <button className="w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
              🍌 Generar con Nano Banana
            </button>
          </div>
        </div>
      </div>
      
      {/* Bottom Gallery */}
      <div className="h-32 bg-white border-t border-gray-200 p-4">
        <h3 className="text-sm font-medium mb-2">Imágenes Generadas</h3>
        <div className="flex gap-2">
          <div className="w-20 h-20 bg-gray-200 rounded"></div>
          <div className="w-20 h-20 bg-gray-200 rounded"></div>
          <div className="w-20 h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

export default AppFixed;