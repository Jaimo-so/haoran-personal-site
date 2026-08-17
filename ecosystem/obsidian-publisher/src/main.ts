import {
  Plugin,
  Notice,
  TFile,
  requestUrl,
  MarkdownView,
} from "obsidian";
import {
  QmblogSettings,
  DEFAULT_SETTINGS,
  QmblogSettingTab,
} from "./settings";
import { PublishModal, PublishOptions, PublishResult } from "./publish-modal";

// Media file extensions
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
const AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];
const VIDEO_EXTS = ["mp4", "webm", "mov", "avi", "mkv"];
const MEDIA_EXTS = [...IMAGE_EXTS, ...AUDIO_EXTS, ...VIDEO_EXTS];

interface UploadResult {
  success: boolean;
  url?: string;
  type?: string;
  name?: string;
  error?: string;
}

interface PostResult {
  success: boolean;
  slug?: string;
  id?: number;
  error?: string;
}

export default class QmblogPublisher extends Plugin {
  settings: QmblogSettings = DEFAULT_SETTINGS;
  private statusBarEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    // 1. Ribbon icon (left sidebar)
    this.addRibbonIcon("upload-cloud", "发布到 Qiaomu Blog", async () => {
      await this.publishCurrentNote();
    });

    // 2. Command palette
    this.addCommand({
      id: "publish-to-qiaomu-blog",
      name: "发布到 Qiaomu Blog",
      editorCallback: () => {
        this.publishCurrentNote();
      },
    });

    // 3. Status bar (bottom)
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.setText("Qiaomu Blog");
    this.statusBarEl.addClass("mod-clickable");
    this.statusBarEl.onClickEvent(() => {
      this.publishCurrentNote();
    });

