/** Keep older projects with a GitHub URL in link_url working after adding two destinations. */
export function getProjectLinks(project: { link_url: string; github_url?: string }) {
  const existing = project.link_url.trim()
  let existingIsGitHub = false
  try {
    existingIsGitHub = ['github.com', 'www.github.com'].includes(new URL(existing).hostname.toLowerCase())
  } catch {}
  return {
    website: existingIsGitHub ? '' : existing,
    github: project.github_url?.trim() || (existingIsGitHub ? existing : ''),
  }
}
