/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PRD §6.2 palette, single-sourced from CSS variables in theme/tokens.css
        bg: 'var(--bg-deep-space)',
        surface: 'var(--surface-dark-lifted)',
        primary: 'var(--primary-electric-purple)',
        coral: 'var(--campaign-hot-coral)',
        mint: 'var(--campaign-teal-mint)',
        sunny: 'var(--campaign-sunny-yellow)',
        lavender: 'var(--campaign-soft-lavender)',
        ink: 'var(--text-near-white)',
        muted: 'var(--text-muted-lavender)',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '18px',
        '2xl': '24px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(123,97,255,0.5), 0 0 22px -4px rgba(123,97,255,0.55)',
        card: '0 8px 30px -12px rgba(0,0,0,0.6)',
      },
      keyframes: {
        'toast-up': {
          '0%': { transform: 'translateY(120%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: '0.6' },
          '60%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'toast-up': 'toast-up 0.35s cubic-bezier(0.16,1,0.3,1)',
        pop: 'pop 0.3s ease-out',
        'pulse-soft': 'pulseSoft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
