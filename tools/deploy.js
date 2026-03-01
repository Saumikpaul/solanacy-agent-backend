/**
 * ARIA v4.0 — Deploy Tool
 * Deploy to Vercel, Netlify via API
 * (Requires user to add tokens in .env)
 */

const VERCEL_TOKEN  = process.env.VERCEL_TOKEN;
const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;

/**
 * Deploy to Vercel (requires VERCEL_TOKEN in .env)
 */
export async function deployVercel({ projectName, repoUrl, framework = 'nextjs' }) {
  if (!VERCEL_TOKEN) {
    return {
      error: 'VERCEL_TOKEN not set',
      hint: 'Add VERCEL_TOKEN to .env — get it from vercel.com/account/tokens',
    };
  }

  try {
    const res = await fetch('https://api.vercel.com/v1/projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        framework,
        gitRepository: repoUrl ? { url: repoUrl, type: 'github' } : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) return { error: `Vercel error: ${data.error?.message || res.status}` };

    return {
      projectId: data.id,
      projectName: data.name,
      url: `https://${data.name}.vercel.app`,
      dashboard: `https://vercel.com/dashboard`,
    };

  } catch (e) {
    return { error: `Deploy error: ${e.message}` };
  }
}

/**
 * Get deploy status
 */
export async function getDeployStatus({ provider = 'vercel', projectId }) {
  if (provider === 'vercel') {
    if (!VERCEL_TOKEN) return { error: 'VERCEL_TOKEN not set' };

    try {
      const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`, {
        headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` },
      });
      const data = await res.json();
      const latest = data.deployments?.[0];
      if (!latest) return { status: 'no deployments found' };

      return {
        status: latest.state,
        url: latest.url ? `https://${latest.url}` : null,
        createdAt: latest.createdAt,
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  return { error: `Unknown provider: ${provider}` };
}

/**
 * Generate GitHub Actions deploy workflow
 */
export function generateGitHubActionsWorkflow({ platform = 'vercel', projectType = 'node' }) {
  const workflows = {
    vercel: `name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
        env:
          NODE_ENV: production
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'`,

    netlify: `name: Deploy to Netlify
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci && npm run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=dist
        env:
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_TOKEN }}`,
  };

  return { workflow: workflows[platform] || workflows.vercel };
}
