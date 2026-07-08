import { execFileSync } from 'child_process';

// Last-commit date for a source file, for accurate sitemap <lastmod> on static
// pages that have no DB row or frontmatter date. Safe here because production
// deploys are `git pull` on a persistent VPS clone, so .git is always present
// (see docs/reference/SERVER_REFERENCE.md). Falls back to the build time if git is
// unavailable or the file is untracked, so the sitemap can never break.

const buildTime = new Date();

/**
 * @param relPath repo-relative path to the page's source file,
 *   e.g. "app/pricing/page.tsx"
 * @returns the file's last git commit date, or the build time as a fallback.
 */
export function gitLastModified(relPath: string): Date {
  try {
    const out = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', relPath],
      { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (!out) return buildTime;
    const d = new Date(out);
    return Number.isNaN(d.getTime()) ? buildTime : d;
  } catch {
    return buildTime;
  }
}
