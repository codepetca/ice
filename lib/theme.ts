/**
 * Ice App Theme - Minimal, Aesthetic, Fun
 * Clean design system with subtle accents and good typography
 */

// Button Styles - Minimal and clean
export const buttonStyles = {
  primary: `
    bg-primary text-primary-foreground
    hover:opacity-90
    active:scale-95
    font-semibold
    shadow-sm hover:shadow
    transition-all duration-200
  `,

  secondary: `
    bg-muted text-foreground
    hover:bg-muted/80
    active:scale-95
    font-semibold
    transition-all duration-200
  `,

  success: `
    bg-success text-white
    hover:opacity-90
    active:scale-95
    font-semibold
    shadow-sm hover:shadow
    transition-all duration-200
  `,

  outline: `
    bg-background border-2 border-border
    hover:bg-muted
    active:scale-95
    text-foreground font-semibold
    transition-all duration-200
  `,

  ghost: `
    hover:bg-muted
    active:scale-95
    text-foreground font-semibold
    transition-all duration-200
  `,

  destructive: `
    bg-red-500 text-white
    hover:bg-red-600
    active:scale-95
    font-semibold
    shadow-sm hover:shadow
    transition-all duration-200
  `,
};

// Card Styles - Clean and minimal
export const cardStyles = {
  default: `
    bg-card text-card-foreground
    rounded-lg
    shadow-sm
    border border-border
  `,

  elevated: `
    bg-card text-card-foreground
    rounded-lg
    shadow-md
    border border-border
  `,

  interactive: `
    bg-card text-card-foreground
    rounded-lg
    shadow-sm
    border border-border
    hover:shadow-md hover:border-primary/50
    transition-all duration-200
  `,
};

// Input Styles - Minimal and accessible
export const inputStyles = {
  default: `
    bg-background
    border-2 border-input
    focus:border-ring focus:ring-2 focus:ring-ring/20
    rounded-lg
    text-base
    transition-all duration-200
  `,

  large: `
    bg-background
    border-2 border-input
    focus:border-ring focus:ring-2 focus:ring-ring/20
    rounded-lg
    text-xl font-semibold
    transition-all duration-200
  `,
};

// Typography - Clean hierarchy
export const typography = {
  display: {
    xl: 'font-display text-6xl md:text-7xl font-bold tracking-tight',
    lg: 'font-display text-4xl md:text-5xl font-bold tracking-tight',
    md: 'font-display text-3xl md:text-4xl font-bold tracking-tight',
    sm: 'font-display text-2xl md:text-3xl font-bold tracking-tight',
  },

  heading: {
    xl: 'font-display text-3xl md:text-4xl font-bold',
    lg: 'font-display text-2xl md:text-3xl font-bold',
    md: 'font-display text-xl md:text-2xl font-bold',
    sm: 'font-display text-lg md:text-xl font-bold',
  },

  body: {
    lg: 'font-sans text-lg md:text-xl',
    md: 'font-sans text-base md:text-lg',
    sm: 'font-sans text-sm md:text-base',
  },
};

// Animation Presets - Subtle and smooth
export const animations = {
  fadeIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3 },
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 },
  },

  slideIn: {
    initial: { x: -10, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: 10, opacity: 0 },
    transition: { duration: 0.3 },
  },

  tap: {
    whileTap: { scale: 0.97 },
  },

  hover: {
    whileHover: { scale: 1.02 },
    transition: { duration: 0.2 },
  },
};

// Spacing - Consistent and clean
export const spacing = {
  touch: {
    min: 'min-h-[44px]',  // Minimum touch target (accessibility)
    comfortable: 'min-h-[52px]',
    large: 'min-h-[60px]',
  },

  gap: {
    tight: 'gap-2',
    normal: 'gap-4',
    relaxed: 'gap-6',
    loose: 'gap-8',
  },

  padding: {
    card: 'p-4 md:p-6',
    page: 'p-4 md:p-6 lg:p-8',
    section: 'py-8 md:py-12',
  },
};

// Utility function to combine class names
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ').trim().replace(/\s+/g, ' ');
}
