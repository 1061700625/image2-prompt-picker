const OWNER = "EvoLinkAI";
const REPO = "awesome-gpt-image-2-API-and-Prompts";
const BRANCH = "main";
const CASES_DIR = "cases";
const CHECK_ALARM = "check-evolink-prompt-updates";

const SUPPORTED_LANGS = [
  "en",
  "zh-CN",
  "zh-TW",
  "ja",
  "ko",
  "es",
  "pt",
  "de",
  "fr",
  "tr",
  "ru"
];

const LANG_LABELS = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
  fr: "Français",
  tr: "Türkçe",
  ru: "Русский"
};

const DEFAULT_SETTINGS = {
  selectedLang: "zh-CN",
  initialized: false,
  hasUpdate: false,
  lastCheckedAt: null,
  remoteCommitSha: null,
  remoteCommitDate: null
};

chrome.runtime.onInstalled.addListener(async details => {
  await initSettings();
  await ensureUpdateAlarm();

  const { settings } = await chrome.storage.local.get("settings");
  const shouldBootstrap = !settings?.initialized || details?.reason === "update";

  if (shouldBootstrap) {
    try {
      await syncPrompts(settings.selectedLang);
    } catch (error) {
      console.warn("Initial sync failed:", error);
    }
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await initSettings();
  await ensureUpdateAlarm();
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== CHECK_ALARM) return;

  try {
    await checkForUpdates();
  } catch (error) {
    console.warn("Update check failed:", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ ok: false, error: error.message }));

  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_PROMPT_STATE":
      return getPromptState();

    case "SET_LANGUAGE":
      return setLanguage(message.lang);

    case "SYNC_PROMPTS":
      return syncPrompts(message.lang);

    case "CHECK_UPDATES":
      return checkForUpdates();

    case "CLEAR_CACHE":
      return clearCache();

    default:
      return { ok: false, error: "Unknown message type" };
  }
}

async function initSettings() {
  const { settings } = await chrome.storage.local.get("settings");

  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        ...DEFAULT_SETTINGS,
        selectedLang: detectDefaultLanguage()
      }
    });
    return;
  }

  await chrome.storage.local.set({
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      selectedLang: isSupportedLang(settings.selectedLang) ? settings.selectedLang : "zh-CN"
    }
  });
}

function detectDefaultLanguage() {
  const uiLang = chrome.i18n?.getUILanguage?.() || "zh-CN";

  if (uiLang.startsWith("zh-TW") || uiLang.startsWith("zh-HK")) return "zh-TW";
  if (uiLang.startsWith("zh")) return "zh-CN";
  if (uiLang.startsWith("ja")) return "ja";
  if (uiLang.startsWith("ko")) return "ko";
  if (uiLang.startsWith("es")) return "es";
  if (uiLang.startsWith("pt")) return "pt";
  if (uiLang.startsWith("de")) return "de";
  if (uiLang.startsWith("fr")) return "fr";
  if (uiLang.startsWith("tr")) return "tr";
  if (uiLang.startsWith("ru")) return "ru";

  return "en";
}

async function ensureUpdateAlarm() {
  const alarm = await chrome.alarms.get(CHECK_ALARM);

  if (!alarm) {
    await chrome.alarms.create(CHECK_ALARM, {
      delayInMinutes: 5,
      periodInMinutes: 360
    });
  }
}

async function getPromptState() {
  await initSettings();

  const { settings } = await chrome.storage.local.get("settings");
  const cacheKey = getCacheKey(settings.selectedLang);
  const cacheStore = await chrome.storage.local.get(cacheKey);
  const cache = cacheStore[cacheKey] || null;

  return {
    ok: true,
    settings,
    prompts: cache?.prompts || [],
    cache,
    languages: SUPPORTED_LANGS.map(code => ({
      code,
      file: getLanguageFilePattern(code),
      label: LANG_LABELS[code] || code
    }))
  };
}

