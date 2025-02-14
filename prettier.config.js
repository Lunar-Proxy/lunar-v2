/** @type {import("prettier").Config} */
export default {
  plugins: ['prettier-plugin-astro'],
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
    {
      files: '*.ts',
      options: {
        parser: 'typescript',
      },
    },
    {
      files: '*.tsx',
      options: {
        parser: 'typescript',
      },
    },
    {
      files: '*.js',
      options: {
        parser: 'babel',
      },
    },
    {
      files: '*.jsx',
      options: {
        parser: 'babel',
      },
    },
    {
      files: '*.md',
      options: {
        parser: 'markdown',
      },
    },
    {
      files: '*.json',
      options: {
        parser: 'json',
      },
    },
    {
      files: '*.yaml',
      options: {
        parser: 'yaml',
      },
    },
    {
      files: '*.css',
      options: {
        parser: 'css',
      },
    },
    {
      files: '*.scss',
      options: {
        parser: 'scss',
      },
    },
    {
      files: '*.less',
      options: {
        parser: 'less',
      },
    },
    {
      files: '*.html',
      options: {
        parser: 'html',
      },
    },
    {
      files: '*.svg',
      options: {
        parser: 'html',
      },
    },
    {
      files: 'README.md',
      options: {
        parser: 'markdown',
      },
    },
  ],
};
