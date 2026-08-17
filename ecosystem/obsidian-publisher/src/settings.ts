import { App, Notice, PluginSettingTab, Setting, requestUrl } from "obsidian";
import type QmblogPublisher from "./main";

export interface QmblogSettings {
  apiUrl: string;
  apiToken: string;
}

export const DEFAULT_SETTINGS: QmblogSettings = {
  apiUrl: "https://your-domain.com",
  apiToken: "",
};

export class QmblogSettingTab extends PluginSettingTab {
  plugin: QmblogPublisher;

  constructor(app: App, plugin: QmblogPublisher) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl("h1", { text: "Qiaomu Blog Publisher" });
    containerEl.createEl("p", {
      text: "将 Obsidian 笔记发布到你自己的 Qiaomu Blog",
      cls: "setting-item-description",
    });

    // ── Connection section ──────────────────────────────────

    containerEl.createEl("h2", { text: "连接设置" });

    new Setting(containerEl)
      .setName("API 地址")
      .setDesc("你的博客地址")
      .addText((text) =>
        text
          .setPlaceholder("https://your-domain.com")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value.trim().replace(/\/+$/, "");
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Token")
      .setDesc("在博客后台「设置 → API Token」中生成")
      .addText((text) => {
        text.inputEl.type = "password";
        text.inputEl.style.width = "300px";
        text
          .setPlaceholder("qm_xxxxxxxxxxxxxxxx")
          .setValue(this.plugin.settings.apiToken)
          .onChange(async (value) => {
            this.plugin.settings.apiToken = value.trim();
            await this.plugin.saveSettings();
          });
      });

    // Test connection
    new Setting(containerEl)
      .setName("测试连接")
      .setDesc("验证 API Token 是否有效")
      .addButton((btn) =>
        btn.setButtonText("测试").onClick(async () => {
          btn.setButtonText("测试中...");
          btn.setDisabled(true);
          try {
            const response = await requestUrl({
              url: `${this.plugin.settings.apiUrl}/api/admin/categories`,
              headers: {
                Authorization: `Bearer ${this.plugin.settings.apiToken}`,
              },
            });
            if (response.status === 200) {
              const data = response.json;
              new Notice(
                `连接成功！找到 ${data.categories?.length || 0} 个分类`
              );
            } else {
              new Notice("连接失败：Token 无效");
            }
          } catch (e) {
            new Notice(
              `连接失败：${e instanceof Error ? e.message : "网络错误"}`
            );
          } finally {
            btn.setButtonText("测试");
            btn.setDisabled(false);
          }
        })
      );

    // ── Usage section ───────────────────────────────────────

    containerEl.createEl("h2", { text: "使用方式" });

    const usageDesc = containerEl.createDiv({ cls: "setting-item-description" });
    usageDesc.innerHTML = `
      <ul style="margin: 8px 0; padding-left: 20px; line-height: 1.8;">
        <li>点击左侧栏 <strong>上传图标</strong> 发布当前笔记</li>
        <li>使用命令面板搜索 <strong>「发布到 Qiaomu Blog」</strong></li>
        <li>在编辑器中 <strong>右键菜单</strong> 选择发布</li>
        <li>在文件管理器中 <strong>右键文件</strong> 选择发布</li>
        <li>点击底部状态栏 <strong>「Qiaomu Blog」</strong> 快速发布</li>
      </ul>
    `;
  }
}
