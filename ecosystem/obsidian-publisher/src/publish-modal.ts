import { Modal, App, Setting, requestUrl } from "obsidian";
import type QmblogPublisher from "./main";

interface CategoryItem {
  name: string;
  slug: string;
  post_count: number;
}

export interface PublishOptions {
  title: string;
  category: string;
  status: "draft" | "published";
}

export interface PublishResult {
  success: boolean;
  slug?: string;
  uploadedCount: number;
  failedCount: number;
  totalFiles: number;
  error?: string;
}

type ProgressCallback = (message: string) => void;

export class PublishModal extends Modal {
  private plugin: QmblogPublisher;
  private defaultTitle: string;
  private onPublish: (
    options: PublishOptions,
    onProgress: ProgressCallback
  ) => Promise<PublishResult>;

  // Form state
  private titleValue: string;
  private categoryValue: string = "";
  private statusValue: "draft" | "published" = "draft";
  private categories: CategoryItem[] = [];

  // For retry
  private lastResult: PublishResult | null = null;

  constructor(
    app: App,
    plugin: QmblogPublisher,
    defaultTitle: string,
    onPublish: (
      options: PublishOptions,
      onProgress: ProgressCallback
    ) => Promise<PublishResult>
  ) {
    super(app);
    this.plugin = plugin;
    this.defaultTitle = defaultTitle;
    this.titleValue = defaultTitle;
    this.onPublish = onPublish;
  }

  async onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("qmblog-publish-modal");
    this.injectStyles();

    contentEl.empty();
    contentEl.createEl("h2", { text: "发布到 Qiaomu Blog" });

    const loadingEl = contentEl.createDiv({
      cls: "qmblog-center-view",
    });
    loadingEl.createDiv({ cls: "qmblog-spinner" });
    loadingEl.createDiv({
      text: "正在加载分类...",
      cls: "qmblog-center-text",
    });

    try {
      this.categories = await this.fetchCategories();
    } catch (e) {
      console.error("Failed to fetch categories:", e);
    }