async function setLanguage(lang) {
  assertSupportedLang(lang);

  const { settings } = await chrome.storage.local.get("settings");
  const nextSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    selectedLang: lang,
    hasUpdate: false
  };

  await chrome.storage.local.set({ settings: nextSettings });
  await chrome.action.setBadgeText({ text: "" });

  const cacheKey = getCacheKey(lang);
  const cacheStore = await chrome.storage.local.get(cacheKey);

  if (!cacheStore[cacheKey]) {
    return syncPrompts(lang);
  }

  return getPromptState();
}

async function syncPrompts(lang) {
  assertSupportedLang(lang);

  const files = await fetchCaseMarkdownFiles(lang);
  const [commit, docs] = await Promise.all([
    fetchLatestCommit(CASES_DIR),
    Promise.all(files.map(file => fetchRawMarkdownFile(file)))
  ]);

  const prompts = docs
    .flatMap(doc => parseMarkdownPrompts(doc.markdown, lang, doc.path, doc.category, doc.featureSlug))
    .sort((a, b) => {
      const byCategory = String(a.category || "").localeCompare(String(b.category || ""));
      if (byCategory !== 0) return byCategory;
      return Number(a.caseNo) - Number(b.caseNo);
    });

  if (!prompts.length) {
    throw new Error(`No prompts parsed from ${CASES_DIR} for ${lang}`);
  }

  const cacheKey = getCacheKey(lang);
  const filePaths = files.map(file => file.path);

  await chrome.storage.local.set({
    [cacheKey]: {
      lang,
      file: filePaths.join(", "),
      files: filePaths,
      prompts,
      fetchedAt: Date.now(),
      sourceCommitSha: commit.sha,
      sourceCommitDate: commit.date
    }
  });

  const { settings } = await chrome.storage.local.get("settings");

  await chrome.storage.local.set({
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      selectedLang: lang,
      initialized: true,
      hasUpdate: false,
      remoteCommitSha: commit.sha,
      remoteCommitDate: commit.date,
      lastCheckedAt: Date.now()
    }
  });

  await chrome.action.setBadgeText({ text: "" });

  return getPromptState();
}

async function clearCache() {
  await initSettings();

  const { settings } = await chrome.storage.local.get("settings");
  const selectedLang = settings?.selectedLang || detectDefaultLanguage();
  const allItems = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(allItems).filter(key => key.startsWith("promptCache:"));

  if (cacheKeys.length) {
    await chrome.storage.local.remove(cacheKeys);
  }

  await chrome.storage.local.set({
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      selectedLang: isSupportedLang(selectedLang) ? selectedLang : "zh-CN",
      initialized: false,
      hasUpdate: false,
      remoteCommitSha: null,
      remoteCommitDate: null,
      lastCheckedAt: Date.now()
    }
  });

  await chrome.action.setBadgeText({ text: "" });

  return getPromptState();
}

async function checkForUpdates() {
  await initSettings();

  const { settings } = await chrome.storage.local.get("settings");
  const selectedLang = settings.selectedLang || "zh-CN";
  const remote = await fetchLatestCommit(CASES_DIR);
  const cacheKey = getCacheKey(selectedLang);
  const cacheStore = await chrome.storage.local.get(cacheKey);
  const local = cacheStore[cacheKey] || null;

  const hasUpdate = Boolean(
    local?.sourceCommitSha &&
    remote.sha &&
    local.sourceCommitSha !== remote.sha
  );

  await chrome.storage.local.set({
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings,
      hasUpdate,
      remoteCommitSha: remote.sha,
      remoteCommitDate: remote.date,
      lastCheckedAt: Date.now()
    }
  });

  await chrome.action.setBadgeText({ text: hasUpdate ? "NEW" : "" });
  if (hasUpdate) {
    await chrome.action.setBadgeBackgroundColor({ color: "#D93025" });
  }

  return {
    ok: true,
    hasUpdate,
    remote,
    local: local
      ? {
          sourceCommitSha: local.sourceCommitSha,
          sourceCommitDate: local.sourceCommitDate
        }
      : null
  };
}

