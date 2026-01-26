/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Ocean Sunset Theme
        'ocean-blue': '#1E3A8A',
        'ocean-dark': '#0F172A',
        'ocean-teal': '#14B8A6',
        'sunset-orange': '#FB923C',
        'coral-pink': '#F472B6',
        'sunrise-yellow': '#FCD34D',
        'sky-light': '#60A5FA',
        'sky-blue': '#3B82F6',
        'sand': '#F5F5F4',
        'ocean-green': '#10B981',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