    this.renderForm();
  }

  onClose() {
    this.contentEl.empty();
  }

  private injectStyles() {
    const styleId = "qmblog-modal-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .qmblog-publish-modal {
        width: 520px;
        max-width: 90vw;
      }
      .qmblog-center-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 16px;
        gap: 16px;
      }
      .qmblog-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid var(--background-modifier-border);
        border-top-color: var(--interactive-accent);
        border-radius: 50%;
        animation: qmblog-spin 0.6s linear infinite;
      }
      @keyframes qmblog-spin {
        to { transform: rotate(360deg); }
      }
      .qmblog-center-text {
        color: var(--text-muted);
        font-size: var(--font-ui-small);
      }
      .qmblog-result-icon {
        font-size: 40px;
        line-height: 1;
      }
      .qmblog-result-heading {
        margin: 0;
        font-size: var(--font-ui-medium);
      }
      .qmblog-callout-box {
        width: 100%;
        max-width: 360px;
        padding: 10px 14px;
        border-radius: 6px;
        text-align: center;
        font-size: var(--font-ui-small);
      }
      .qmblog-callout-success {
        background: rgba(var(--color-green-rgb, 72, 199, 142), 0.1);
        border: 1px solid rgba(var(--color-green-rgb, 72, 199, 142), 0.25);
        color: var(--text-normal);
      }
      .qmblog-callout-error {
        background: rgba(var(--color-red-rgb, 233, 49, 71), 0.1);
        border: 1px solid rgba(var(--color-red-rgb, 233, 49, 71), 0.25);
        color: var(--text-normal);
        word-break: break-word;
      }
      .qmblog-stats-line {
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
      }
    `;
    document.head.appendChild(style);
  }

  private async fetchCategories(): Promise<CategoryItem[]> {
    const response = await requestUrl({
      url: `${this.plugin.settings.apiUrl}/api/admin/categories`,
      headers: {
        Authorization: `Bearer ${this.plugin.settings.apiToken}`,
      },
    });
    const data = response.json as { categories: CategoryItem[] };
    return data.categories || [];
  }

  // ─── Form View ───────────────────────────────────────────

  private renderForm() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "发布到 Qiaomu Blog" });

    // Title
    new Setting(contentEl)
      .setName("文章标题")
      .addText((text) => {
        text
          .setValue(this.titleValue)
          .onChange((v) => {
            this.titleValue = v;
          });
        text.inputEl.style.width = "100%";
        text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.handlePublish();
          }
        });
      });

    // Category
    new Setting(contentEl)
      .setName("分类")
      .addDropdown((dd) => {
        dd.addOption("", "未分类");
        for (const cat of this.categories) {
          dd.addOption(cat.name, `${cat.name} (${cat.post_count})`);
        }
        dd.setValue(this.categoryValue);
        dd.onChange((v) => {
          this.categoryValue = v;
        });
      });

    // Status
    new Setting(contentEl)
      .setName("发布状态")
      .addDropdown((dd) => {
        dd.addOption("draft", "草稿");
        dd.addOption("published", "直接发布");
        dd.setValue(this.statusValue);
        dd.onChange((v) => {
          this.statusValue = v as "draft" | "published";
        });
      });

    // Buttons
    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("发布")
          .setCta()
          .onClick(() => this.handlePublish())
      )
      .addButton((btn) =>
        btn.setButtonText("取消").onClick(() => this.close())
      );
  }

  // ─── Publish Handler ─────────────────────────────────────

  private async handlePublish() {
    if (!this.titleValue.trim()) {
      return;
    }

    this.renderProgress("正在准备...");

    const onProgress = (message: string) => {
      this.updateProgressText(message);
    };

    try {
      const result = await this.onPublish(
        {
          title: this.titleValue.trim(),
          category: this.categoryValue,
          status: this.statusValue,
        },
        onProgress
      );

      if (result.success) {
        this.lastResult = result;
        this.renderSuccess(result);
      } else {
        this.renderError(result.error || "未知错误");
      }
    } catch (e) {
      this.renderError(e instanceof Error ? e.message : String(e));
    }
  }

  // ─── Progress View ───────────────────────────────────────

  private progressTextEl: HTMLElement | null = null;

  private renderProgress(message: string) {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "发布到 Qiaomu Blog" });

    const wrapper = contentEl.createDiv({ cls: "qmblog-center-view" });
    wrapper.createDiv({ cls: "qmblog-spinner" });

    this.progressTextEl = wrapper.createDiv({
      text: message,
      cls: "qmblog-center-text",
    });
  }

  private updateProgressText(message: string) {
    if (this.progressTextEl) {
      this.progressTextEl.setText(message);
    }
  }

  // ─── Success View ────────────────────────────────────────

  private renderSuccess(result: PublishResult) {
    const { contentEl } = this;
    contentEl.empty();

    const wrapper = contentEl.createDiv({ cls: "qmblog-center-view" });

    wrapper.createDiv({ cls: "qmblog-result-icon", text: "\u2713" });

    const heading = wrapper.createEl("h3", {
      text: "发布成功",
      cls: "qmblog-result-heading",
    });
    heading.style.color = "var(--color-green)";

    // Title callout
    const callout = wrapper.createDiv({
      cls: "qmblog-callout-box qmblog-callout-success",
    });
    callout.createDiv({
      text: this.titleValue,
      attr: { style: "font-weight: 600;" },
    });

    // Upload stats
    if (result.totalFiles > 0) {
      let statsText = `${result.uploadedCount} 个文件上传成功`;
      if (result.failedCount > 0) {
        statsText += `，${result.failedCount} 个失败`;
      }
      wrapper.createDiv({ cls: "qmblog-stats-line", text: statsText });
    }

    // Action buttons
    if (result.slug) {
      new Setting(wrapper)
        .addButton((btn) =>
          btn
            .setButtonText("在浏览器中编辑")
            .setCta()
            .onClick(() => {
              window.open(
                `${this.plugin.settings.apiUrl}/editor?edit=${result.slug}`,
                "_blank"
              );
            })
        )
        .addButton((btn) =>
          btn.setButtonText("查看文章").onClick(() => {
            window.open(
              `${this.plugin.settings.apiUrl}/${result.slug}`,
              "_blank"
            );
          })
        );
    }

    new Setting(wrapper).addButton((btn) =>
      btn.setButtonText("关闭").onClick(() => this.close())
    );
  }

  // ─── Error View ──────────────────────────────────────────

  private renderError(errorMsg: string) {
    const { contentEl } = this;
    contentEl.empty();

    const wrapper = contentEl.createDiv({ cls: "qmblog-center-view" });

    wrapper.createDiv({ cls: "qmblog-result-icon", text: "\u2717" });

    const heading = wrapper.createEl("h3", {
      text: "发布失败",
      cls: "qmblog-result-heading",
    });
    heading.style.color = "var(--color-red)";

    // Error callout
    const callout = wrapper.createDiv({
      cls: "qmblog-callout-box qmblog-callout-error",
    });
    callout.setText(errorMsg);

    // Retry + Close
    new Setting(wrapper)
      .addButton((btn) =>
        btn
          .setButtonText("重试")
          .setCta()
          .onClick(() => this.renderForm())
      )
      .addButton((btn) =>
        btn.setButtonText("关闭").onClick(() => this.close())
      );
  }
}
