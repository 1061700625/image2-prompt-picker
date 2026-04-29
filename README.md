# GPT Image2 Prompts

GPT Image2 Prompts 是一个浏览器扩展，用于整理、浏览和快速使用 GPT Image 2 图片生成提示词。

它可以从公开提示词仓库同步数据到本地，支持多语言切换、分类筛选、关键词搜索、分页浏览、图片悬停预览，并可以将选中的 Prompt 快速填入 ChatGPT 输入框。

作者：小锋学长生活大爆炸

数据来源：
https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts

本项目不是 EvoLinkAI 官方项目，仅基于其公开仓库数据进行整理和浏览展示。

<p align="center">
  <img src="https://github.com/user-attachments/assets/638039a5-221f-4e0f-b6cd-55e0c7eb81d7" alt="" width="400"/>
</p>

## 功能特性

* 支持 GPT Image 2 Prompt 本地浏览

* 支持多语言数据源

* 支持分类下拉筛选

* 支持关键词搜索

* 支持上一页和下一页分页

* 支持图片悬停预览

* 图片加载中显示 loading 状态

* 支持一键复制 Prompt

* 支持一键填入 ChatGPT 输入框

* 支持浏览器侧边栏

* 支持本地缓存，避免每次打开都重新拉取

* 支持手动同步

* 支持自动检测远端更新

* 支持 Chrome 和 Microsoft Edge 等 Chromium 内核浏览器

## 数据来源说明

本扩展使用以下公开仓库作为 Prompt 数据来源。

https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts

扩展会根据用户选择的语言读取对应的 Markdown 文件，例如：

* README.md

* README_zh-CN.md

* README_zh-TW.md

* README_ja.md

* README_ko.md

* README_es.md

* README_pt.md

* README_de.md

* README_fr.md

* README_tr.md

* README_ru.md

图片预览会根据 Markdown 中的图片路径生成 GitHub raw 图片地址。

例如：

```html
<img src="./images/poster_case113/output.jpg" width="300" alt="Output image">
```

会被转换为：

```txt
https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts/blob/main/images/poster_case113/output.jpg?raw=true
```

## 安装方式

### Chrome

1. 下载并解压扩展压缩包。

2. 打开 Chrome 浏览器。

3. 进入 `chrome://extensions/`。

4. 开启右上角的“开发者模式”。

5. 点击“加载已解压的扩展程序”。

6. 选择解压后的扩展目录。

### Microsoft Edge

1. 下载并解压扩展压缩包。

2. 打开 Edge 浏览器。

3. 进入 `edge://extensions/`。

4. 开启“开发人员模式”。

5. 点击“加载解压缩的扩展”。

6. 选择解压后的扩展目录。

## 使用方式

安装扩展后，点击浏览器工具栏中的扩展图标即可打开 Prompt 面板。

首次打开时，扩展会初始化并同步当前语言的数据到本地。后续打开时会优先读取本地缓存，减少远端请求。

你可以在面板中完成以下操作：

1. 选择语言。

2. 选择分类。

3. 输入关键词搜索 Prompt。

4. 点击上一页或下一页浏览更多内容。

5. 鼠标悬停在预览按钮上查看图片效果。

6. 点击复制按钮复制 Prompt。

7. 在 ChatGPT 页面点击填入按钮，将 Prompt 快速填入输入框。

8. 点击侧边栏按钮，在浏览器侧边栏中使用完整功能。

## 同步与更新

扩展支持本地缓存和远端更新检测。

* 首次使用会自动初始化当前语言的数据。

* 点击“同步”按钮可以手动拉取最新 Prompt。

* 扩展会定期检测当前语言文件的最新提交。

* 如果远端数据有更新，扩展会提示用户同步。

这样可以避免每次打开扩展都请求远端数据，同时保证用户可以按需更新到最新 Prompt。

## 浏览器侧边栏

本扩展支持浏览器侧边栏。

点击 popup 中的“侧边栏”按钮后，可以在浏览器侧边栏中打开 Prompt 面板。侧边栏适合长时间浏览、搜索和使用 Prompt，不需要频繁打开和关闭弹窗。

侧边栏功能与 popup 保持一致，包括：

* 语言切换

* 分类筛选

* 关键词搜索

* 分页浏览

* 图片悬停预览

* Prompt 复制

* 填入 ChatGPT

## 权限说明

本扩展会使用以下权限。

### storage

用于保存本地 Prompt 缓存、语言设置、同步时间和远端更新状态。

### activeTab

用于在当前 ChatGPT 标签页中填入 Prompt。

### alarms

用于定期检测远端数据是否有更新。

### sidePanel

用于支持浏览器侧边栏。

### host permissions

扩展需要访问以下地址：

```txt
https://api.github.com/*
https://raw.githubusercontent.com/EvoLinkAI/awesome-gpt-image-2-prompts/*
https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts/*
https://chatgpt.com/*
https://chat.openai.com/*
```

这些权限分别用于：

* 获取 GitHub 仓库最新提交信息

* 拉取 Markdown Prompt 数据

* 加载 Prompt 预览图片

* 向 ChatGPT 输入框填入 Prompt

## 隐私说明

本扩展不会收集用户隐私数据。

扩展只会在本地保存以下信息：

* 用户选择的语言

* 本地缓存的 Prompt 数据

* 最近一次同步时间

* 最近一次检测更新时间

* 当前语言对应的远端提交信息

扩展不会上传用户输入内容，也不会收集浏览记录。

## 开发说明

项目结构示例：

```txt
gpt-image2-prompts/
  manifest.json
  background.js
  popup.html
  popup.css
  popup.js
  sidepanel.html
  chatgpt-content.js
  README.md
```

主要模块说明：

* `manifest.json` 定义扩展权限、入口和侧边栏配置。

* `background.js` 负责初始化、本地缓存、同步数据和检测更新。

* `popup.html` 负责弹窗页面结构。

* `popup.css` 负责弹窗和侧边栏样式。

* `popup.js` 负责搜索、筛选、分页、预览、复制和填入逻辑。

* `sidepanel.html` 复用 popup 功能，用于浏览器侧边栏。

* `chatgpt-content.js` 负责向 ChatGPT 输入框写入 Prompt。

## 适用场景

GPT Image2 Prompts 适合以下用户：

* 经常使用 GPT Image 2 生成图片的用户

* 想快速查找高质量图片 Prompt 的用户

* 需要按分类浏览图片生成案例的用户

* 想在 ChatGPT 中快速复用 Prompt 的用户

* 想对多语言 Prompt 做本地整理和浏览的用户

## 免责声明

本扩展仅用于学习、研究和个人效率提升。

Prompt 数据来源于 EvoLinkAI 的公开仓库：

https://github.com/EvoLinkAI/awesome-gpt-image-2-prompts

所有 Prompt、图片、案例和原始贡献者信息的版权归原仓库及对应贡献者所有。

本项目不是 EvoLinkAI 官方项目，也不代表 EvoLinkAI 的立场或承诺。

## License

&#x20;Apache  License。
