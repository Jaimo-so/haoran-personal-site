import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getManagedTools, type ManagedTool } from '@/lib/managed-tools'
import { ToolManager } from './ToolManager'

export const metadata = { title: '工具管理' }

export default async function ToolsPage() {
  let tools: ManagedTool[] = []

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) tools = await getManagedTools(env.DB)
  } catch (error) {
    console.error('Managed tools fetch error:', error)
  }

  return <ToolManager initialTools={tools} />
}
