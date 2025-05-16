# Contributing Guide

Thank you for your interest in contributing to Lunar.

### Before creating a pull request

Before creating a pull request, please run `pnpm run precommit` in your terminal.

### Adding games / apps

An asset is a game or an app.

**To add games or apps, follow this format**:
```json
{
  "name": "Google", // Name of asset
  "image": "/assets/images/assets/g.png", // Image of asset
  "link": "https://www.google.com" // URL for asset
}
```

**Files:**
- Apps → ```public/a/json/al.json```
- Games → ```public/a/json/gl.json```
