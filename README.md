# JSONPal

一个专注于 JSON 编辑、校验和转换的 Electron 桌面工具。

## 功能

- Monaco JSON 编辑器，支持缩略预览、折叠、粘滞滚动和错误定位
- JSON 格式化与压缩
- JSON 转义与去除转义
- JSON 实时校验，错误行以红色背景和右侧概览标记显示
- 复制和清空编辑器内容
- 独立设置窗口，可配置编辑器显示选项、字体大小和滚动条宽度
- 设置仅在点击“应用设置”后生效并持久化

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本

## 本地开发

```bash
npm install
npm run dev
```

## 构建测试版

先执行一次生产构建，确认项目能够打包：

```bash
npm run build
```

### macOS

```bash
npm run build:mac
```

### Windows

```bash
npm run build:win
```

### 不生成安装包的目录版本

```bash
npm run build:unpack
```

Electron Builder 的产物默认写入 `dist/` 目录。

## 使用说明

- 点击顶部星光图标格式化 JSON。
- 点击顶部压缩图标将 JSON 压缩为单行。
- 点击引号图标转义当前编辑器内容。
- 点击回转箭头图标去除 JSON 转义，支持带或不带外层引号的转义文本。
- 点击齿轮图标打开独立的编辑器设置窗口，调整完成后点击“应用设置”。

## 设置持久化

应用设置保存到 Electron 的用户数据目录：

```text
editor-settings.json
```

该目录由 Electron 按操作系统管理，通常位于：

- macOS：`~/Library/Application Support/JSONPal/`
- Windows：`%APPDATA%/JSONPal/`
- Linux：`~/.config/JSONPal/`

## 测试版提示

首个测试版未进行代码签名。macOS 可能在首次打开时显示开发者无法验证的系统提示；Windows 也可能显示 SmartScreen 提示。请仅从可信来源获取和运行测试包。

## 常用命令

```bash
npm run dev
npm run build
npm run build:mac
npm run build:win
npm run build:linux
npm run build:unpack
```
