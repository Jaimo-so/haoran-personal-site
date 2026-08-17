import type { AiPostGeneratorRow, AiPostGeneratorTarget } from '@/lib/ai-post-generator/types'

export const WORKERS_AI_TEXT_MODEL_SUGGESTIONS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/openai/gpt-oss-20b',
  '@cf/openai/gpt-oss-120b',
  '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
  '@cf/nvidia/nemotron-3-120b-a12b',
]

export const WORKERS_AI_IMAGE_MODEL_SUGGESTIONS = [
  '@cf/black-forest-labs/flux-1-schnell',
  '@cf/stabilityai/stable-diffusion-xl-base-1.0',
  '@cf/lykon/dreamshaper-8-lcm',
  '@cf/black-forest-labs/flux-1-schnell/fp8',
  '@cf/lykon/dreamshaper-xl-1-0',
  '@cf/bytedance/stable-diffusion-xl-lightning',
  '@cf/flux-1-schnell',
  '@cf/flux-1-schnell/fp8',
]

export const DEFAULT_TEXT_WORKERS_MODEL = '@cf/meta/llama-3.1-8b-instruct'
export const DEFAULT_IMAGE_WORKERS_MODEL = '@cf/black-forest-labs/flux-1-schnell'
export const MAX_CONTEXT_LENGTH = 4000
export const MAX_TAGS = 5
export const MAX_SUMMARY_LENGTH = 160
export const MAX_COVER_PROMPT_LENGTH = 1800
export const MAX_COVER_TITLE_LENGTH = 160
export const MAX_COVER_DESCRIPTION_LENGTH = 220
export const MAX_COVER_TAGS_LENGTH = 180
export const MAX_COVER_BRIEF_LENGTH = 720

export const LEGACY_PROMPT_VARIANTS: Partial<Record<AiPostGeneratorTarget, string[]>> = {
  summary: [
    '你是专业中文编辑。请基于文章标题、分类、标签和正文，输出一个适合博客列表与 SEO 描述使用的中文摘要。要求信息密度高、准确、自然，不要空话，不要标题党，不要加引号。',
    '你是资深中文编辑和 SEO 内容策划。请优先根据文章标题提炼主题，再结合正文前几段的关键信息，写一个适合博客列表、搜索摘要和分享卡片的中文摘要。要求：1. 必须准确点明文章在讲什么，尽量保留具体主题词；2. 像编辑写导语，不要像 AI 总结，不要出现“本文/这篇文章/文章介绍了”等套话；3. 不空泛、不喊口号、不标题党；4. 用自然中文写成一段完整短摘要，必要时可带一点结果或价值点；5. 不要加引号，不要分点。',
  ],
  tags: [
    '你是专业中文编辑。请基于文章信息提取最有区分度的中文标签，偏主题词和领域词，避免空泛词、句子和重复词。',
    '你是中文编辑。请从标题和正文中提取 3-6 个最能代表主题、对象、方法、观点或领域的中文标签。优先具体概念、专有主题和有辨识度的词组，避免空泛大词、整句、重复词和泛泛分类词；除非文章核心就是它，否则尽量少用“思考”“方法”“问题”这类过宽的标签。',
  ],
  slug: [
    'You are an expert editor. Generate a short English slug for a blog post. Use only lowercase English words and hyphens. Keep it specific, readable, and concise. Do not include dates unless necessary.',
    'You are an experienced editor creating English slugs for blog posts. Derive the slug from the title first, then use the article context only to disambiguate the core meaning. Capture the main topic or claim, not a literal full translation of every word. Prefer 2-6 concise lowercase English words, joined by hyphens. Keep it specific, readable, and searchable. Do not include dates, stop words, filler words, or pinyin unless there is no better English term.',
    'You are an experienced editor creating English slugs for blog posts. Use the title as the primary source of meaning and translate the core topic into natural English when needed. Use the article body only to clarify ambiguity. Return one concise, readable, search-friendly lowercase slug in kebab-case. Avoid dates, filler words, pinyin, and prefixes like "slug:".',
  ],
}

export const DEFAULT_GENERATORS: Array<Omit<AiPostGeneratorRow, 'id' | 'created_at' | 'updated_at'>> = [
  {
    target_key: 'summary',
    label: '摘要生成',
    description: '为文章生成 160 字以内摘要',
    prompt: '你是资深中文编辑。请根据文章标题和正文内容，写一段会让人想继续读下去的中文摘要。重点不是机械概括，而是先提炼文章真正讨论的问题、矛盾、反常识点或关键洞见，再用自然导语式语言把读者带进去。要求：1. 必须忠于正文，不夸张、不编造；2. 尽量保留具体主题词，让人一眼知道文章在讲什么；3. 像高质量专栏导语，不要像 AI 总结，不要出现“本文/这篇文章/作者认为”等套话；4. 可以保留一点张力或悬念，但不能标题党；5. 输出一段完整中文，不要分点，不要加引号。',
    provider_mode: 'workers_ai',
    text_profile_id: null,
    image_profile_id: null,
    workers_model: DEFAULT_TEXT_WORKERS_MODEL,
    temperature: 0.4,
    max_tokens: 220,
    aspect_ratio: '16:9',
    resolution: '2k',
    is_enabled: 1,
    is_builtin: 1,
  },
  {
    target_key: 'tags',
    label: '标签生成',
    description: '提取 3-5 个简洁标签',
    prompt: '你是中文编辑。请优先根据正文主线，再结合标题校准语义，提取 3-5 个最能代表主题、对象、方法、技术、产品、人物、议题或领域的中文标签。优先具体概念、专有主题和有辨识度的短词，避免空泛大词、整句、重复词、泛泛分类词，以及“思考”“方法”“问题”这类过宽标签。',
    provider_mode: 'workers_ai',
    text_profile_id: null,
    image_profile_id: null,
    workers_model: DEFAULT_TEXT_WORKERS_MODEL,
    temperature: 0.3,
    max_tokens: 180,
    aspect_ratio: '16:9',
    resolution: '2k',
    is_enabled: 1,
    is_builtin: 1,
  },
  {
    target_key: 'slug',
    label: 'Slug 生成',
    description: '生成英文 kebab-case slug',
    prompt: 'You are an experienced editor creating English slugs for blog posts. Use the title as the primary source of meaning. If the title is in Chinese, translate only the core topic into natural English instead of transliterating it. Use the article body only to clarify ambiguity. Return exactly one concise, readable, search-friendly lowercase slug in kebab-case, usually 2-5 words. Do not include dates, filler words, pinyin, quotes, or any prefix such as "slug:".',
    provider_mode: 'workers_ai',
    text_profile_id: null,
    image_profile_id: null,
    workers_model: DEFAULT_TEXT_WORKERS_MODEL,
    temperature: 0.2,
    max_tokens: 80,
    aspect_ratio: '16:9',
    resolution: '2k',
    is_enabled: 1,
    is_builtin: 1,
  },
  {
    target_key: 'cover',
    label: '封面生成',
    description: '生成博客封面图',
    prompt: '你是资深视觉总监。请把文章核心观点转化成一张适合作为中文长文封面的图像：构图明确、主视觉单一、气质现代、有 editorial illustration / concept poster 的完成度。默认不要在图中出现任何可读文字、logo、签名或水印。',
    provider_mode: 'workers_ai',
    text_profile_id: null,
    image_profile_id: null,
    workers_model: DEFAULT_IMAGE_WORKERS_MODEL,
    temperature: 0.7,
    max_tokens: 2000,
    aspect_ratio: '16:9',
    resolution: '2k',
    is_enabled: 1,
    is_builtin: 1,
  },
]
