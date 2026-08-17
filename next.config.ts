import { resolve } from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

if (process.env.NODE_ENV === 'development') {
  void initOpenNextCloudflareForDev({ remoteBindings: false });
}

const nextConfig: NextConfig = {
  // 图片优化（Cloudflare 有自己的优化）
  images: {
    unoptimized: true,
  },

  turbopack: {
    root: resolve(process.cwd()),
  },

  // 移除客户端环境变量暴露（安全风险）
  // 敏感信息应该只在服务端使用

  // 减少构建时的 worker 数量，避免 MaxListenersExceededWarning
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
