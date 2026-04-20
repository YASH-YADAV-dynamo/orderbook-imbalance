/**
 * SkewX Theme Configuration
 * Centralized design tokens for colors, typography, and geometry.
 */

export const THEME = {
  colors: {
    // Brand Colors
    primary: 'var(--primary)',
    accent: 'var(--accent)',
    
    // Trading Colors
    bid: 'var(--bid)',      // Jade Green
    ask: 'var(--ask)',      // Vibrant Red
    buy: 'var(--buy-bg)',
    sell: 'var(--sell-bg)',
    
    // Backgrounds & Surfaces
    background: 'var(--bg)',
    surface: 'var(--bg-1)',
    surfaceMuted: 'var(--bg-2)',
    
    // Foreground / Text
    foreground: 'var(--fg)',
    foregroundMuted: 'var(--fg-muted)',
    textMuted: 'var(--muted)',
    
    // Borders & UI
    border: 'var(--border)',
    grid: 'var(--grid)',
    gridBright: 'var(--grid-bright)',
  },
  
  typography: {
    fontFamily: {
      mono: 'var(--font-mono)',
    },
    weights: {
      light: '300',
      regular: '400',
      semibold: '600',
      bold: '700',
    },
    // Common sizes used in the app
    sizes: {
      xs: '0.75rem',  // 12px
      sm: '0.875rem', // 14px
      base: '1rem',    // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem',  // 20px
    }
  },
  
  geometry: {
    radius: 'var(--radius)',
    radiusSm: 'calc(var(--radius) - 4px)',
    radiusLg: 'calc(var(--radius) + 4px)',
    radiusFull: '9999px', // Capsule shape
  },
  
  shadows: {
    default: 'var(--shadow)',
    hover: 'var(--shadow-hover)',
  },
  
  transitions: {
    default: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fluid: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // Helpers
  getAlpha: (colorVar: string, opacity: number) => {
    return `color-mix(in srgb, ${colorVar}, transparent ${100 - (opacity * 100)}%)`;
  }
} as const;

export type Theme = typeof THEME;
