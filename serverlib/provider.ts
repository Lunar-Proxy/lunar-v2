export function findProvider(port: number) {
  const provider =
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    (process.env.RAILWAY_STATIC_URL && `https://${process.env.RAILWAY_STATIC_URL}`) ||
    (process.env.FLY_APP_NAME && `https://${process.env.FLY_APP_NAME}.fly.dev`) ||
    (process.env.CODESPACES &&
      `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`) ||
    (process.env.GITPOD_WORKSPACE_URL &&
      process.env.GITPOD_WORKSPACE_URL.replace('https://', `https://${port}-`)) ||
    (process.env.REPL_ID && `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`) ||
    (process.env.KOYEB_APP_NAME && `https://${process.env.KOYEB_APP_NAME}.koyeb.app`) ||
    (process.env.GLITCH_PROJECT_ID && `https://${process.env.PROJECT_DOMAIN}.glitch.me`) ||
    (process.env.HEROKU_APP_NAME && `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`) ||
    (process.env.NETLIFY_DEV === 'true' && process.env.SITE_URL);
  return provider;
}
