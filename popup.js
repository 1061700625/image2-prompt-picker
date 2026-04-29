const PAGE_SIZE = 12;

const els = {
  langSelect: document.getElementById("langSelect"),
  categorySelect: document.getElementById("categorySelect"),
  sidePanelBtn: document.getElementById("sidePanelBtn"),
  checkBtn: document.getElementById("checkBtn"),
  syncBtn: document.getElementById("syncBtn"),
  searchInput: document.getElementById("searchInput"),
  status: document.getElementById("status"),
  promptList: document.getElementById("promptList"),
  updateBanner: document.getElementById("updateBanner"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo"),
  hoverPreview: document.getElementById("hoverPreview"),
  hoverPreviewImage: document.getElementById("hoverPreviewImage"),
  hoverPreviewSpinner: document.getElementById("hoverPreviewSpinner")
};

let prompts = [];
let filteredPrompts = [];
let state = null;
let currentPage = 1;
let hoverPreviewToken = 0;

init();

async function init() {
  bindEvents();

  const res = await sendMessage({ type: "GET_PROMPT_STATE" });
  applyState(res);

  if (res.ok && !res.prompts?.length) {
    setStatus("首次初始化中，正在同步默认语言数据...");
    await syncCurrentLanguage();
  }
}

function bindEvents() {
  els.langSelect.addEventListener("change", async () => {
    setBusy(true, "正在切换语言...");
    currentPage = 1;
    els.searchInput.value = "";
    els.categorySelect.value = "";

    const res = await sendMessage({
      type: "SET_LANGUAGE",
      lang: els.langSelect.value
    });

    applyState(res);
    setBusy(false);
  });

  els.categorySelect.addEventListener("change", () => {
    currentPage = 1;
    render();
  });

  if (els.sidePanelBtn) {
    els.sidePanelBtn.addEventListener("click", openSidePanel);
  }

  els.syncBtn.addEventListener("click", syncCurrentLanguage);

  els.checkBtn.addEventListener("click", async () => {
    setBusy(true, "正在检查更新...");
    const res = await sendMessage({ type: "CHECK_UPDATES" });

    if (!res.ok) {
      setStatus(`检查失败：${res.error}`);
      setBusy(false);
      return;
    }

    state.settings.hasUpdate = res.hasUpdate;
    els.updateBanner.hidden = !res.hasUpdate;

    const remoteTime = res.remote?.date
      ? `，远端提交时间 ${new Date(res.remote.date).toLocaleString()}`
      : "";

    setStatus(res.hasUpdate ? `发现更新${remoteTime}` : `当前已是最新${remoteTime}`);
    setBusy(false);
  });

  els.searchInput.addEventListener("input", () => {
    currentPage = 1;
    render();
  });

  els.prevPageBtn.addEventListener("click", () => {
    currentPage = Math.max(1, currentPage - 1);
    render();
    scrollPopupToTop();
  });

  els.nextPageBtn.addEventListener("click", () => {
    const totalPages = getTotalPages();
    currentPage = Math.min(totalPages, currentPage + 1);
    render();
    scrollPopupToTop();
  });
}

async function openSidePanel() {
  if (!chrome.sidePanel?.open) {
    setStatus("当前浏览器不支持侧边栏 API");
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.sidePanel.open({ windowId: tab?.windowId });
    setStatus("已打开浏览器侧边栏");
  } catch (error) {
    console.warn("Open side panel failed:", error);
    setStatus("打开侧边栏失败，请确认浏览器支持扩展侧边栏");
  }
}

async function syncCurrentLanguage() {
  setBusy(true, "正在同步当前语言 Prompt...");
  const res = await sendMessage({
    type: "SYNC_PROMPTS",
    lang: els.langSelect.value || state?.settings?.selectedLang || "zh-CN"
  });

  applyState(res);
  setBusy(false);
}

function applyState(res) {
  if (!res?.ok) {
    setStatus(`加载失败：${res?.error || "未知错误"}`);
    return;
  }

  state = res;
  prompts = res.prompts || [];
  currentPage = 1;

  renderLanguageOptions(res.languages || []);
  els.langSelect.value = res.settings.selectedLang;
  renderCategoryOptions(prompts, "");
  els.updateBanner.hidden = !res.settings.hasUpdate;

  const fetchedAt = res.cache?.fetchedAt
    ? new Date(res.cache.fetchedAt).toLocaleString()
    : "未同步";

  const commitDate = res.cache?.sourceCommitDate
    ? new Date(res.cache.sourceCommitDate).toLocaleString()
    : "未知";

  setStatus(`本地 ${prompts.length} 条，同步时间 ${fetchedAt}，源提交时间 ${commitDate}`);
  render();
}

function renderLanguageOptions(languages) {
  if (els.langSelect.options.length) return;

  const fragment = document.createDocumentFragment();

  for (const lang of languages) {
    const option = document.createElement("option");
    option.value = lang.code;
    option.textContent = lang.label;
    fragment.appendChild(option);
  }

  els.langSelect.appendChild(fragment);
}

function renderCategoryOptions(items, selectedValue) {
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  els.categorySelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = `全部分类（${items.length}）`;
  els.categorySelect.appendChild(allOption);

  for (const category of categories) {
    const count = items.filter(item => item.category === category).length;
    const option = document.createElement("option");
    option.value = category;
    option.textContent = `${category}（${count}）`;
    els.categorySelect.appendChild(option);
  }

  els.categorySelect.value = selectedValue || "";
}

function render() {
  const q = els.searchInput.value.trim().toLowerCase();
  const category = els.categorySelect.value;

  filteredPrompts = prompts.filter(item => {
    if (category && item.category !== category) return false;

    const haystack = `${item.title} ${item.category} ${item.caseNo} ${item.prompt}`.toLowerCase();
    return haystack.includes(q);
  });

  const totalPages = getTotalPages();
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredPrompts.slice(start, start + PAGE_SIZE);

  els.promptList.innerHTML = "";

  if (!pageItems.length) {
    els.promptList.innerHTML = `<div class="empty">没有匹配结果</div>`;
    renderPager();
    return;
  }

  for (const item of pageItems) {
    const card = document.createElement("section");
    card.className = "card";

    const title = document.createElement("h2");
    title.textContent = item.title;

    const meta = document.createElement("div");
    meta.className = "meta";

    const categoryBadge = document.createElement("span");
    categoryBadge.textContent = item.category || "未分类";

    const caseNo = document.createElement("span");
    caseNo.textContent = `Case ${item.caseNo}`;

    const imageBadge = document.createElement("span");
    imageBadge.textContent = item.imageUrl ? "含图片" : "无图片";

    meta.append(categoryBadge, caseNo, imageBadge);

    const prompt = document.createElement("p");
    prompt.className = "prompt";
    prompt.textContent = item.prompt;

    const actions = document.createElement("div");
    actions.className = "actions";

    const fillBtn = document.createElement("button");
    fillBtn.className = "primary";
    fillBtn.textContent = "填入 ChatGPT";
    fillBtn.addEventListener("click", () => fillChatGPT(item.prompt));

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "复制";
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.prompt);
      setStatus("已复制 Prompt");
    });

    const previewBtn = document.createElement("button");
    previewBtn.textContent = "预览";
    previewBtn.disabled = !item.imageUrl;
    previewBtn.setAttribute("aria-label", item.imageUrl ? "悬停预览图片" : "无可预览图片");
    previewBtn.addEventListener("mouseenter", () => showHoverPreview(item, previewBtn));
    previewBtn.addEventListener("mouseleave", hideHoverPreview);
    previewBtn.addEventListener("focus", () => showHoverPreview(item, previewBtn));
    previewBtn.addEventListener("blur", hideHoverPreview);

    actions.append(fillBtn, copyBtn, previewBtn);
    card.append(title, meta, prompt, actions);
    els.promptList.appendChild(card);
  }

  renderPager();
}

