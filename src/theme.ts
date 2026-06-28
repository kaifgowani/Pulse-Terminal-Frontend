export const theme = {
  colors: {
    background: '#09090b', // Zinc 950
    surface: 'rgba(24, 24, 27, 0.7)', // Zinc 900 with transparency
    surfaceSolid: '#18181b',
    card: 'rgba(39, 39, 42, 0.6)', // Zinc 800 with transparency
    cardSolid: '#27272a',
    text: '#fafafa', // Zinc 50
    textSecondary: '#a1a1aa', // Zinc 400
    primary: '#3b82f6', // Blue 500 (more premium than pure green)
    primaryGradient: ['#3b82f6', '#8b5cf6'], // Blue to Violet
    danger: '#ef4444', // Red 500
    success: '#22c55e', // Green 500
    border: 'rgba(63, 63, 70, 0.5)', // Zinc 700 transparent
  },
  blur: {
    intensity: 20,
    tint: 'dark' as const
  }
};
