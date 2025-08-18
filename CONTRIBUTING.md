# Contributing Guide

Thank you for your interest in contributing to Lunar.

### What you need

- pnpm

### Before creating a pull request

Before creating a pull request, please run `pnpm run precommit` in your
terminal. This will format the code.

### Adding games / apps

An asset is a game or an app.

**To add games or apps, follow this format**:

```json
{
  "name": "Google", // Name of asset
  "image": "/a/images/ap/g.png", // Image of asset
  "link": "https://www.google.com" // URL for asset
}
```

**Files/Folders:**

- Apps & Games → `public/a/json/lists.json`
- Games images: `public/a/images/ga`
- Apps images: `public/a/images/ap`