function renderPager() {
  const totalPages = getTotalPages();
  const total = filteredPrompts.length;
  const start = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(currentPage * PAGE_SIZE, total);

  els.pageInfo.textContent = total
    ? `第 ${currentPage} / ${totalPages} 页，${start}-${end} / ${total}`
    : "第 0 / 0 页";

  els.prevPageBtn.disabled = currentPage <= 1;
  els.nextPageBtn.disabled = currentPage >= totalPages;
}

function getTotalPages() {
  return Math.max(1, Math.ceil(filteredPrompts.length / PAGE_SIZE));
}

function showHoverPreview(item, anchor) {
  if (!item?.imageUrl) return;

  const token = ++hoverPreviewToken;

  els.hoverPreview.hidden = false;
  els.hoverPreview.classList.add("is-loading");
  els.hoverPreviewImage.hidden = true;
  els.hoverPreviewSpinner.hidden = false;
  els.hoverPreviewImage.removeAttribute("src");
  els.hoverPreviewImage.alt = item.imageAlt || item.title || "Prompt output preview";

  positionHoverPreview(anchor);

  els.hoverPreviewImage.onload = () => {
    if (token !== hoverPreviewToken) return;
    els.hoverPreview.classList.remove("is-loading");
    els.hoverPreviewSpinner.hidden = true;
    els.hoverPreviewImage.hidden = false;
  };

  els.hoverPreviewImage.onerror = () => {
    if (token !== hoverPreviewToken) return;
    hideHoverPreview();
  };

  els.hoverPreviewImage.src = item.imageUrl;
}

