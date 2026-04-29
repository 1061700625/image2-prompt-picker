const MESSAGE_TYPE = "FILL_CHATGPT_PROMPT";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MESSAGE_TYPE) return;

  fillPrompt(message.payload || "")
    .then(sendResponse)
    .catch(error => {
      console.warn("Fill ChatGPT prompt failed:", error);
      sendResponse({ ok: false, reason: error?.message || "unknown_error" });
    });

  return true;
});

async function fillPrompt(text) {
  const composer = await waitForComposer(2500);

  if (!composer) {
    return { ok: false, reason: "composer_not_found" };
  }

  const ok = await writeToComposer(composer, text);

  return {
    ok,
    reason: ok ? "filled" : "write_failed"
  };
}

async function waitForComposer(timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const composer = findComposer();
    if (composer) return composer;
    await sleep(120);
  }

  return findComposer();
}

function findComposer() {
  const selectors = [
    "#prompt-textarea",
    "[data-testid='composer-text-input']",
    "div.ProseMirror[contenteditable='true']",
    "[contenteditable='true'][role='textbox']",
    "[contenteditable='true'][aria-label]",
    "div[contenteditable='true']",
    "textarea[data-testid='composer-text-input']",
    "textarea[placeholder]",
    "textarea"
  ];

  const candidates = uniqueElements(
    selectors.flatMap(selector => [...document.querySelectorAll(selector)])
  )
    .map(normalizeComposerElement)
    .filter(Boolean)
    .filter(isUsableComposer);

  candidates.sort((a, b) => getComposerScore(b) - getComposerScore(a));

  return candidates[0] || null;
}

function normalizeComposerElement(el) {
  if (!el) return null;

  if (isTextInput(el) || el.isContentEditable) {
    return el;
  }

  const editable = el.querySelector?.("[contenteditable='true']");
  if (editable) return editable;

  const textarea = el.querySelector?.("textarea");
  if (textarea) return textarea;

  return null;
}

function isUsableComposer(el) {
  if (!el) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (el.closest("[aria-hidden='true']")) return false;

  if (isTextInput(el) && (el.disabled || el.readOnly)) return false;
  if (el.getAttribute("contenteditable") === "false") return false;

  const rect = el.getBoundingClientRect();
  const hasBox = rect.width > 1 && rect.height > 1;
  const hasClientRect = el.getClientRects().length > 0;

  return hasBox || hasClientRect || el === document.activeElement;
}

function getComposerScore(el) {
  const rect = el.getBoundingClientRect();
  const id = el.id || "";
  const testId = el.getAttribute("data-testid") || "";
  const role = el.getAttribute("role") || "";
  const className = String(el.className || "");

  let score = 0;

  if (id === "prompt-textarea") score += 100;
  if (/composer|prompt/i.test(testId)) score += 80;
  if (role === "textbox") score += 45;
  if (el.isContentEditable) score += 35;
  if (isTextInput(el)) score += 30;
  if (/ProseMirror/i.test(className)) score += 25;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  if (viewportHeight && rect.top > viewportHeight * 0.35) score += 20;
  if (rect.width > 200) score += 10;

  return score;
}

async function writeToComposer(el, value) {
  el.focus();
  await sleep(30);

  if (isTextInput(el)) {
    setNativeInputValue(el, value);
    return el.value === value;
  }

  const editable = el.isContentEditable
    ? el
    : el.closest?.("[contenteditable='true']") || el.querySelector?.("[contenteditable='true']");

  if (!editable) return false;

  return setContentEditableValue(editable, value);
}

function setNativeInputValue(el, value) {
  const proto = el.tagName === "TEXTAREA"
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");

  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }

  dispatchComposerEvents(el, value);
}

function setContentEditableValue(el, value) {
  el.focus();

  try {
    const selection = window.getSelection();
    const range = document.createRange();

    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);

    const inserted = document.execCommand("insertText", false, value);
    dispatchComposerEvents(el, value);

    if (inserted && containsPromptText(el, value)) {
      moveCaretToEnd(el);
      return true;
    }
  } catch (error) {
    console.warn("execCommand insertText failed:", error);
  }

  try {
    replaceEditableDom(el, value);
    dispatchComposerEvents(el, value);
    moveCaretToEnd(el);

    return containsPromptText(el, value);
  } catch (error) {
    console.warn("Direct contenteditable update failed:", error);
    return false;
  }
}

function replaceEditableDom(el, value) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }

  const lines = String(value).split("\n");

  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line || "\u00A0";
    el.appendChild(p);
  }
}

function dispatchComposerEvents(el, value) {
  try {
    el.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: value
    }));
  } catch (_) {
    // Some browsers disallow constructing beforeinput. The input event below is enough for fallback.
  }

  el.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: value
  }));

  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " ", code: "Space" }));
}

function moveCaretToEnd(el) {
  try {
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch (_) {
    // Non-critical.
  }
}

function containsPromptText(el, value) {
  const expected = normalizeText(value).slice(0, 80);
  if (!expected) return true;

  return normalizeText(el.value || el.innerText || el.textContent || "").includes(expected);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTextInput(el) {
  return el?.tagName === "TEXTAREA" || el?.tagName === "INPUT";
}

function uniqueElements(items) {
  return [...new Set(items)];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
