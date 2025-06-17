// BitHeadzArtEngine Index - Backward Compatibility Layer
// This file provides backward compatibility for existing imports

import { generateCollectionWithLayersOptimized } from './optimized.js';

// Export the optimized function with the legacy name for backward compatibility
export const generateCollectionWithLayers = generateCollectionWithLayersOptimized;

// Also export the optimized version for new code
export { generateCollectionWithLayersOptimized }; 