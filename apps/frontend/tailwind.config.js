/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Design system — sourced from src/design-system.json
      // UI/UX Pro Max v2.13.0 query: "Food Delivery / On-Demand" palette
      colors: {
        // Semantic tokens (preferred for new code)
        background: '#FFF7ED',           // warm cream
        foreground: '#0F172A',          // almost-black
        card: '#FFFFFF',
        'card-foreground': '#0F172A',
        muted: '#FDF4F0',
        'muted-foreground': '#475569',
        border: '#FCEAE1',
        input: '#FED7AA',
        ring: '#EA580C',
        primary: {
          DEFAULT: '#EA580C',           // appetizing orange
          hover: '#C2410C',
          light: '#FED7AA',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#F97316',           // lighter orange
          foreground: '#000000',
        },
        accent: {
          DEFAULT: '#2563EB',           // trust blue
          light: '#DBEAFE',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        success: '#16A34A',
        warning: '#F59E0B',
        info: '#2563EB',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
}
