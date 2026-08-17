export const PERSONAL_SITE = {
  siteName: 'HaoRan',
  ownerName: '你的名字',
  role: 'AI Builder',
  headline: '把 AI 能力，变成用户愿意使用的产品。',
  introduction:
    '我关注生成式 AI、用户体验与产品增长，也在持续记录产品拆解、原型实验和学习复盘。',
  description: '一名 2027 届本科生的 AI 产品作品、思考与成长记录。',
} as const

export const PERSONAL_TOOLKIT = [
  {
    index: '01',
    title: 'AI 研究与分析',
    tools: 'ChatGPT · Perplexity',
    description: '快速建立信息地图、对比竞品与校验关键假设，把零散信息转化为可行动的产品判断。',
  },
  {
    index: '02',
    title: '原型与开发',
    tools: 'Figma · Cursor',
    description: '把需求与交互思路快速变成可操作原型，通过真实体验验证关键路径。',
  },
  {
    index: '03',
    title: '知识与协作',
    tools: '飞书 · Notion',
    description: '沉淀调研、需求、决策与复盘，让项目过程可追溯、可协作、可复用。',
  },
] as const

export const PERSONAL_NAV_LINKS = [
  { label: '关于', url: '/about', openInNewTab: false },
  { label: '文章', url: '/#writing', openInNewTab: false },
  { label: '项目', url: '/#work', openInNewTab: false },
  { label: 'RSS', url: '/feed.xml', openInNewTab: false },
] as const
