/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // PRD §6.2 palette, single-sourced from CSS variables in theme/tokens.css
        bg: 'rgb(var(--rgb-bg-deep-space) / <alpha-value>)',
        surface: 'rgb(var(--rgb-surface-dark-lifted) / <alpha-value>)',
        primary: 'rgb(var(--rgb-primary-electric-purple) / <alpha-value>)',
        coral: 'rgb(var(--rgb-campaign-hot-coral) / <alpha-value>)',
        mint: 'rgb(var(--rgb-campaign-teal-mint) / <alpha-value>)',
        sunny: 'rgb(var(--rgb-campaign-sunny-yellow) / <alpha-value>)',
        lavender: 'rgb(var(--rgb-campaign-soft-lavender) / <alpha-value>)',
        halfday: 'rgb(var(--rgb-status-half-day) / <alpha-value>)',
        wfh: 'rgb(var(--rgb-status-wfh) / <alpha-value>)',
        ink: 'rgb(var(--rgb-text-near-white) / <alpha-value>)',
        muted: 'rgb(var(--rgb-text-muted-lavender) / <alpha-value>)',
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
        // Carried-over pending work blinks red until it is closed out (v4 change log).
        blinkRed: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'toast-up': 'toast-up 0.35s cubic-bezier(0.16,1,0.3,1)',
        pop: 'pop 0.3s ease-out',
        'pulse-soft': 'pulseSoft 1.8s ease-in-out infinite',
        'blink-red': 'blinkRed 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