async function fetchLatestCommit(path) {
  const url = new URL(`https://api.github.com/repos/${OWNER}/${REPO}/commits`);
  url.searchParams.set("sha", BRANCH);
  url.searchParams.set("per_page", "1");
  if (path) url.searchParams.set("path", path);

  const res = await fetch(url.toString(), {
    headers: getGitHubHeaders()
  });

  if (!res.ok) {
    throw new Error(`GitHub commit API failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const item = data?.[0];

  if (!item) {
    if (path) return fetchLatestCommit("");
    throw new Error(`No commit found for ${REPO}`);
  }

  return {
    sha: item.sha,
    date: item.commit?.committer?.date || item.commit?.author?.date || null
  };
}

async function fetchCaseMarkdownFiles(lang) {
  const url = new URL(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${CASES_DIR}`);
  url.searchParams.set("ref", BRANCH);

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: getGitHubHeaders()
  });

  if (!res.ok) {
    throw new Error(`GitHub contents API failed: HTTP ${res.status}`);
  }

  const entries = await res.json();
  if (!Array.isArray(entries)) {
    throw new Error(`${CASES_DIR} is not a directory`);
  }

  const files = entries
    .filter(entry => entry?.type === "file" && /\.md$/i.test(entry.name || ""))
    .filter(entry => getCaseFileLang(entry.name) === lang)
    .map(entry => {
      const featureSlug = getCaseFeatureSlug(entry.name);
      return {
        name: entry.name,
        path: entry.path || `${CASES_DIR}/${entry.name}`,
        downloadUrl: entry.download_url || "",
        featureSlug,
        category: getCaseFeatureLabel(featureSlug)
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  if (!files.length) {
    throw new Error(`No ${lang} markdown files found in ${CASES_DIR}`);
  }

  return files;
}

async function fetchRawMarkdownFile(file) {
  const url = file.downloadUrl || `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${file.path}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Markdown fetch failed: ${file.path}, HTTP ${res.status}`);
  }

  return {
    ...file,
    markdown: await res.text()
  };
}

function getGitHubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}


