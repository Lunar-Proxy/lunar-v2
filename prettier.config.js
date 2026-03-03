/** @type {import('prettier').Config} */
export default {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  endOfLine: 'lf',
  singleAttributePerLine: true,
  plugins: ['prettier-plugin-astro', 'prettier-plugin-tailwindcss'],
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
        printWidth: 100,
        singleAttributePerLine: true,
      },
    },
    {
      files: ['*.ts', '*.tsx', '*.mts', '*.cts'],
      options: {
        parser: 'typescript',
      },
    },
    {
      files: ['*.js', '*.jsx', '*.mjs', '*.cjs'],
      options: {
        parser: 'babel',
      },
    },
    {
      files: ['*.json', '.prettierrc', 'tsconfig*.json'],
      options: {
        parser: 'json',
        printWidth: 80,
        trailingComma: 'none',
      },
    },
    {
      files: 'package.json',
      options: {
        parser: 'json-stringify',
        printWidth: 80,
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
      },
    },
    {
      files: ['*.html', '*.htm'],
      options: {
        parser: 'html',
        printWidth: 100,
        bracketSameLine: true,
        htmlWhitespaceSensitivity: 'css',
      },
    },
    {
      files: ['*.yaml', '*.yml'],
      options: {
        parser: 'yaml',
        singleQuote: false,
        printWidth: 80,
      },
    },
  ],
};
