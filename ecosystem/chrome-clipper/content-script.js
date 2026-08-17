/**
 * Qiaomu Blog Clipper - Content Script
 * Injected into the active tab to extract article content via Readability,
 * then convert to Markdown via Turndown.
 * Returns { title, markdown, images, url } back to the caller.
 */

(function () {
  try {
    // 1. Extract article with Readability
    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone).parse();

    const title = article ? (article.title || document.title) : document.title;
    const htmlContent = article ? article.content : document.body.innerHTML;
    const pageUrl = location.href;

    // 2. Convert HTML to Markdown with Turndown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      bulletListMarker: '-',
    });

    // Keep iframes as links
    turndownService.addRule('iframe', {
      filter: 'iframe',
      replacement: function (content, node) {
        var src = node.getAttribute('src') || '';
        return src ? '\n\n[嵌入视频](' + src + ')\n\n' : '';
      },
    });

    var markdown = turndownService.turndown(htmlContent);

    // Prepend source URL
    markdown = '> 原文: [' + title + '](' + pageUrl + ')\n\n' + markdown;

    // 3. Collect all image URLs from the markdown
    var images = [];
    var seen = {};

    // Markdown image syntax: ![alt](url)
    var mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    var m;
    while ((m = mdRegex.exec(markdown)) !== null) {
      var url = m[2];
      if (!seen[url]) {
        seen[url] = true;
        images.push(url);
      }
    }

    // Also check for leftover <img> tags
    var imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((m = imgRegex.exec(markdown)) !== null) {
      var url = m[1];
      if (!seen[url]) {
        seen[url] = true;
        images.push(url);
      }
    }

    return {
      title: title,
      markdown: markdown,
      images: images,
      url: pageUrl,
    };
  } catch (err) {
    // Fallback: return raw content
    return {
      title: document.title,
      markdown: document.body.innerText,
      images: [],
      url: location.href,
      error: err.message,
    };
  }
})();
