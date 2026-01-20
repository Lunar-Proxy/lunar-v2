export function findProvider(port: number) {
  const provider =
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`) ||
    (process.env.RAILWAY_STATIC_URL && `https://${process.env.RAILWAY_STATIC_URL}`) ||
    (process.env.FLY_APP_NAME && `https://${process.env.FLY_APP_NAME}.fly.dev`) ||
    (process.env.DENO_DEPLOYMENT_ID && `https://${process.env.DENO_REGION}.deno.dev`) ||
    (process.env.CODESPACES &&
      `https://${process.env.CODESPACE_NAME}-${port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`) ||
    (process.env.GITPOD_WORKSPACE_URL &&
      process.env.GITPOD_WORKSPACE_URL.replace('https://', `https://${port}-`)) ||
    (process.env.REPL_SLUG &&
      `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev`) ||
    (process.env.REPLIT_DEV_DOMAIN && `https://${process.env.REPLIT_DEV_DOMAIN}`) ||
    (process.env.KOYEB_PUBLIC_DOMAIN && `https://${process.env.KOYEB_PUBLIC_DOMAIN}`) ||
    (process.env.HEROKU_APP_NAME && `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`) ||
    (process.env.ADAPTABLE_APP_URL && process.env.ADAPTABLE_APP_URL) ||
    (process.env.CLEVERCLOUD_APP_DOMAIN && `https://${process.env.CLEVERCLOUD_APP_DOMAIN}`);

  return provider;
}
