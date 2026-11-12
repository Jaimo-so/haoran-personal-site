import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { DEFAULT_PERSONAL_CONTENT, getPersonalContent } from '@/lib/personal-content'
import { ContentManager } from './ContentManager'

export const metadata = { title: '站点文案' }

export default async function ContentPage() {
  let content = structuredClone(DEFAULT_PERSONAL_CONTENT)
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) content = await getPersonalContent(env.DB)
  } catch (error) {
    console.error('Content page: failed to fetch site content', error)
  }

  return <ContentManager initialContent={content} />
}
