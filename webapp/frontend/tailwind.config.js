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
        primary: '#6366f1',
        secondary: '#22c55e',
        danger: '#ef4444',
        dark: {
          100: '#1e293b',
          200: '#0f172a',
          300: '#020617',
        }
      }
    },
  },
  plugins: [],
}
