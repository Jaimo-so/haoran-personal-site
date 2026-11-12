import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getManagedProjects } from '@/lib/managed-projects'
import { ProjectManager } from './ProjectManager'

export const metadata = { title: '项目管理' }

export default async function ProjectsPage() {
  try {
    const env = await getAppCloudflareEnv()
    if (!env?.DB) throw new Error('数据库不可用')
    const projects = await getManagedProjects(env.DB)
    return <ProjectManager initialProjects={projects} />
  } catch (error) {
    console.error('Managed projects fetch error:', error)
    return (
      <div role="alert" className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-6">
        <h1 className="font-serif text-2xl text-[var(--editor-ink)]">项目管理</h1>
        <p className="mt-3 text-sm text-[var(--editor-muted)]">项目暂时无法加载，请刷新页面重试。</p>
      </div>
    )
  }
}
