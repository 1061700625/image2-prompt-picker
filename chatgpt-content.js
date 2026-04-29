chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "FILL_CHATGPT_PROMPT") return;

  const ok = fillPrompt(message.payload || "");
  sendResponse({ ok });

  return true;
});

function fillPrompt(text) {
  const composer = findComposer();

  if (!composer) return false;

  composer.focus();

  if (composer.tagName === "TEXTAREA" || composer.tagName === "INPUT") {
    setNativeInputValue(composer, text);
    return true;
  }

  if (composer.isContentEditable) {
    return setContentEditableValue(composer, text);
  }

  return false;
}

function findComposer() {
  const selectors = [
    "#prompt-textarea",
    "[data-testid='composer-text-input']",
    "div.ProseMirror[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']",
    "textarea"
  ];

  for (const selector of selectors) {
    const nodes = [...document.querySelectorAll(selector)];
    const visible = nodes.find(isVisible);

    if (visible) return visible;
  }

  return null;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
}

function setNativeInputValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");

  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: value
  }));

  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function setContentEditableValue(el, value) {
  el.focus();

  try {
    document.execCommand("selectAll", false, null);
    const inserted = document.execCommand("insertText", false, value);

    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value
    }));

    if (inserted) return true;
  } catch (error) {
    console.warn("execCommand failed:", error);
  }

  try {
    el.innerHTML = "";
    const lines = String(value).split("\n");

    for (const line of lines) {
      const p = document.createElement("p");
      p.textContent = line || "\u00A0";
      el.appendChild(p);
    }

    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value
    }));

    return true;
  } catch (error) {
    console.warn("Direct contenteditable update failed:", error);
    return false;
  }
}
