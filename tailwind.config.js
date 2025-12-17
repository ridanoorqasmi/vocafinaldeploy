/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#FFE6E6', 100: '#FFCCCC', 200: '#FF9999', 300: '#FF6666', 400: '#FF3333', 500: '#FF0000', 600: '#E60000', 700: '#CC0000', 800: '#B30000', 900: '#990000' },
        secondary: { 50: '#F5F5F5', 100: '#E6E6E6', 200: '#CCCCCC', 300: '#B3B3B3', 400: '#999999', 500: '#808080', 600: '#666666', 700: '#4D4D4D', 800: '#333333', 900: '#1E1E1E' },
        dark: { 50: '#1A1A1A', 100: '#0F0F0F', 200: '#0A0A0A', 300: '#050505', 400: '#000000', 500: '#000000', 600: '#000000', 700: '#000000', 800: '#000000', 900: '#000000' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out',
        slideUp: 'slideUp 0.5s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'network-pulse': 'networkPulse 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        glow: { '0%': { boxShadow: '0 0 5px #FF0000, 0 0 10px #FF0000, 0 0 15px #FF0000' }, '100%': { boxShadow: '0 0 10px #FF0000, 0 0 20px #FF0000, 0 0 30px #FF0000' } },
        float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-20px)' } },
        networkPulse: { '0%, 100%': { opacity: '0.3', transform: 'scale(1)' }, '50%': { opacity: '1', transform: 'scale(1.1)' } },
      },
      backgroundImage: {
        'network-pattern': "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3CradialGradient id='glow' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23FF0000' stop-opacity='0.3'/%3E%3Cstop offset='100%25' stop-color='%23FF0000' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='20' cy='20' r='2' fill='%23FF0000' opacity='0.6'/%3E%3Ccircle cx='80' cy='30' r='2' fill='%23FF0000' opacity='0.6'/%3E%3Ccircle cx='40' cy='70' r='2' fill='%23FF0000' opacity='0.6'/%3E%3Ccircle cx='70' cy='80' r='2' fill='%23FF0000' opacity='0.6'/%3E%3Cline x1='20' y1='20' x2='80' y2='30' stroke='%23FF0000' stroke-width='0.5' opacity='0.3'/%3E%3Cline x1='80' y1='30' x2='40' y2='70' stroke='%23FF0000' stroke-width='0.5' opacity='0.3'/%3E%3Cline x1='40' y1='70' x2='70' y2='80' stroke='%23FF0000' stroke-width='0.5' opacity='0.3'/%3E%3Cline x1='70' y1='80' x2='20' y2='20' stroke='%23FF0000' stroke-width='0.5' opacity='0.3'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
