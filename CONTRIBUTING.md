# Contributing Guide

Thank you for your interest in contributing to Lunar.

### Before doing a pull request

Run this command in the terminal before making a pull request to check for errors: ```pnpm run precommit```

### Adding games / apps

The asset is refering to games or apps.

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
