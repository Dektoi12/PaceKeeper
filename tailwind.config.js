/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Near-black surfaces (spec §6.7)
        ink: {
          900: '#0B0E11',
          800: '#12161B',
          700: '#1A1F26',
          600: '#232A33',
          500: '#2E3742',
        },
        // Electric blue accent
        accent: {
          DEFAULT: '#2E8BFF',
          50: '#EAF3FF',
          400: '#5AA6FF',
          500: '#2E8BFF',
          600: '#1F6FE0',
          700: '#1657B4',
        },
        // Session-type color coding (spec §6.3.1)
        session: {
          easy: '#3BB273',
          tempo: '#F5A623',
          intervals: '#E5484D',
          hills: '#B368E5',
          fartlek: '#F06595',
          long: '#2E8BFF',
          strength: '#8B95A5',
          mobility: '#4CC9C0',
          rest: '#5B6470',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
    },
  },
  plugins: [],
}
