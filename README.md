# Zotero Smart Paste

将 AI Studio 中的选中文字或单条回答复制为 Zotero 笔记，保留可编辑公式、标题、列表、表格和代码。转换在本地完成，无需 API 密钥。

当前版本：**v1.0.3**。本项目借助 AI 开发和整理发行说明，采用 MIT 许可证。

## 下载安装

1. 前往[发行版页面](https://github.com/GuHong-zyx/Zotero-Smart-Paste/releases)，下载 `Zotero-Smart-Paste-v1.0.3.zip` 并解压到固定位置。
2. 在 Edge 打开 `edge://extensions`，开启“开发人员模式”。Chrome 对应页面为 `chrome://extensions`。
3. 点击“加载解压缩的扩展”，选择解压后的 **extension** 文件夹。该文件夹内应有 `manifest.json`。

普通使用无需安装 Node.js 或运行构建命令。这是浏览器扩展，不是在 Zotero 中安装的插件。

## 使用

1. 在 AI Studio 回答正文中选中所需内容，按 **Ctrl＋Shift＋Z**；也可以右键选择“复制选区到 Zotero（保留公式）”。
2. 切换到 Zotero 的普通笔记正文，按 **Ctrl＋V** 粘贴。请勿使用“粘贴为纯文本”，也不要先进入公式编辑框。
3. 复制整条回答时，点击浏览器工具栏的扩展图标，选择“点选一条回答”，确认绿色框覆盖目标后点击；按 Esc 取消。

快捷键无效时，打开 `edge://extensions/shortcuts`，检查“复制选区到 Zotero”的设置。当前默认组合键为 `Ctrl+Shift+Z`。

## 免安装转换页

用 Edge 或 Chrome 打开 `extension/convert.html`，在左侧粘贴含 LaTeX 的 Markdown 或原网页富文本，检查右侧预览，点击“复制到 Zotero”，再到笔记正文粘贴。

## 从旧版升级

用新版 `extension` 文件夹内的文件覆盖原安装目录，在扩展管理页点击“重新加载”。浏览器可能保留旧快捷键，请到 `edge://extensions/shortcuts` 将“复制选区到 Zotero”改为 **Ctrl＋Shift＋Z**。也可以移除旧版后重新加载新版。

v1.0.3 直接处理选区节点，修复 AI Studio 用 PRE／CODE 包裹行内公式时产生的额外断段，也保留加粗文字中的公式。继续清理空段落和块间缩进空白。保留列表类型、层级、起始编号及真实代码空行。已经粘贴的错误断段不会自动重排，需要重新复制相应内容。

如果有序列表中的无序子列表仍显示为数字，或段距仍偏大，请检查 Zotero 的自定义笔记样式。列表规则应区分直接子项，例如使用 `ol > li`；扩展不会覆盖 Zotero 的全局字体、配色和段距。

## 范围与权限

- 支持常见 LaTeX 数学分隔符、网页中可提取的公式源码，以及基本富文本结构；保留真正的代码块。
- 不识别公式图片，也不能恢复已经丢失的上下标或公式源码；不复制图片及网页自定义样式。
- 扩展在主动触发时读取当前页面选区或点选范围；申请的权限为 `activeTab`、`scripting`、`clipboardWrite` 和 `contextMenus`。
- 转换代码不包含网络上传或统计功能。网页结构变化可能影响“点选回答”，此时可改用选区复制。
- 自动检查覆盖转换逻辑、官方 Zotero 笔记结构和浏览器剪贴板；AI Studio 实际页面与 Zotero 桌面的跨应用粘贴仍需人工核对。

## 开发与测试

```sh
npm ci
npm run build
git clone https://github.com/zotero/note-editor.git ../research/note-editor
git -C ../research/note-editor checkout 7439a18414ffa6e90918283da9e4dbd35fce1a97
npm test
npx playwright install chromium
npm run test:browser
```

测试通过固定提交的 Zotero 官方笔记结构核对行内公式与独立公式。`research` 位于本项目同级目录，仅用于测试，不包含在发行包中。浏览器测试可通过 `PLAYWRIGHT_EXECUTABLE_PATH` 指定本机浏览器路径。

第三方许可证见 `extension/vendor`。源码见本仓库，历史版本见[更新记录](CHANGELOG.md)。