    // 4. Editor context menu (right-click in editor)
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu) => {
        menu.addItem((item) => {
          item
            .setTitle("发布到 Qiaomu Blog")
            .setIcon("upload-cloud")
            .onClick(() => this.publishCurrentNote());
        });
      })
    );

    // 5. File menu (right-click on file in explorer)
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFile && file.extension === "md") {
          menu.addItem((item) => {
            item
              .setTitle("发布到 Qiaomu Blog")
              .setIcon("upload-cloud")
              .onClick(() => this.publishFile(file));
          });
        }
      })
    );

    // Settings tab
    this.addSettingTab(new QmblogSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ─── Status Bar Helpers ──────────────────────────────────

  private setStatus(text: string, revertMs?: number) {
    if (!this.statusBarEl) return;
    this.statusBarEl.setText(text);
    if (revertMs) {
      setTimeout(() => {
        if (this.statusBarEl) this.statusBarEl.setText("Qiaomu Blog");
      }, revertMs);
    }
  }

  // ─── Publish Entry Points ────────────────────────────────

  /**
   * Publish the currently active markdown note
   */
  async publishCurrentNote() {
    if (!this.settings.apiToken) {
      new Notice("请先在设置中配置 API Token");
      return;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.file) {
      new Notice("请先打开一个 Markdown 文件");
      return;
    }

    const file = activeView.file;
    const content = await this.app.vault.read(file);
    const title = this.extractTitle(content, file);

    this.openPublishModal(file, content, title);
  }

  /**
   * Publish a specific file (from file explorer context menu)
   */
  async publishFile(file: TFile) {
    if (!this.settings.apiToken) {
      new Notice("请先在设置中配置 API Token");
      return;
    }

    const content = await this.app.vault.read(file);
    const title = this.extractTitle(content, file);

    this.openPublishModal(file, content, title);
  }

  /**
   * Open the publish modal for a given file
   */
  private openPublishModal(file: TFile, content: string, title: string) {
    const modal = new PublishModal(
      this.app,
      this,
      title,
      async (options, onProgress) => {
        this.setStatus("Qiaomu Blog \u23F3");
        try {
          const result = await this.doPublish(file, content, options, onProgress);
          if (result.success) {
            this.setStatus("Qiaomu Blog \u2713", 3000);
          } else {
            this.setStatus("Qiaomu Blog \u2717", 5000);
          }
          return result;
        } catch (e) {
          this.setStatus("Qiaomu Blog \u2717", 5000);
          throw e;
        }
      }
    );
    modal.open();
  }

  // ─── Publish Logic ───────────────────────────────────────

  /**
   * Execute the actual publish flow. Called from the modal.
   */
  async doPublish(
    file: TFile,
    content: string,
    options: PublishOptions,
    onProgress: (msg: string) => void
  ): Promise<PublishResult> {
    onProgress("正在准备文件...");

    // 1. Strip YAML frontmatter from content for publishing
    const bodyContent = this.stripFrontmatter(content);

    // 2. Collect all media references (local + remote)
    const localRefs = this.findLocalMediaRefs(bodyContent, file);
    const remoteRefs = this.findRemoteImageRefs(bodyContent);
    const totalFiles = localRefs.length + remoteRefs.length;

    let processedContent = bodyContent;
    let uploadedCount = 0;
    let failedCount = 0;

    // 3. Upload local files
    for (const ref of localRefs) {
      uploadedCount++;
      if (totalFiles > 0) {
        onProgress(`正在上传文件 ${uploadedCount}/${totalFiles}...`);
      }

      try {
        const fileData = await this.readLocalFile(ref.resolvedPath);
        if (!fileData) {
          failedCount++;
          continue;
        }

        const result = await this.uploadFile(
          fileData.buffer,
          fileData.name,
          fileData.mimeType
        );

        if (result.success && result.url) {
          const fullUrl = this.toAbsoluteUrl(result.url);
          processedContent = processedContent.split(ref.original).join(
            ref.isWikilink
              ? `![${fileData.name}](${fullUrl})`
              : ref.original.replace(ref.src, fullUrl)
          );
        } else {
          failedCount++;
        }
      } catch (e) {
        console.error(`Failed to upload local file: ${ref.src}`, e);
        failedCount++;
      }
    }

    // 4. Re-upload remote images
    for (const ref of remoteRefs) {
      uploadedCount++;
      if (totalFiles > 0) {
        onProgress(`正在上传文件 ${uploadedCount}/${totalFiles}...`);
      }

      try {
        const downloaded = await this.downloadRemoteImage(ref.src);
        if (!downloaded) {
          failedCount++;
          continue;
        }

        const result = await this.uploadFile(
          downloaded.buffer,
          downloaded.name,
          downloaded.mimeType
        );

        if (result.success && result.url) {
          const fullUrl = this.toAbsoluteUrl(result.url);
          processedContent = processedContent.split(ref.src).join(fullUrl);
        } else {
          failedCount++;
        }
      } catch (e) {
        console.error(`Failed to re-upload remote image: ${ref.src}`, e);
        failedCount++;
      }
    }

    // 5. Create post
    onProgress("正在创建文章...");
    const postResult = await this.createPost(
      options.title,
      processedContent,
      options.status,
      options.category
    );

    if (postResult.success) {
      return {
        success: true,
        slug: postResult.slug,
        uploadedCount: totalFiles - failedCount,
        failedCount,
        totalFiles,
      };
    } else {
      return {
        success: false,
        error: postResult.error || "未知错误",
        uploadedCount: totalFiles - failedCount,
        failedCount,
        totalFiles,
      };
    }
  }

  // ─── Content Helpers ─────────────────────────────────────

  /**
   * Extract title: YAML frontmatter title > first # heading > filename
   */
  extractTitle(content: string, file: TFile): string {
    // Try YAML frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const titleMatch = fmMatch[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
      if (titleMatch) {
        return titleMatch[1].trim();
      }
    }

    // Try first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }

    // Fallback to filename
    return file.basename;
  }

  /**
   * Strip YAML frontmatter from content
   */
  stripFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n*/, "");
  }

  /**
   * Find local media references in markdown
   * Matches: ![alt](./path) ![alt](path) ![[wikilink.png]]
   */
  findLocalMediaRefs(
    content: string,
    sourceFile: TFile
  ): Array<{
    original: string;
    src: string;
    resolvedPath: string;
    isWikilink: boolean;
  }> {
    const refs: Array<{
      original: string;
      src: string;
      resolvedPath: string;
      isWikilink: boolean;
    }> = [];
    const seen = new Set<string>();

    // Standard markdown: ![alt](path) or ![alt](<path with spaces>)
    const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = mdRegex.exec(content)) !== null) {
      let src = match[2].trim();

      // Strip angle brackets: <../path/to/file.png> → ../path/to/file.png
      if (src.startsWith("<") && src.endsWith(">")) {
        src = src.slice(1, -1);
      }

      // Skip URLs (http/https) and already-uploaded qmblog URLs
      if (src.startsWith("http://") || src.startsWith("https://")) {
        continue;
      }
      // Skip data URIs
      if (src.startsWith("data:")) {
        continue;
      }

      if (seen.has(src)) continue;
      seen.add(src);

      const ext = src.split(".").pop()?.toLowerCase() || "";
      if (!MEDIA_EXTS.includes(ext)) continue;

      const resolvedPath = this.resolveLocalPath(src, sourceFile);
      if (resolvedPath) {
        refs.push({
          original: match[0],
          src,
          resolvedPath,
          isWikilink: false,
        });
      }
    }

    // Obsidian wikilinks: ![[file.png]] or ![[file.png|alt]]
    const wikiRegex = /!\[\[([^\]|]+?)(?:\|[^\]]*)?\]\]/g;
    while ((match = wikiRegex.exec(content)) !== null) {
      const linkPath = match[1].trim();

      if (seen.has(linkPath)) continue;
      seen.add(linkPath);

      const ext = linkPath.split(".").pop()?.toLowerCase() || "";
      if (!MEDIA_EXTS.includes(ext)) continue;

      const resolved = this.resolveWikilink(linkPath, sourceFile);
      if (resolved) {
        refs.push({
          original: match[0],
          src: linkPath,
          resolvedPath: resolved,
          isWikilink: true,
        });
      }
    }

    return refs;
  }

  /**
   * Find remote (non-qmblog) image URLs in markdown
   */
  findRemoteImageRefs(
    content: string
  ): Array<{ original: string; src: string }> {
    const refs: Array<{ original: string; src: string }> = [];
    const seen = new Set<string>();
    const apiHost = new URL(this.settings.apiUrl).host;

    // Standard markdown images with http(s) URLs
    const mdRegex = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = mdRegex.exec(content)) !== null) {
      const src = match[2].trim();

      // Skip qmblog URLs - already hosted
      try {
        const url = new URL(src);
        if (url.host === apiHost) continue;
      } catch {
        continue;
      }

      if (seen.has(src)) continue;
      seen.add(src);

      // Only process image URLs
      const ext = src.split("?")[0].split(".").pop()?.toLowerCase() || "";
      if (IMAGE_EXTS.includes(ext) || this.looksLikeImageUrl(src)) {
        refs.push({ original: match[0], src });
      }
    }

    return refs;
  }

  /**
   * Heuristic: does a URL look like an image?
   */
  looksLikeImageUrl(url: string): boolean {
    const lower = url.toLowerCase();
    return (
      lower.includes("/image") ||
      lower.includes("img") ||
      lower.includes("photo") ||
      lower.includes("pic") ||
      lower.includes("screenshot") ||
      lower.includes("imgur.com") ||
      lower.includes("i.redd.it") ||
      lower.includes("pbs.twimg.com")
    );
  }

  /**
   * Resolve a relative path from the source file's directory
   */
  resolveLocalPath(src: string, sourceFile: TFile): string | null {
    // Decode URL-encoded characters (%20 → space, etc.)
    let cleaned = decodeURIComponent(src);
    // Remove leading ./
    cleaned = cleaned.replace(/^\.\//, "");

    // Get parent folder path
    const parentPath = sourceFile.parent?.path || "";

    // Handle ../ relative paths
    const baseParts = parentPath.split("/");
    const srcParts = cleaned.split("/");
    while (srcParts[0] === "..") {
      srcParts.shift();
      baseParts.pop();
    }
    const fullPath = [...baseParts, ...srcParts].filter(Boolean).join("/");

    // Check if file exists in vault
    const file = this.app.vault.getAbstractFileByPath(fullPath);
    if (file instanceof TFile) {
      return file.path;
    }

    // Try without parent (root-relative)
    const rootFile = this.app.vault.getAbstractFileByPath(cleaned);
    if (rootFile instanceof TFile) {
      return rootFile.path;
    }

    return null;
  }

  /**
   * Resolve Obsidian wikilink to vault file path
   */
  resolveWikilink(linkPath: string, sourceFile: TFile): string | null {
    const resolved = this.app.metadataCache.getFirstLinkpathDest(
      linkPath,
      sourceFile.path
    );
    if (resolved instanceof TFile) {
      return resolved.path;
    }
    return null;
  }

  /**
   * Read a local vault file as binary
   */
  async readLocalFile(
    vaultPath: string
  ): Promise<{ buffer: ArrayBuffer; name: string; mimeType: string } | null> {
    const file = this.app.vault.getAbstractFileByPath(vaultPath);
    if (!(file instanceof TFile)) {
      return null;
    }

    const buffer = await this.app.vault.readBinary(file);
    const ext = file.extension.toLowerCase();
    const mimeType = this.getMimeType(ext);

    return {
      buffer,
      name: file.name,
      mimeType,
    };
  }

  /**
   * Download a remote image
   */
  async downloadRemoteImage(
    url: string
  ): Promise<{ buffer: ArrayBuffer; name: string; mimeType: string } | null> {
    try {
      const response = await requestUrl({
        url,
        method: "GET",
      });

      const contentType =
        response.headers["content-type"] || "image/png";
      const ext = this.extFromMime(contentType);
      const urlPath = new URL(url).pathname;
      const urlName = urlPath.split("/").pop() || `image.${ext}`;
      // Ensure the name has an extension
      const name = urlName.includes(".") ? urlName : `${urlName}.${ext}`;

      return {
        buffer: response.arrayBuffer,
        name,
        mimeType: contentType.split(";")[0].trim(),
      };
    } catch (e) {
      console.error(`Failed to download remote image: ${url}`, e);
      return null;
    }
  }

  /**
   * Upload a file to qmblog R2 via /api/uploads
   */
  async uploadFile(
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string
  ): Promise<UploadResult> {
    // Build multipart form data manually for Obsidian's requestUrl
    const boundary = "----ObsidianQmblog" + Date.now().toString(36);
    const uint8 = new Uint8Array(buffer);

    // Build the multipart body
    const header =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const headerBytes = new TextEncoder().encode(header);
    const footerBytes = new TextEncoder().encode(footer);

    const body = new Uint8Array(
      headerBytes.length + uint8.length + footerBytes.length
    );
    body.set(headerBytes, 0);
    body.set(uint8, headerBytes.length);
    body.set(footerBytes, headerBytes.length + uint8.length);

    const response = await requestUrl({
      url: `${this.settings.apiUrl}/api/uploads?_t=${Date.now()}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.apiToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Cache-Control": "no-cache, no-store",
      },
      body: body.buffer,
    });

    const json = response.json as UploadResult;
    return json;
  }

  /**
   * Create a post via /api/posts
   */
  async createPost(
    title: string,
    content: string,
    status: "draft" | "published" = "draft",
    category: string = ""
  ): Promise<PostResult> {
    const payload: Record<string, string> = {
      title,
      content,
      status,
    };
    if (category) {
      payload.category = category;
    }

    const response = await requestUrl({
      url: `${this.settings.apiUrl}/api/posts?_t=${Date.now()}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.apiToken}`,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
      body: JSON.stringify(payload),
    });

    const json = response.json as PostResult;
    return json;
  }

  /**
   * Convert a relative API URL to absolute
   */
  toAbsoluteUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `${this.settings.apiUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(ext: string): string {
    const map: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      bmp: "image/bmp",
      ico: "image/x-icon",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      m4a: "audio/mp4",
      flac: "audio/flac",
      aac: "audio/aac",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
    };
    return map[ext] || "application/octet-stream";
  }

  /**
   * Get file extension from MIME type
   */
  extFromMime(mime: string): string {
    const clean = mime.split(";")[0].trim().toLowerCase();
    const map: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
      "image/bmp": "bmp",
    };
    return map[clean] || "png";
  }
}
