/**
 * Qiaomu Blog Clipper - Content Script
 * Injected into the active tab to extract article content via Readability,
 * then convert to Markdown via Turndown.
 * Returns { title, markdown, images, url } back to the caller.
 */

(function () {
  try {
    // User-triggered capture of the already loaded document; no page requests.
    if (location.hostname === 'mp.weixin.qq.com') {
      const source = document.querySelector('#js_content');
      const title = (document.querySelector('#activity-name')?.textContent
        || document.querySelector('meta[property="og:title"]')?.content || '').trim();
      if (!source || !title || (!source.textContent.trim() && !source.querySelector('img'))) {
        return { error: '当前页面没有完整的公众号正文。请在此浏览器中正常打开文章，完成微信验证并等待正文显示后，再点击转载。' };
      }
      const article = source.cloneNode(true);
      Array.from(article.querySelectorAll('script,style,noscript,template,link,meta,base,form,svg')).forEach(el => el.parentNode.removeChild(el));
      const images = new Set();
      Array.from(article.querySelectorAll('img')).forEach(img => {
        const raw = img.getAttribute('data-src') || img.getAttribute('src');
        let url;
        try { url = new URL(raw || '', location.href); } catch { img.parentNode.removeChild(img); return; }
        if (!raw || !['https:', 'http:'].includes(url.protocol)) { img.parentNode.removeChild(img); return; }
        img.setAttribute('src', url.href);
        img.removeAttribute('srcset');
        img.removeAttribute('data-src');
        img.setAttribute('referrerpolicy', 'no-referrer');
        images.add(url.href);
      });
      // Keep full HTML, including tables and nested paragraphs. The website sanitizes it.
      return { source: 'wechat', title, html: article.innerHTML,
        markdown: article.textContent.trim() || '图片文章', images: [...images], url: location.href };
    }

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
    return { error: '未能完整提取文章：' + err.message };
  }
})();
