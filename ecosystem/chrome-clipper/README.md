# Qiaomu Blog Clipper

一键把网页内容剪藏到你自己的 Qiaomu Blog 草稿箱。

## 功能

- 使用 Readability.js 提取网页正文内容
- 用 Turndown 将 HTML 转换为 Markdown
- 自动下载文章中的图片并上传到博客 R2 存储
- 替换图片链接为 R2 地址
- 一键发布为草稿，附带原文链接
- 发布后可直接跳转到后台编辑

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目目录

## 配置

1. 点击扩展图标
2. 首次使用会自动进入设置页面
3. 填写：
   - **API URL**: `https://your-domain.com`（你的博客地址）
   - **API Token**: 后台生成的 API Token
4. 点击保存

## 使用

1. 打开任意网页文章
2. 点击扩展图标
3. 点击「剪藏到草稿」
4. 等待提取、上传图片、创建草稿
5. 完成后点击「去编辑」跳转到后台

## 技术栈

- Chrome Extension Manifest V3
- [Readability.js](https://github.com/mozilla/readability) - Mozilla 的正文提取库
- [Turndown](https://github.com/mixmark-io/turndown) - HTML 转 Markdown
- 纯 JavaScript，无需构建步骤
