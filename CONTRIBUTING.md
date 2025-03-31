# Contributing Guide

Thank you for your interest in contributing to Lunar.

# Before doing a PR (Pull Request)

Before you think about doing a PR (Pull Request), go into your terminal and run
`pnpm run precommit`. This will check for errors in the code.

# Adding games / apps

To add games or apps, follow this format:

In this, asset is refering to games or apps

```json
{
  "name": "Google", // Name of asset
  "image": "/assets/images/assets/g.png", // Image of asset
  "link": "https://www.google.com" // URL for asset
}
```

The asset list can be found in public/a/json/. Inside that folder,

`al.json` is the list of apps

`gl.json` is the list of games.
