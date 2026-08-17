import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function getAppCloudflareContext() {
  return getCloudflareContext({ async: true })
}

export async function getAppCloudflareEnv() {
  return (await getAppCloudflareContext()).env
}
