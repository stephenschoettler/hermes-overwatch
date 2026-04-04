import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Catppuccin Mocha base surfaces
        ctp: {
          crust:    'var(--ctp-crust)',
          mantle:   'var(--ctp-mantle)',
          base:     'var(--ctp-base)',
          surface0: 'var(--ctp-surface0)',
          surface1: 'var(--ctp-surface1)',
          surface2: 'var(--ctp-surface2)',
          overlay0: 'var(--ctp-overlay0)',
          overlay1: 'var(--ctp-overlay1)',
          overlay2: 'var(--ctp-overlay2)',
          subtext0: 'var(--ctp-subtext0)',
          subtext1: 'var(--ctp-subtext1)',
          text:     'var(--ctp-text)',
          // Accent palette
          rosewater: 'var(--ctp-rosewater)',
          flamingo:  'var(--ctp-flamingo)',
          pink:      'var(--ctp-pink)',
          mauve:     'var(--ctp-mauve)',
          red:       'var(--ctp-red)',
          maroon:    'var(--ctp-maroon)',
          peach:     'var(--ctp-peach)',
          yellow:    'var(--ctp-yellow)',
          green:     'var(--ctp-green)',
          teal:      'var(--ctp-teal)',
          sky:       'var(--ctp-sky)',
          sapphire:  'var(--ctp-sapphire)',
          blue:      'var(--ctp-blue)',
          lavender:  'var(--ctp-lavender)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
