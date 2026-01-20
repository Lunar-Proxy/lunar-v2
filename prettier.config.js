/** @type {import('prettier').Config} */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
        printWidth: 120,
        bracketSpacing: true,
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
      files: ['*.md', '*.mdx'],
      options: {
        parser: 'markdown',
        printWidth: 80,
        proseWrap: 'preserve',
        singleQuote: false,
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
      files: ['*.yaml', '*.yml'],
      options: {
        parser: 'yaml',
        singleQuote: false,
        bracketSpacing: true,
        printWidth: 80,
      },
    },
  ],
};
