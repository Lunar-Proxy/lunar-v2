/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  embeddedLanguageFormatting: 'auto',

  plugins: [
    'prettier-plugin-astro',
    'prettier-plugin-tailwindcss',
  ],

  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
        printWidth: 120,
        bracketSameLine: true,
      },
    },
    {
      files: ['*.ts', '*.tsx', '*.mts', '*.cts'],
      options: {
        parser: 'typescript',
        semi: true,
        trailingComma: 'all',
      },
    },
    {
      files: ['*.js', '*.jsx', '*.mjs', '*.cjs'],
      options: {
        parser: 'babel',
        trailingComma: 'es5',
      },
    },
    {
  files: ['*.md', '*.mdx'],
  options: {
    parser: 'markdown',
    printWidth: 80,
    proseWrap: 'preserve',
    singleQuote: false,
    plugins: [],
  },
},
    {
      files: ['*.json', '.prettierrc', 'tsconfig*.json'],
      options: {
        parser: 'json',
        printWidth: 80,
        tabWidth: 2,
        trailingComma: 'none',
      },
    },
    {
      files: 'package.json',
      options: {
        parser: 'json-stringify',
        printWidth: 80,
        tabWidth: 2,
      },
    },
    {
      files: ['*.yaml', '*.yml'],
      options: {
        parser: 'yaml',
        singleQuote: false,
        bracketSpacing: true,
        printWidth: 80,
      },
    },
    {
      files: ['*.css', '*.pcss'],
      options: {
        parser: 'css',
        singleQuote: false,
        printWidth: 120,
      },
    },
    {
      files: ['*.html', '*.htm'],
      options: {
        parser: 'html',
        printWidth: 120,
        bracketSameLine: true,
        htmlWhitespaceSensitivity: 'css',
      },
    },
    {
  files: '*.svg',
  options: {
    parser: 'html',
    printWidth: 120,
    htmlWhitespaceSensitivity: 'ignore',
    plugins: [],
  },
},
    {
      files: ['*.config.ts', 'astro.config.*'],
      options: {
        parser: 'typescript',
        printWidth: 120,
        trailingComma: 'es5',
      },
    },
  ],
};
