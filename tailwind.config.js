/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-main': '#020617',
        'bg-secondary': '#0f172a',
        'bg-tertiary': '#1e293b',

        // Primary Accent (Cyan/Sky)
        'primary': {
          DEFAULT: '#0ea5e9',
          hover: '#38bdf8',
          dim: 'rgba(14, 165, 233, 0.15)',
          glow: 'rgba(56, 189, 248, 0.5)',
        },

        // Secondary Accent (Indigo/Violet)
        'secondary': {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          dim: 'rgba(99, 102, 241, 0.15)',
          glow: 'rgba(129, 140, 248, 0.5)',
        },

        // Functional Colors
        'success': {
          DEFAULT: '#10b981',
          glow: 'rgba(16, 185, 129, 0.4)',
        },
        'warning': {
          DEFAULT: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.4)',
        },
        'danger': {
          DEFAULT: '#ef4444',
          glow: 'rgba(239, 68, 68, 0.4)',
        },

        // Text & Content
        'text-main': '#f8fafc',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
        'text-highlight': '#ffffff',

        // Glassmorphism
        'glass': {
          border: 'rgba(255, 255, 255, 0.08)',
          'border-light': 'rgba(255, 255, 255, 0.15)',
          bg: 'rgba(15, 23, 42, 0.65)',
          'bg-hover': 'rgba(30, 41, 59, 0.75)',
        },
      },

      backgroundImage: {
        'gradient-main': 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #020617 70%)',
        'card-gradient': 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.6) 100%)',
        'sidebar-gradient': 'linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, rgba(2, 6, 23, 0.9) 100%)',
        'border-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)',
      },

      borderRadius: {
        'sm': '0.75rem',
        'md': '1rem',
        'lg': '1.5rem',
      },

      boxShadow: {
        'sm': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'md': '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        'glow': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
      },

      backdropBlur: {
        'glass': '16px',
      },

      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      transitionDuration: {
        'fast': '150ms',
        'normal': '300ms',
        'spring': '500ms',
      },

      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin-slow 60s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },

      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '0.4' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
      },

      fontFamily: {
        'sans': ['Outfit', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
