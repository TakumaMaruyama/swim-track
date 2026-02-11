import { execSync } from 'child_process';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function main() {
  console.log('Getting GitHub access token...');
  const token = await getAccessToken();
  
  const remoteUrl = `https://x-access-token:${token}@github.com/TakumaMaruyama/swim-track.git`;
  
  console.log('Pushing to GitHub...');
  try {
    execSync(`git push "${remoteUrl}" HEAD:main --force`, {
      cwd: '/home/runner/workspace',
      stdio: 'inherit',
      timeout: 60000,
    });
    console.log('Successfully pushed to https://github.com/TakumaMaruyama/swim-track');
  } catch (err: any) {
    console.error('Push failed:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
