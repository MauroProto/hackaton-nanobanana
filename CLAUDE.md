# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nano Banana** - An AI-powered drawing application using TLDraw and Gemini 2.5 Flash Image API for real-time sketch-to-image generation with advanced editing capabilities.

## Development Commands

```bash
# Development server (auto-opens at http://localhost:5173 or next available port)
npm run dev

# Type checking (run before committing)
npm run check

# Build for production
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
- **TLDraw** - Canvas drawing and manipulation library (replaced Fabric.js)
- **Gemini 2.5 Flash Image API** - AI image generation/editing
- **Zustand** - Global state management (legacy, used in old components)
- **Tailwind CSS** - Styling

### Current Implementation: TLDraw Version (AppTldraw.tsx)

The application now uses **TLDraw** as the primary canvas engine (configured in `src/main.tsx` to load `AppTldraw.tsx`). This provides:

#### Key Features:
- **Real-time Selection-Based Generation**: Only generates from currently selected shapes
- **Two-Image Comparison for Editing**: Sends original + modified images to Gemini for precise edits
- **Smart Shape Detection**: Identifies drawings vs images automatically
- **Debug Tools**: Built-in debugging functions for canvas state inspection

#### Critical Implementation Details:

##### 1. Selection-Based Generation
```typescript
// Real-time selection - NO cached state
const selectedShapes = editor.getSelectedShapes();
if (selectedShapes.length > 0) {
  // Generate ONLY from selected shapes
  validShapeIds = selectedShapes.map(shape => shape.id);
} else {
  // Use entire canvas if nothing selected
  const allShapeIds = Array.from(editor.getCurrentPageShapeIds());
}
```

##### 2. Two-Image Approach for Editing
When an image is selected and drawings are detected:
1. Extract base image without drawings
2. Create composite image with drawings on top
3. Send both to `applyChangesFromReference()` function
4. Gemini compares and applies only the new elements

##### 3. Debug Function (User-Added)
```typescript
const debugCanvasState = () => {
  // Logs all shapes, bounds, and selection state
  // Essential for troubleshooting generation issues
};
```

### Gemini Integration (`src/lib/gemini-real-generator.ts`)

#### Key Functions:

##### generateWithGeminiReal()
- Basic sketch-to-image generation
- Uses model: `gemini-2.5-flash-image-preview`
- Handles style application and prompt sanitization

##### applyChangesFromReference() - NEW
- Two-image comparison for precise editing
- Parameters:
  - `originalImage`: Base image without modifications
  - `imageWithSketches`: Same image with drawings overlaid
  - `instruction`: What changes to apply
- Returns edited image preserving original background

##### mergeImages()
- Intelligently combines two separate images
- Used for the merge feature when 2 shapes are selected

### Security Improvements

#### 1. API Key Management (`src/lib/config.ts`)
- Centralized secure configuration
- Environment variable validation
- No hardcoded keys in source code

#### 2. Input Sanitization (`src/lib/security.ts`)
- Prompt sanitization to prevent injection
- Image validation
- Size and format checks

### UI/UX Enhancements

#### Real-Time Selection Indicators
- Shows number of selected elements
- Clear visual feedback for what will be generated
- "Generate from X selected" dynamic button text

#### Merge Mode
- Select exactly 2 shapes to enable merge
- Visual indicator when merge mode is active
- AI-powered intelligent merging

#### Diagnostic Tools
- "Ver Selección Actual" button for selection verification
- "Debug Canvas" button for detailed state inspection
- Console logging for troubleshooting

## Common Development Tasks

### Testing Image Generation
1. Use "Test API (Prompt Only)" button for basic API testing
2. Draw on canvas and click "Generate from All/Selected"
3. Check console (F12) for detailed logs

### Debugging Generation Issues
1. Click "Debug Canvas" to see all shapes and their properties
2. Use "Ver Selección Actual" to verify selection state
3. Check console for detailed generation pipeline logs

### Adding New Features
1. Primary code is in `src/AppTldraw.tsx`
2. Gemini functions in `src/lib/gemini-real-generator.ts`
3. Security functions in `src/lib/security.ts`

## Environment Setup

Required in `.env.local`:
```
VITE_GEMINI_API_KEY=your-api-key-here
```

## Known Issues and Solutions

### Issue: Generated images don't appear
**Solution**: Check that TLDraw assets are properly created with actual image dimensions

### Issue: Selection not working as expected
**Solution**: Use real-time `editor.getSelectedShapes()` instead of cached state

### Issue: Background gets regenerated instead of edited
**Solution**: Use the two-image approach via `applyChangesFromReference()`

### Issue: "editor is not defined" errors
**Solution**: Always use `editorRef.current` instead of direct `editor` references

## Recent Updates (January 2025)

### Security Enhancements
- ✅ Removed all hardcoded API keys from source
- ✅ Implemented centralized configuration management
- ✅ Added comprehensive input sanitization
- ✅ Created security validation layers

### Functionality Improvements
- ✅ Switched from Fabric.js to TLDraw for better performance
- ✅ Implemented real-time selection-based generation
- ✅ Added two-image comparison for precise editing
- ✅ Created merge feature for combining elements
- ✅ Added comprehensive debugging tools

### Bug Fixes
- ✅ Fixed "drawingShapeIds is not defined" error
- ✅ Resolved image display issues in canvas
- ✅ Fixed selection caching problems
- ✅ Corrected shape ID conversion errors
- ✅ Fixed duplicate try-catch blocks causing errors
- ✅ Resolved background modification issues

### User-Added Enhancements
- ✅ Debug function for canvas state inspection
- ✅ Improved error messages with actionable solutions
- ✅ Selection verification buttons
- ✅ Enhanced console logging for troubleshooting

## Testing Workflow

1. **API Testing**: Use "Test API (Prompt Only)" to verify Gemini connection
2. **Drawing Test**: Draw simple shapes and generate without selection
3. **Selection Test**: Select specific shapes and generate only those
4. **Edit Test**: Generate an image, draw on it, generate again to test editing
5. **Merge Test**: Select 2 elements and test merge functionality

## Project Structure

```
src/
├── AppTldraw.tsx          # Main application using TLDraw (ACTIVE)
├── App.tsx                # Legacy Fabric.js version (NOT USED)
├── lib/
│   ├── config.ts          # Secure configuration management
│   ├── security.ts        # Input validation and sanitization
│   ├── gemini-real-generator.ts  # Gemini API integration
│   ├── gemini-image.ts    # Basic image generation
│   └── logger.ts          # Logging utilities
├── components/            # Legacy UI components (mostly unused)
└── main.tsx              # Entry point (loads AppTldraw.tsx)
```

## Important Notes

- **Current Version**: The app uses TLDraw (AppTldraw.tsx), NOT the Fabric.js version
- **Selection is Key**: The app primarily works with selected shapes for generation
- **Two-Image Editing**: Editing existing images uses a comparison approach
- **Debug Tools**: Extensive debugging functions are built into the UI
- **No Trae Plugin**: All references to the Trae plugin have been removed

## Troubleshooting Guide

### Canvas is empty but generation fails
1. Check if shapes are actually created (use Debug Canvas)
2. Verify shape types are correct (draw, line, arrow, etc.)
3. Ensure shapes have valid bounds

### Wrong content being generated
1. Clear selection and reselect desired shapes
2. Use "Ver Selección Actual" to verify
3. Check console for which shapes are being exported

### API errors
1. Verify API key is set in `.env.local`
2. Check console for specific error messages
3. Use "Test API" button to isolate API issues

### Performance issues
1. Reduce number of shapes on canvas
2. Clear history/gallery if too many images
3. Use smaller image sizes for editing

---

**Last Updated**: January 2025  
**Maintained by**: Development Team with user contributions