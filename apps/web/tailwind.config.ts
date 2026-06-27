import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      // Brand Board palette. Gold = money (402/toll/Kelly/synthesis).
      // Verdigris = the live machine layer (agents/status/signal). Never mix.
      colors: {
        obsidian: '#0C0B09',
        basalt: '#16130F',
        panel: '#100E0B',
        marble: '#E9E3D6',
        ash: '#9A9384',
        gold: '#C8A45D',
        verdigris: '#5FA391',
        hairline: '#221F19',
        'hairline-soft': '#1A1712',
        'mono-dim': '#6B655A',
        'mono-faint': '#4A453C',
      },
      keyframes: {
        spin: { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        livePulse: {
          '0%,100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(95,163,145,0.5)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 0 6px rgba(95,163,145,0)' },
        },
      },
      animation: {
        'spin-slow': 'spin 120s linear infinite',
        'live-pulse': 'livePulse 2s infinite',
      },
    },
  },
  plugins: [],
}

export default config
