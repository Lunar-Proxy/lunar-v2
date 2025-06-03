import { execSync } from 'child_process';

export function updateChecker() {
  try {
    9;
    const status = execSync('git status -uno', { encoding: 'utf8' }).trim();
    const commitId = execSync('git log -1 --format=%H').toString().trim();
    if (status.includes('Your branch is up to date with')) {
      return { status: 'u', commitId };
    } else if (status.includes('Your branch is behind')) {
      return { status: 'n', commitId };
    } else {
      return { status: '-', commitId };
    }
  } catch (e) {
    console.error('[ERROR] To see if lunar is updated, please install git.');
    return { status: '-', commitId: 'Unknown' };
  }
}