function hideHoverPreview() {
  hoverPreviewToken += 1;
  els.hoverPreview.hidden = true;
  els.hoverPreview.classList.remove("is-loading");
  els.hoverPreviewSpinner.hidden = true;
  els.hoverPreviewImage.hidden = true;
  els.hoverPreviewImage.onload = null;
  els.hoverPreviewImage.onerror = null;
  els.hoverPreviewImage.removeAttribute("src");
}

function positionHoverPreview(anchor) {
  const rect = anchor.getBoundingClientRect();
  const previewWidth = 280;
  const gap = 8;

  const left = Math.min(
    Math.max(10, rect.left),
    Math.max(10, window.innerWidth - previewWidth - 10)
  );

  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow >= 230
    ? rect.bottom + gap
    : Math.max(10, rect.top - 230 - gap);

  els.hoverPreview.style.left = `${left}px`;
  els.hoverPreview.style.top = `${top}px`;
}

function scrollPopupToTop() {
  requestAnimationFrame(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

async function fillChatGPT(promptText) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    setStatus("未找到当前标签页");
    return;
  }

  const url = tab.url || "";

  if (!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url)) {
    await navigator.clipboard.writeText(promptText);
    setStatus("当前不是 ChatGPT 页面，已复制到剪贴板");
    return;
  }

  chrome.tabs.sendMessage(
    tab.id,
    {
      type: "FILL_CHATGPT_PROMPT",
      payload: promptText
    },
    async response => {
      if (chrome.runtime.lastError || !response?.ok) {
        await navigator.clipboard.writeText(promptText);
        setStatus("未能填入输入框，已复制到剪贴板");
        return;
      }

      setStatus("已填入 ChatGPT 输入框");
    }
  );
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function setBusy(isBusy, text) {
  els.syncBtn.disabled = isBusy;
  els.checkBtn.disabled = isBusy;
  if (els.sidePanelBtn) els.sidePanelBtn.disabled = isBusy;
  els.langSelect.disabled = isBusy;
  els.categorySelect.disabled = isBusy;
  els.prevPageBtn.disabled = isBusy || currentPage <= 1;
  els.nextPageBtn.disabled = isBusy || currentPage >= getTotalPages();

  if (text) {
    setStatus(text);
  }
}

function setStatus(text) {
  els.status.textContent = text;
}
