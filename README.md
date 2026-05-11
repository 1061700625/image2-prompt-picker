# GPT Image2 Prompts

快速浏览和使用 GPT Image 2 图片生成提示词。

GPT Image2 Prompts 是一个浏览器扩展，用于从公开 Prompt 仓库同步 GPT Image 2 图片生成提示词，并在本地完成浏览、筛选、搜索、翻译、复制和快速填入 ChatGPT。

作者：[小锋学长生活大爆炸](https://github.com/1061700625/image2-prompt-picker)

数据来源：[EvoLinkAI/awesome-gpt-image-2-API-and-Prompts](https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts)

本项目不是 EvoLinkAI 官方项目，仅基于其公开仓库数据进行整理和浏览展示。

<p align="center">
  <img src="https://github.com/user-attachments/assets/638039a5-221f-4e0f-b6cd-55e0c7eb81d7" alt="GPT Image2 Prompts" width="400"/>
</p>

## 版本

当前版本：`0.0.3`

## 功能特性

* 支持 GPT Image 2 Prompt 本地浏览
* 支持多语言数据源
* 支持分类筛选
* 支持关键词搜索
* 支持上一页和下一页分页浏览
* 支持图片悬停预览
* 图片加载中显示 loading 状态
* 支持一键复制 Prompt
* 支持一键填入 ChatGPT 输入框
* 支持将单条 Prompt 翻译为中文
* 支持将已翻译内容还原为原文
* 支持浏览器侧边栏
* 支持本地缓存，避免每次打开都重新拉取
* 支持手动同步远端数据
* 支持清空本地 Prompt 缓存
* 支持自动检测远端更新
* 支持 Chrome 和 Microsoft Edge 等 Chromium 内核浏览器

## 数据来源说明

本扩展使用以下公开仓库作为 Prompt 数据来源。

https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts

当前 Prompt 数据位于仓库的 `cases` 目录下。

https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts/tree/main/cases

扩展会根据用户选择的语言读取对应的 Markdown 文件。

文件命名规则如下：

```txt
<功能>.md
<功能>_<语言>.md
```

例如：

```txt
ad-creative.md
ad-creative_zh-CN.md
character.md
character_zh-CN.md
comparison.md
comparison_zh-CN.md
ecommerce.md
ecommerce_zh-CN.md
portrait.md
portrait_zh-CN.md
poster.md
poster_zh-CN.md
```

语言读取规则：

* 英文读取 `cases/*.md`
* 简体中文读取 `cases/*_zh-CN.md`
* 繁体中文读取 `cases/*_zh-TW.md`
* 日语读取 `cases/*_ja.md`
* 韩语读取 `cases/*_ko.md`
* 西班牙语读取 `cases/*_es.md`
* 葡萄牙语读取 `cases/*_pt.md`
* 德语读取 `cases/*_de.md`
* 法语读取 `cases/*_fr.md`
* 土耳其语读取 `cases/*_tr.md`
* 俄语读取 `cases/*_ru.md`

扩展会将不同功能文件自动归类，并在面板中展示为分类选项。

图片预览会根据 Markdown 中的图片路径生成 GitHub raw 图片地址。

例如：

```html
<img src="../images/example/output.jpg" width="300" alt="Output image">
```

会被转换为可直接预览的 GitHub 图片地址。

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
6. 点击复制按钮复制当前 Prompt。
7. 在 ChatGPT 页面点击填入按钮，将 Prompt 快速填入输入框。
8. 点击翻译按钮，将当前 Prompt 翻译为中文。
9. 点击还原原文按钮，将已翻译内容恢复为原文。
10. 点击清空缓存按钮，清除本地 Prompt 缓存。
11. 点击同步按钮，重新拉取远端最新数据。
12. 点击侧边栏按钮，在浏览器侧边栏中使用完整功能。

## 翻译功能

每个 Prompt 项都提供翻译按钮。

点击翻译后，扩展会调用以下接口，将当前项翻译为中文：

```txt
https://translate.xfxuezhang.workers.dev/?dt=t&sl=auto&tl=zh&q=<翻译文本>
```

翻译内容只保存在当前运行时状态中，不会覆盖本地缓存和远端同步数据。

翻译后按钮会变为“还原原文”，再次点击即可恢复原始内容。

在翻译状态下点击复制或填入 ChatGPT，会使用当前显示的中文内容。

## 同步与缓存

扩展支持本地缓存和远端更新检测。

* 首次使用会自动初始化当前语言的数据。
* 点击“同步”按钮可以手动拉取最新 Prompt。
* 点击“清空缓存”按钮可以清除本地 Prompt 缓存。
* 清空缓存不会删除当前语言设置。
* 扩展会定期检测远端数据是否有更新。
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
* Prompt 翻译
* Prompt 还原原文
* 填入 ChatGPT
* 手动同步
* 清空缓存

## 作者与数据来源

扩展底部会展示作者和数据来源。

作者：

https://github.com/1061700625/image2-prompt-picker

数据来源：

https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts

点击作者名称会跳转到本项目 GitHub 仓库。

## 权限说明

本扩展会使用以下权限。

### storage

用于保存本地 Prompt 缓存、语言设置、同步时间和远端更新状态。

### activeTab

用于在当前 ChatGPT 标签页中填入 Prompt。

### scripting

用于向当前 ChatGPT 页面注入填入 Prompt 所需的脚本能力。

### alarms

用于定期检测远端数据是否有更新。

### sidePanel

用于支持浏览器侧边栏。

### host permissions

扩展需要访问以下地址：

```txt
https://api.github.com/*
https://raw.githubusercontent.com/*
https://github.com/*
https://chatgpt.com/*
https://chat.openai.com/*
https://translate.xfxuezhang.workers.dev/*
```

这些权限分别用于：

* 获取 GitHub 仓库目录信息
* 获取 GitHub 仓库最新提交信息
* 拉取 Markdown Prompt 数据
* 加载 Prompt 预览图片
* 向 ChatGPT 输入框填入 Prompt
* 调用翻译接口将 Prompt 翻译为中文

## 隐私说明

本扩展不会收集用户隐私数据。

扩展只会在本地保存以下信息：

* 用户选择的语言
* 本地缓存的 Prompt 数据
* 最近一次同步时间
* 最近一次检测更新时间
* 当前语言对应的远端提交信息

扩展不会上传用户输入内容，也不会收集浏览记录。

翻译功能只会在用户主动点击“翻译”按钮时，将当前 Prompt 文本发送到翻译接口。

## 免责声明

本扩展仅用于整理、浏览和使用公开 Prompt 数据。

Prompt 数据版权归原数据源仓库及其贡献者所有。

本项目不是 EvoLinkAI 官方项目，也不代表 EvoLinkAI 立场。
