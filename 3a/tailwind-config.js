tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
    keyframes: { 'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } } },
    animation: { 'fade-up': 'fade-up .35s ease-out' },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Young Serif"', 'Georgia', 'serif']
      },
      colors: {
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        spruce: { DEFAULT: 'rgb(var(--c-spruce) / <alpha-value>)', deep: 'rgb(var(--c-spruce-deep) / <alpha-value>)' },
        marigold: { DEFAULT: 'rgb(var(--c-marigold) / <alpha-value>)', deep: 'rgb(var(--c-marigold-deep) / <alpha-value>)' },
        sage: { DEFAULT: 'rgb(var(--c-sage) / <alpha-value>)', dark: 'rgb(var(--c-sage-dark) / <alpha-value>)' },
        leaf: 'rgb(var(--c-leaf) / <alpha-value>)'
      },
      // Custom Typography themes: "prose-carbon" for light backgrounds, "prose-hero" for the dark hero
      typography: {
        carbon: {
          css: {
            '--tw-prose-body': '#17302D',
            '--tw-prose-headings': '#0F4C47',
            '--tw-prose-lead': '#2B4A46',
            '--tw-prose-links': '#0F4C47',
            '--tw-prose-bold': '#0F4C47',
            '--tw-prose-counters': '#0F4C47',
            '--tw-prose-bullets': '#F2A900',
            '--tw-prose-hr': '#D5E2DA',
            '--tw-prose-quotes': '#0F4C47',
            '--tw-prose-quote-borders': '#F2A900',
            'h1, h2, h3': { fontFamily: '"Young Serif", Georgia, serif', fontWeight: '400', letterSpacing: '-0.01em' }
          }
        },
        hero: {
          css: {
            '--tw-prose-body': '#D5E8E2',
            '--tw-prose-headings': '#FFFFFF',
            '--tw-prose-lead': '#D5E8E2',
            '--tw-prose-links': '#F2A900',
            '--tw-prose-bold': '#FFFFFF',
            '--tw-prose-bullets': '#F2A900',
            'h1, h2, h3': { fontFamily: '"Young Serif", Georgia, serif', fontWeight: '400', letterSpacing: '-0.01em' }
          }
        }
      }
    }
  }
}
