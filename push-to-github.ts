import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

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

const OWNER = 'TakumaMaruyama';
const REPO = 'swim-track';

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.replit',
  'push-to-github.ts',
  'replit.nix',
  '.config',
  '.cache',
  'dist',
  '.upm',
  'generated-icon.png',
  'IMG_3701.jpeg',
  'Pasted-import',
  'attached_assets',
  'snippets',
  'replit.md',
  'replit_zip_error_log.txt',
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.startsWith(pattern) || filePath.includes('/' + pattern));
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldIgnore(relativePath)) continue;
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip'];
  return binaryExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
}

async function main() {
  console.log('Getting GitHub access token...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  console.log('Getting current repository state...');
  
  let currentCommitSha: string | undefined;
  let currentTreeSha: string | undefined;
  let isEmpty = false;
  
  try {
    const { data: ref } = await octokit.git.getRef({
      owner: OWNER,
      repo: REPO,
      ref: 'heads/main',
    });
    currentCommitSha = ref.object.sha;
    
    const { data: commit } = await octokit.git.getCommit({
      owner: OWNER,
      repo: REPO,
      commit_sha: currentCommitSha,
    });
    currentTreeSha = commit.tree.sha;
    console.log(`Current commit: ${currentCommitSha}`);
  } catch (e: any) {
    if (e.status === 404 || e.status === 409) {
      console.log('Repository is empty, initializing...');
      isEmpty = true;
      
      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: '.gitkeep',
        message: 'Initialize repository',
        content: Buffer.from('').toString('base64'),
      });
      
      currentCommitSha = data.commit.sha!;
      const { data: commitData } = await octokit.git.getCommit({
        owner: OWNER,
        repo: REPO,
        commit_sha: currentCommitSha,
      });
      currentTreeSha = commitData.tree.sha;
      console.log(`Initialized with commit: ${currentCommitSha}`);
    } else {
      throw e;
    }
  }

  const workDir = '/home/runner/workspace';
  const files = getAllFiles(workDir);
  console.log(`Found ${files.length} files to push`);

  console.log('Creating blobs...');
  const treeItems: any[] = [];
  
  for (const file of files) {
    const fullPath = path.join(workDir, file);
    const isBinary = isBinaryFile(file);
    
    let content: string;
    let encoding: 'utf-8' | 'base64';
    
    if (isBinary) {
      content = fs.readFileSync(fullPath).toString('base64');
      encoding = 'base64';
    } else {
      content = fs.readFileSync(fullPath, 'utf-8');
      encoding = 'utf-8';
    }

    const { data: blob } = await octokit.git.createBlob({
      owner: OWNER,
      repo: REPO,
      content,
      encoding,
    });

    treeItems.push({
      path: file,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blob.sha,
    });
    
    if (treeItems.length % 20 === 0) {
      console.log(`  ${treeItems.length}/${files.length} blobs created...`);
    }
  }
  console.log(`All ${treeItems.length} blobs created.`);

  console.log('Creating tree...');
  const { data: tree } = await octokit.git.createTree({
    owner: OWNER,
    repo: REPO,
    tree: treeItems,
    ...(currentTreeSha ? { base_tree: undefined } : {}),
  });

  console.log('Creating commit...');
  const { data: newCommit } = await octokit.git.createCommit({
    owner: OWNER,
    repo: REPO,
    message: 'Sync from Replit',
    tree: tree.sha,
    ...(currentCommitSha ? { parents: [currentCommitSha] } : { parents: [] }),
  });

  console.log('Updating ref...');
  try {
    await octokit.git.updateRef({
      owner: OWNER,
      repo: REPO,
      ref: 'heads/main',
      sha: newCommit.sha,
      force: true,
    });
  } catch (e: any) {
    if (e.status === 422) {
      await octokit.git.createRef({
        owner: OWNER,
        repo: REPO,
        ref: 'refs/heads/main',
        sha: newCommit.sha,
      });
    } else {
      throw e;
    }
  }

  console.log(`Successfully pushed to https://github.com/${OWNER}/${REPO}`);
  console.log(`Commit SHA: ${newCommit.sha}`);
}

main().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
