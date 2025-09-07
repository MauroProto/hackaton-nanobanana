# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lienzo + Gemini 2.5 Flash Image (Nano Banana)** - A digital canvas application that combines traditional drawing tools with AI-powered image generation and editing using Gemini 2.5 Flash Image API.

## Development Commands

```bash
# Development server (auto-opens at http://localhost:5173 or next available port)
npm run dev

# Type checking (run before committing)
npm run check

# Build for production (includes TypeScript check)
npm run build

# Linting
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Core Technologies
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool and dev server
- **Fabric.js v6** - Canvas manipulation engine
- **Zustand** - Global state management
- **Gemini 2.5 Flash Image API** - AI image generation/editing
- **Supabase** - Backend services (auth, database, storage)
- **Tailwind CSS** - Styling

### Key Architectural Components

#### CanvasManager (`src/lib/canvas-v6.ts`)
Central class managing all canvas operations through Fabric.js:
- Multi-layer system (base, mask, result, reference layers)
- Event-driven drawing tools (brush, eraser, selection)
- Memory-optimized rendering with throttling
- Image import/export functionality
- Zoom/pan navigation

Critical methods:
- `addImage()` - Must handle blob/URL validation and rendering pipeline
- `startDrawing()/stopDrawing()` - Event handling for drawing tools
- `applyAIMask()` - Integration point for AI edits

#### State Management (`src/store/index.ts`)
Zustand store with typed interfaces:
- Canvas state (layers, tools, selections)
- UI state (panels, modals, loading)
- Gemini state (API config, generation params)
- Project state (versions, history)

Key patterns:
- Immutable updates with proper TypeScript typing
- DevTools integration for debugging
- Persistence middleware for user settings
- Optimized selectors to prevent re-renders

#### Gemini Integration (`src/lib/gemini.ts`)
Handles all AI image operations:
- `generateImageWithAPI()` - Text-to-image generation
- `editImageWithMask()` - Localized editing with masks
- Blob-based image handling for memory efficiency
- Comprehensive error handling and validation

Configuration parameters:
- Quality levels (fast, balanced, high)
- Edit strength (0.0-1.0)
- Character consistency
- Preservation bias
- Seed for reproducibility

### Component Architecture

```
Layout Structure:
┌─────────────────────────────────────────┐
│              Header.tsx                  │
├──────┬─────────────────────┬────────────┤
│      │                     │            │
│ Left │   CenterPanel       │   Right    │
│Panel │   (Canvas Area)     │   Panel    │
│      │                     │            │
│Tools │   Fabric.js Canvas  │ AI Config  │
│      │                     │            │
└──────┴─────────────────────┴────────────┘
```

Key components:
- **CenterPanel.tsx** - Canvas container with zoom/pan controls
- **LeftPanel.tsx** - Drawing tools and layer management
- **RightPanel.tsx** - AI prompts and generation settings
- **HistoryPanel.tsx** - Version control and undo/redo

### Critical Implementation Details

#### Canvas Event Handling
Events must be properly attached/detached:
```typescript
// Correct pattern for mouse events
canvas.on('mouse:down', handleMouseDown);
canvas.on('mouse:move', handleMouseMove);
canvas.on('mouse:up', handleMouseUp);
// Must clean up on unmount
```

#### Image Display Pipeline
When adding generated images:
1. Validate blob/URL format
2. Create Fabric.Image object
3. Add to appropriate layer
4. Update canvas dimensions if needed
5. Trigger renderAll()
6. Update store state

#### Performance Optimizations
- Throttle drawing events to 16ms intervals
- Batch canvas operations before renderAll()
- Use requestAnimationFrame for smooth animations
- Clean up Fabric objects to prevent memory leaks
- Lazy load large images

## Project Structure

```
src/
├── components/       # UI components (panels, controls)
├── lib/             # Core logic (canvas, AI, history)
├── store/           # Zustand state management
├── types/           # TypeScript definitions
├── hooks/           # Custom React hooks
└── pages/           # Route components
```

## Common Development Tasks

### Adding New Drawing Tools
1. Update tool type in `src/types/index.ts`
2. Add tool logic to `CanvasManager` class
3. Create UI control in `LeftPanel.tsx`
4. Update store actions for tool selection

### Modifying AI Generation Parameters
1. Update types in `src/types/index.ts`
2. Modify `generateImageWithAPI` in `src/lib/gemini.ts`
3. Update UI controls in `RightPanel.tsx`
4. Test with various parameter combinations

### Debugging Canvas Issues
1. Check browser console for Fabric.js errors
2. Verify event listeners are properly attached
3. Use `canvas.renderAll()` to force re-render
4. Check layer visibility and z-index
5. Validate image blob formats

## Environment Setup

Required environment variables (`.env.local`):
- Gemini API key for AI features
- Supabase credentials (if backend enabled)

## Testing Considerations

When testing changes:
1. Verify drawing tools work correctly
2. Test image generation with various prompts
3. Check undo/redo functionality
4. Validate export in different formats
5. Test on different viewport sizes
6. Monitor memory usage with DevTools

## Known Issues and Solutions

### Images Not Displaying
- Ensure `addImage()` properly validates blob format
- Check canvas dimensions accommodate image size
- Verify layer visibility settings
- Call `canvas.renderAll()` after adding

### Drawing Tools Not Working
- Verify event listeners properly attached
- Check tool state in store
- Ensure canvas is not locked
- Validate brush configuration

### Performance Issues
- Enable throttling for high-frequency events
- Batch canvas operations
- Clear unused objects from memory
- Optimize image sizes before loading