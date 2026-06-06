/**
 * useResponsiveLayout — single source of truth for adaptive sizing.
 *
 * Breakpoints (width-based, follows Material Design):
 *   < 600   → compact phone
 *   600–839 → medium (wide phone / foldable outer)
 *   ≥ 840   → expanded (tablet / foldable inner)
 *
 * Usage:
 *   const { gridColumns, railCardWidth, gridCellWidth } = useResponsiveLayout();
 */

import { useWindowDimensions } from 'react-native';

const H_PAD = 20;   // Horizontal screen padding (each side)
const RAIL_GAP = 10; // Gap between rail cards
const GRID_GAP = 12; // Gap between grid cells

export interface ResponsiveLayout {
  screenWidth: number;
  screenHeight: number;
  /** true on phones (< 600 dp) */
  isPhone: boolean;
  /** true on wide phones / foldables (600–839 dp) */
  isMedium: boolean;
  /** true on tablets / large screens (≥ 840 dp) */
  isTablet: boolean;
  /** Number of columns for a playlist / card grid */
  gridColumns: number;
  /** Width of each cell in the grid (px), accounts for padding and gaps */
  gridCellWidth: number;
  /** Width of a card in a horizontal rail (shows partial peek of next card) */
  railCardWidth: number;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  const isPhone = width < 600;
  const isMedium = width >= 600 && width < 840;
  const isTablet = width >= 840;

  // Grid column count
  const gridColumns = isTablet ? 4 : isMedium ? 3 : 2;

  // Grid cell width: (screen - padding×2 - gap×(cols-1)) / cols
  const gridCellWidth = Math.floor(
    (width - H_PAD * 2 - GRID_GAP * (gridColumns - 1)) / gridColumns
  );

  // Rail card width: visible 2.3 / 3.3 / 4.3 cards so edge of next is visible
  const visibleCards = isTablet ? 4.3 : isMedium ? 3.3 : 2.3;
  const railCardWidth = Math.floor(
    (width - H_PAD * 2 - RAIL_GAP * (Math.floor(visibleCards) - 1)) / visibleCards
  );

  return {
    screenWidth: width,
    screenHeight: height,
    isPhone,
    isMedium,
    isTablet,
    gridColumns,
    gridCellWidth,
    railCardWidth,
  };
}
