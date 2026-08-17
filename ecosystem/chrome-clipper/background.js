/**
 * Qiaomu Blog Clipper - Background Service Worker
 *
 * Flow:
 * 1. Receive "clip" message from popup with { title, category, status }
 * 2. Inject Readability + Turndown + content-script into active tab
 * 3. Get markdown + title + image list from content script
 * 4. Download each image, upload to blog R2, replace URLs in markdown
 * 5. POST to /api/posts with specified category and status
 * 6. Return result to popup with progress updates
 */

// ---- Helpers ----

/**
 * Send a progress update to the popup.
 * Uses the new structured message format.
 */
function sendProgress(step, current = 0, total = 0) {
  chrome.runtime.sendMessage({ action: 'progress', step, current, total }).catch(() => {
    // popup may be closed, ignore
  });
}

/**
 * Get settings from chrome.storage.sync.
 */
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiUrl', 'apiToken'], resolve);
  });
}

/**
 * Upload a single image blob to blog R2.
 * Returns the uploaded URL path (e.g. "/api/images/xxx.png").
 */
async function uploadImage(blob, filename, apiUrl, apiToken) {
  const formData = new FormData();
  formData.append('file', blob, filename);

  const resp = await fetch(`${apiUrl}/api/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    throw new Error(`Upload failed: ${resp.status} ${resp.statusText}`);
  }

  const json = await resp.json();
  if (!json.success) {
    throw new Error('Upload response: success=false');
  }

  return json.url; // e.g. "/api/images/abc.png"
}

/**
 * Download an image from any URL using the service worker's fetch (no CORS issues).
 * Returns a Blob, or null on failure.
 */
async function downloadImage(url) {
  try {
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) return null;
    return await resp.blob();
  } catch {
    return null;
  }
}

/**
 * Extract a reasonable filename from a URL.
 */
function filenameFromUrl(url) {
  try {
    const u = new URL(url);
    const pathname = u.pathname;
    const parts = pathname.split('/');
    let name = parts[parts.length - 1] || 'image';
    // Remove query-like suffixes in filename
    name = name.split('?')[0].split('#')[0];
    // Ensure it has an extension
    if (!/\.\w{2,5}$/.test(name)) {
      name += '.png';
    }
    // Limit length
    if (name.length > 80) {
      name = name.slice(-80);
    }
    return name;
  } catch {
    return 'image.png';
  }
}

/**
 * Resolve a possibly-relative image URL against the page URL.
 */
function resolveUrl(imgUrl, pageUrl) {
  if (/^https?:\/\//i.test(imgUrl)) return imgUrl;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  if (imgUrl.startsWith('data:')) return null; // skip data URIs
  try {
    return new URL(imgUrl, pageUrl).href;
  } catch {
    return null;
  }
}

// ---- Main clip flow ----

async function clipPage(options = {}) {
  const { title: customTitle, category, status } = options;

  const { apiUrl, apiToken } = await getSettings();
  if (!apiUrl || !apiToken) {
    return { success: false, error: '请先在设置中配置 API URL 和 Token' };
  }

  // 1. Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return { success: false, error: '没有找到活动标签页' };
  }

  sendProgress('extracting');

  // 2. Inject Readability.js + turndown.js + content-script.js
  let extractResult;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js', 'lib/turndown.js'],
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-script.js'],
    });

    extractResult = results?.[0]?.result;
  } catch (err) {
    return { success: false, error: `内容提取失败: ${err.message}` };
  }

  if (!extractResult || !extractResult.markdown) {
    return { success: false, error: '无法提取页面内容' };
  }

  const { title: extractedTitle, markdown: rawMarkdown, images, url: pageUrl } = extractResult;
  const finalTitle = customTitle || extractedTitle;
  let markdown = rawMarkdown;
  let imageCount = 0;

  // 3. Download and upload images
  if (images && images.length > 0) {
    sendProgress('uploading', 0, images.length);

    let uploaded = 0;
    let failed = 0;

    for (const imgUrl of images) {
      const resolvedUrl = resolveUrl(imgUrl, pageUrl);
      if (!resolvedUrl) {
        failed++;
        continue;
      }

      try {
        const blob = await downloadImage(resolvedUrl);
        if (!blob || blob.size === 0) {
          failed++;
          continue;
        }

        const filename = filenameFromUrl(resolvedUrl);
        const uploadedPath = await uploadImage(blob, filename, apiUrl, apiToken);

        // Build full URL for the markdown
        const fullUrl = uploadedPath.startsWith('http')
          ? uploadedPath
          : `${apiUrl}${uploadedPath}`;

        // Replace all occurrences of this image URL in markdown
        markdown = markdown.split(imgUrl).join(fullUrl);

        uploaded++;
        sendProgress('uploading', uploaded, images.length);
      } catch (err) {
        console.warn('Image upload failed:', imgUrl, err);
        failed++;
      }
    }

    imageCount = uploaded;

    if (failed > 0) {
      console.log(`${failed} image(s) failed to upload, keeping original URLs.`);
    }
  }

  // 4. Create post with category and status
  sendProgress('creating');

  try {
    const postBody = {
      title: finalTitle,
      content: markdown,
      status: status || 'draft',
    };

    if (category) {
      postBody.category = category;
    }

    const resp = await fetch(`${apiUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(postBody),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, error: `创建文章失败: ${resp.status} ${text.slice(0, 200)}` };
    }

    const json = await resp.json();
    if (!json.success) {
      return { success: false, error: '创建文章失败: API 返回 success=false' };
    }

    return {
      success: true,
      slug: json.slug,
      title: finalTitle,
      imageCount: imageCount,
    };
  } catch (err) {
    return { success: false, error: `创建文章失败: ${err.message}` };
  }
}

// ---- Message listener ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clip') {
    clipPage({
      title: message.title,
      category: message.category,
      status: message.status,
    })
      .then(sendResponse)
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep channel open for async response
  }
});
