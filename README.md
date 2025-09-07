# 🍌 Hackaton NanoBanana

Una aplicación web de lienzo digital que combina herramientas de dibujo tradicionales con generación y edición de imágenes mediante IA (Gemini 2.5 Flash Image API).

## ✨ Características

- 🎨 **Lienzo Digital Interactivo**: Dibuja con pincel, borrador y herramientas de selección
- 🤖 **Generación de Imágenes con IA**: Integración con Gemini API para crear imágenes
- 🖼️ **Galería de Imágenes**: Visualiza y gestiona las imágenes generadas
- 🎯 **Edición No Destructiva**: Dibuja sobre las imágenes generadas
- ⚡ **Interfaz Moderna**: Construida con React 18 y TypeScript

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Canvas**: Fabric.js v6.7.1
- **Estilos**: Tailwind CSS
- **Estado**: Zustand
- **IA**: Google Gemini API
- **Herramientas**: ESLint, PostCSS

## 🚀 Instalación y Uso

### Prerrequisitos
- Node.js (versión 18 o superior)
- pnpm (recomendado) o npm

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/hackaton-nanobanana.git
cd hackaton-nanobanana

# Instalar dependencias
pnpm install
# o
npm install
```

### Configuración

1. Crea un archivo `.env.local` en la raíz del proyecto:
```env
VITE_GEMINI_API_KEY=tu_api_key_aqui
```

2. Obtén tu API key de Gemini en [Google AI Studio](https://makersuite.google.com/app/apikey)

### Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev
# o
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Construcción para Producción

```bash
# Construir para producción
pnpm build
# o
npm run build

# Vista previa de la construcción
pnpm preview
# o
npm run preview
```

## 🎮 Cómo Usar

1. **Dibujar**: Selecciona el pincel y mantén presionado el botón izquierdo del mouse para dibujar
2. **Borrar**: Usa la herramienta borrador para eliminar partes del dibujo
3. **Generar Imágenes**: Escribe un prompt en el panel derecho y haz clic en "Generar Imagen"
4. **Cargar Imágenes**: Haz clic en cualquier imagen de la galería para cargarla en el canvas
5. **Editar**: Dibuja sobre las imágenes cargadas para personalizarlas

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── CenterPanelSimple.tsx    # Canvas principal
│   ├── GeneratedImagesGallery.tsx # Galería de imágenes
│   ├── LeftPanel.tsx            # Panel de herramientas
│   └── RightPanel.tsx           # Panel de IA
├── lib/                # Lógica de negocio
│   ├── canvas-v6.ts             # Gestor del canvas (Fabric.js v6)
│   └── gemini.ts                # Integración con Gemini API
├── store/              # Estado global (Zustand)
├── types/              # Definiciones TypeScript
└── hooks/              # Hooks personalizados
```

## 🔧 Scripts Disponibles

- `pnpm dev` - Servidor de desarrollo
- `pnpm build` - Construcción para producción
- `pnpm preview` - Vista previa de la construcción
- `pnpm lint` - Ejecutar ESLint
- `pnpm check` - Verificación de tipos TypeScript

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Notas de Desarrollo

- **Fabric.js v6**: El proyecto usa Fabric.js v6.7.1, que tiene cambios importantes en la API comparado con v5
- **API de Gemini**: Actualmente usa una función procedural para debugging, pero está preparado para la API real
- **Estado**: El estado global se maneja con Zustand en `src/store/index.ts`

## 🐛 Problemas Conocidos

- El borrador usa un pincel blanco en lugar de borrado real
- La generación de imágenes usa una función procedural (no la API real de Gemini)
- Algunos warnings de "trae-inspector" (no críticos)

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🙏 Agradecimientos

- [Fabric.js](https://fabricjs.com/) por la librería de canvas
- [Google Gemini](https://ai.google.dev/) por la API de IA
- [React](https://reactjs.org/) y [Vite](https://vitejs.dev/) por el framework y bundler