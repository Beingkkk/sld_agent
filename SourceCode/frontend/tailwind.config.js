/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0d1117',
        'bg-secondary': '#161b22',
        'bg-tertiary': '#1c2128',
        'bg-hover': '#21262d',
        'bg-active': '#30363d',
        'border-default': '#30363d',
        'border-subtle': '#21262d',
        'text-primary': '#e6edf3',
        'text-secondary': '#8b949e',
        'text-tertiary': '#6e7681',
        'text-disabled': '#484f58',
        'accent-teal': '#2dd4bf',
        'accent-teal-dim': '#115e59',
        'accent-amber': '#f59e0b',
        'accent-amber-dim': '#78350f',
        'accent-red': '#f87171',
        'accent-blue': '#60a5fa',
        'accent-purple': '#a78bfa',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        brand: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'card': '8px',
        'input': '6px',
        'btn': '6px',
      },
    },
  },
  plugins: [],
};
