declare module './.open-next/worker.js' {
  const handler: {
    fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response
  }

  export default handler
  export const DOQueueHandler: unknown
  export const DOShardedTagCache: unknown
}