function parseMarkdownPrompts(markdown, lang, file, fallbackCategory = "", featureSlug = "") {
  const normalized = normalizeMarkdown(markdown);
  const caseMatches = [...normalized.matchAll(/###\s+Case\s+(\d+):\s+([\s\S]*?)(?=\n|\s+\|\s*Output\s*\|)/g)];

  const prompts = [];

  for (let i = 0; i < caseMatches.length; i += 1) {
    const match = caseMatches[i];
    const caseNo = match[1];
    const rawTitle = match[2];
    const start = match.index;
    const bodyStart = match.index + match[0].length;
    const nextStart = i + 1 < caseMatches.length ? caseMatches[i + 1].index : normalized.length;
    const body = normalized.slice(bodyStart, nextStart);

    const prompt = extractPrompt(body);
    if (!prompt) continue;

    const title = cleanMarkdownTitle(rawTitle);
    const sectionCategory = findNearestSection(normalized, start);
    const category = sectionCategory || fallbackCategory || getCaseFeatureLabel(featureSlug);

    const image = extractOutputImage(body, file);

    prompts.push({
      id: hash(`${lang}:${file}:${caseNo}:${title}:${prompt}`),
      lang,
      file,
      caseNo,
      title,
      category,
      prompt,
      imageUrl: image?.url || "",
      imageAlt: image?.alt || "",
      sourceUrl: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${file}`
    });
  }

  return dedupeById(prompts);
}

function normalizeMarkdown(markdown) {
  return String(markdown || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/```[ \t]+(?=###\s+Case\s+\d+:)/g, "```\n")
    .replace(/([^\n])([ \t]{2,})(?=###\s+Case\s+\d+:)/g, "$1\n")
    .replace(/([^\n])([ \t]{2,})(?=##\s+[^\n#])/g, "$1\n")
    .replace(/([^\n])([ \t]{2,})(?=\*\*{0,2}(?:Prompt|提示词|プロンプト|프롬프트|Запрос|İstem|İpucu|Eingabeaufforderung|Indicación|Invite|Prompt)\s*:?\*{0,4}\s*```)/gi, "$1\n");
}

function extractPrompt(body) {
  const labelPattern = /(?:\*{1,4}\s*)?(?:Prompt|提示词|プロンプト|프롬프트|Запрос|İstem|İpucu|Eingabeaufforderung|Indicación|Invite)(?:\s*[:：])?(?:\s*\*{1,4})?\s*```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/i;
  const labeledFence = body.match(labelPattern);

  if (labeledFence?.[1]) {
    return cleanupPrompt(labeledFence[1]);
  }

  const fallbackFence = body.match(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/);
  if (fallbackFence?.[1]) {
    return cleanupPrompt(fallbackFence[1]);
  }

  const labelOnlyPattern = /(?:^|\n)\s*(?:\*{0,4}\s*)?(?:Prompt|提示词|プロンプト|프롬프트|Запрос|İstem|İpucu|Eingabeaufforderung|Indicación|Invite)(?:\s*[:：])(?:\s*\*{0,4})?\s*/i;
  const labelOnly = body.match(labelOnlyPattern);

  if (!labelOnly) return "";

  const promptStart = labelOnly.index + labelOnly[0].length;
  const rawPrompt = body.slice(promptStart);
  return cleanupPrompt(stripPromptFormatting(rawPrompt));
}

function stripPromptFormatting(prompt) {
  let source = String(prompt || "")
    .replace(/^(?:\s*>\s*)+/gm, "")
    .trim();

  source = source
    .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
    .replace(/```\s*$/, "")
    .trim();

  source = source
    .replace(/^`([\s\S]*)`$/g, "$1")
    .trim();

  return stripCommonIndent(source);
}

function stripCommonIndent(text) {
  const lines = String(text || "").replace(/\t/g, "    ").split("\n");
  const indents = lines
    .filter(line => line.trim())
    .map(line => line.match(/^ */)?.[0].length || 0);

  const minIndent = indents.length ? Math.min(...indents) : 0;
  if (!minIndent) return lines.join("\n").trim();

  return lines
    .map(line => line.startsWith(" ".repeat(minIndent)) ? line.slice(minIndent) : line)
    .join("\n")
    .trim();
}


function extractOutputImage(body, file) {
  const outputBlock = findOutputBlock(body) || body;

  const htmlImage = extractHtmlImage(outputBlock, file);
  if (htmlImage?.url) return htmlImage;

  const markdownImage = extractMarkdownImage(outputBlock, file);
  if (markdownImage?.url) return markdownImage;

  return null;
}

function findOutputBlock(body) {
  const outputTable = body.match(/\|\s*Output\s*\|[\s\S]*?(?=(?:\*\*{0,2}\s*)?(?:Prompt|提示词|プロンプト|프롬프트|Запрос|İstem|İpucu|Eingabeaufforderung|Indicación|Invite)\s*:|\n###\s+Case\s+\d+:|\n##\s+|$)/i);
  if (outputTable?.[0]) return outputTable[0];

  const outputHeading = body.match(/(?:^|\n)\s*(?:Output|输出|出力|결과)\s*[:：]?\s*([\s\S]*?)(?=(?:\*\*{0,2}\s*)?(?:Prompt|提示词|プロンプト|프롬프트|Запрос|İstem|İpucu|Eingabeaufforderung|Indicación|Invite)\s*:|\n###\s+Case\s+\d+:|\n##\s+|$)/i);
  return outputHeading?.[0] || "";
}

function extractHtmlImage(markdown, file) {
  const imgMatch = markdown.match(/<img\b([^>]*?)>/i);
  if (!imgMatch) return null;

  const attrs = imgMatch[1] || "";
  const src = getHtmlAttribute(attrs, "src");
  const alt = getHtmlAttribute(attrs, "alt") || "Output image";

  if (!src) return null;

  return {
    url: resolveRepositoryImageUrl(src, file),
    alt
  };
}

function extractMarkdownImage(markdown, file) {
  const imgMatch = markdown.match(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/);
  if (!imgMatch) return null;

  return {
    url: resolveRepositoryImageUrl(imgMatch[2], file),
    alt: imgMatch[1] || "Output image"
  };
}

function getHtmlAttribute(attrs, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = attrs.match(pattern);
  return match?.[1] ? decodeHtmlEntities(match[1]) : "";
}

function resolveRepositoryImageUrl(src, file) {
  const cleanSrc = decodeHtmlEntities(String(src || "").trim());
  if (!cleanSrc) return "";

  if (/^data:/i.test(cleanSrc)) return cleanSrc;

  if (/^https?:\/\//i.test(cleanSrc)) {
    if (isRepositoryBlobUrl(cleanSrc)) {
      return ensureRawTrue(cleanSrc);
    }

    return cleanSrc;
  }

  const path = normalizeRepositoryPath(cleanSrc, file);
  return ensureRawTrue(`https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${path}`);
}

function normalizeRepositoryPath(src, file) {
  const [pathPart, suffix = ""] = String(src).split(/(?=[?#])/);
  const fileDir = file.includes("/") ? file.split("/").slice(0, -1).join("/") : "";
  const rawSegments = pathPart.startsWith("/")
    ? pathPart.split("/")
    : `${fileDir}/${pathPart}`.split("/");

  const normalizedSegments = [];

  for (const segment of rawSegments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      normalizedSegments.pop();
      continue;
    }
    normalizedSegments.push(segment);
  }

  const encodedPath = normalizedSegments
    .map(segment => encodeURIComponent(segment).replace(/%2F/g, "/"))
    .join("/");

  return `${encodedPath}${suffix}`;
}

function isRepositoryBlobUrl(url) {
  const expectedPrefix = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/`;
  return String(url || "").toLowerCase().startsWith(expectedPrefix.toLowerCase());
}

function getLanguageFilePattern(lang) {
  assertSupportedLang(lang);
  return lang === "en" ? `${CASES_DIR}/*.md` : `${CASES_DIR}/*_${lang}.md`;
}

function getCaseFileLang(fileName) {
  const base = String(fileName || "").replace(/\.md$/i, "");
  const languageCodes = SUPPORTED_LANGS
    .filter(code => code !== "en")
    .sort((a, b) => b.length - a.length);

  for (const code of languageCodes) {
    if (base.endsWith(`_${code}`)) return code;
  }

  return "en";
}

function getCaseFeatureSlug(fileName) {
  const lang = getCaseFileLang(fileName);
  let base = String(fileName || "").replace(/\.md$/i, "");

  if (lang !== "en" && base.endsWith(`_${lang}`)) {
    base = base.slice(0, -(`_${lang}`.length));
  }

  return base;
}

function getCaseFeatureLabel(slug) {
  const labels = {
    "ad-creative": "Ad Creative",
    character: "Character Design",
    comparison: "Comparison & Community Examples",
    ecommerce: "E-commerce",
    portrait: "Portrait & Photography",
    poster: "Poster & Illustration",
    ui: "UI & Social Media Mockup"
  };

  if (labels[slug]) return labels[slug];

  return String(slug || "")
    .split(/[-_]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function ensureRawTrue(url) {
  if (/[?&]raw=true(?:&|$)/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}raw=true`;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanupPrompt(prompt) {
  return String(prompt || "")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function findNearestSection(markdown, caseIndex) {
  const before = markdown.slice(0, caseIndex);
  const sections = [...before.matchAll(/(?:^|\n)##\s+(?!#)(.+?)(?=\n|$)/g)];
  const raw = sections.at(-1)?.[1] || "";
  const cleaned = cleanMarkdownTitle(raw);

  return cleaned && !["Menu", "简介", "Introduction", "Latest Updates", "最新动态"].includes(cleaned)
    ? cleaned
    : "";
}

function cleanMarkdownTitle(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+\(by\s+.*?\)\s*$/i, "")
    .replace(/\s+\|\s*Output\s*\|.*$/i, "")
    .replace(/[#*_`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeById(items) {
  const seen = new Set();

  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getCacheKey(lang) {
  return `promptCache:${lang}`;
}

function assertSupportedLang(lang) {
  if (!isSupportedLang(lang)) {
    throw new Error(`Unsupported language: ${lang}`);
  }
}

function isSupportedLang(lang) {
  return SUPPORTED_LANGS.includes(lang);
}

function hash(input) {
  let h = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }

  return String(h >>> 0);
}
