/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0a0a0c',
          raised: '#121218',
          overlay: '#1a1a22',
          border: '#2a2a35',
        },
        brand: {
          DEFAULT: '#b87333',
          light: '#d4956a',
          dark: '#8b5a2b',
          bronze: '#cd7f32',
        },
        glow: {
          DEFAULT: '#00aeef',
          dim: '#0077aa',
        },
        accent: {
          green: '#10b981',
          gold: '#d4956a',
          red: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 174, 239, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 174, 239, 0.45)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(rgba(0,174,239,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,174,239,0.04) 1px, transparent 1px)',
        'mesh-pattern':
          'radial-gradient(circle at 20% 20%, rgba(184,115,51,0.08) 0%, transparent 40%), radial-gradient(circle at 80% 0%, rgba(0,174,239,0.06) 0%, transparent 35%)',
      },
      backgroundSize: {
        grid: '48px 48px',
      },
    },
  },
  plugins: [],
};
