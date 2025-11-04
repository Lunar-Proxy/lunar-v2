import { execSync } from 'child_process';

export function updateChecker() {
  try {
    const status = execSync('git status -uno', { encoding: 'utf8' }).trim();
    const commitId = execSync('git log -1 --format=%H', { encoding: 'utf8' }).trim();

    if (status.includes('Your branch is up to date with')) return { status: 'u', commitId };
    if (status.includes('Your branch is behind')) return { status: 'n', commitId };

    return { status: '?????', commitId };
  } catch {
    console.error('[ERROR] To see if lunar is updated, please install git.');
    return { status: '-', commitId: 'unknown' };
  }
}
