const OWNER = "EvoLinkAI";
const REPO = "awesome-gpt-image-2-prompts";
const BRANCH = "main";
const CHECK_ALARM = "check-evolink-prompt-updates";

const LANG_FILES = {
  en: "README.md",
  "zh-CN": "README_zh-CN.md",
  "zh-TW": "README_zh-TW.md",
  ja: "README_ja.md",
  ko: "README_ko.md",
  es: "README_es.md",
  pt: "README_pt.md",
  de: "README_de.md",
  fr: "README_fr.md",
  tr: "README_tr.md",
  ru: "README_ru.md"
};

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
      selectedLang: LANG_FILES[settings.selectedLang] ? settings.selectedLang : "zh-CN"
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
    languages: Object.entries(LANG_FILES).map(([code, file]) => ({
      code,
      file,
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

  const file = LANG_FILES[lang];
  const [commit, markdown] = await Promise.all([
    fetchLatestCommit(file),
    fetchRawMarkdown(file)
  ]);

  const prompts = parseMarkdownPrompts(markdown, lang, file);
  if (!prompts.length) {
    throw new Error(`No prompts parsed from ${file}`);
  }

  const cacheKey = getCacheKey(lang);

  await chrome.storage.local.set({
    [cacheKey]: {
      lang,
      file,
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

async function checkForUpdates() {
  await initSettings();

  const { settings } = await chrome.storage.local.get("settings");
  const selectedLang = settings.selectedLang || "zh-CN";
  const file = LANG_FILES[selectedLang];

  const remote = await fetchLatestCommit(file);
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

async function fetchLatestCommit(file) {
  const url = new URL(`https://api.github.com/repos/${OWNER}/${REPO}/commits`);
  url.searchParams.set("sha", BRANCH);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("path", file);

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub commit API failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const item = data?.[0];

  if (!item) {
    throw new Error(`No commit found for ${file}`);
  }

  return {
    sha: item.sha,
    date: item.commit?.committer?.date || item.commit?.author?.date || null
  };
}

async function fetchRawMarkdown(file) {
  const url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${file}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Markdown fetch failed: ${file}, HTTP ${res.status}`);
  }

  return res.text();
}

function parseMarkdownPrompts(markdown, lang, file) {
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
    const category = findNearestSection(normalized, start);

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
  const labelPattern = /(?:\*{1,4}\s*)?(?:Prompt|提示词|プロンプト|프롬프트|Запрос|İstem|İpucu|Eingabeaufforderung|Indicación|Invite)(?:\s*:)?(?:\s*\*{1,4})?\s*```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/i;
  const labeled = body.match(labelPattern);

  if (labeled?.[1]) {
    return cleanupPrompt(labeled[1]);
  }

  const fallback = body.match(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/);
  return fallback?.[1] ? cleanupPrompt(fallback[1]) : "";
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
    if (/^https:\/\/github\.com\/EvoLinkAI\/awesome-gpt-image-2-prompts\/blob\/main\//i.test(cleanSrc)) {
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
  if (!LANG_FILES[lang]) {
    throw new Error(`Unsupported language: ${lang}`);
  }
}

function hash(input) {
  let h = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }

  return String(h >>> 0);
}
