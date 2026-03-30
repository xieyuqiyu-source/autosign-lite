# AutoSign Lite

`AutoSign Lite` 是一个基于 `Tauri 2 + Vite` 构建的桌面工具，用来集中处理账号登录、验证码流程和 pit 栏位查询。

它的定位不是通用 SaaS，而是一个可本地运行、可打包、可长期自用的小型桌面面板，目的是把原本零散的登录和栏位操作收拢到一个界面里。

## 功能概览

- 支持账号密码登录
- 支持手机号 + 图形验证码 + 短信验证码登录
- 本地保存多个账号记录
- 自动保存最近登录时间和 token
- 刷新并展示三栏位信息
- 一键租借 `ChatGPT` 对应栏位
- 获取指定栏位验证码并复制
- 将本地账号导出为 `CSV`

## 当前技术栈

- 桌面容器：`Tauri 2`
- 前端：`Vite`
- 界面调用：`@tauri-apps/api`
- 后端逻辑：`Rust`
- 网络请求：`reqwest`
- 样式依赖：`tailwindcss`、`daisyui`

## 界面能力

当前界面主要分成两块：

- 左侧操作面板
  - 切换密码登录 / 手机号登录
  - 获取图形验证码
  - 请求短信验证码
  - 登录、保存账号、刷新栏位、清空表单
  - 查看状态提示并复制当前 token
- 右侧信息区
  - 展示本地保存的账号列表
  - 导出账号 CSV
  - 展示三栏位状态
  - 发起借 `ChatGPT`

## 运行环境

建议使用以下环境：

- `Node.js 18+`
- `npm 9+`
- `Rust` stable toolchain
- `Tauri 2` 所需本地构建依赖

如果是首次在本机跑 Tauri 项目，建议先确认系统已经具备对应平台的原生依赖：

- macOS：需要 `Xcode Command Line Tools`
- Windows：需要 `Microsoft C++ Build Tools` / WebView2 相关运行环境

## 快速开始

安装依赖：

```bash
npm install
```

启动前端开发服务器：

```bash
npm run dev
```

启动桌面开发模式：

```bash
npm run tauri:dev
```

打包桌面应用：

```bash
npm run tauri:build
```

## 可用脚本

`package.json` 中当前可用脚本如下：

- `npm run dev`：启动 Vite 开发服务器，端口为 `1420`
- `npm run build`：构建前端静态资源到 `dist/`
- `npm run preview`：本地预览前端构建结果
- `npm run tauri:dev`：启动 Tauri 桌面开发模式
- `npm run tauri:build`：打包桌面应用

## 数据与导出

项目当前会在本地保存账号数据，保存内容包括：

- `account`
- `password`
- `login_type`
- `last_login`
- `token`

数据由 Tauri 侧写入应用数据目录下的 `accounts.json`。

导出账号时，会优先导出到以下目录之一：

- 桌面目录
- 下载目录
- 应用数据目录

导出文件名格式类似：

```text
autosign_accounts_<timestamp>.csv
```

## 接口能力

Rust 侧当前封装了以下主要命令：

- `load_accounts`
- `save_account`
- `login`
- `fetch_phone_captcha`
- `request_phone_code`
- `login_by_phone`
- `fetch_pits`
- `rent_chatgpt`
- `fetch_verification_code`
- `export_accounts`

对应能力覆盖了账号管理、登录、验证码流程、pit 查询和数据导出。

## 项目结构

```text
AutoSign/
├─ src/
│  ├─ main.js              # 前端界面、按钮事件、状态管理
│  ├─ style.css            # 页面样式
│  └─ counter.js           # Vite 默认示例文件，当前业务未依赖
├─ src-tauri/
│  ├─ src/lib.rs           # Tauri 命令、接口请求、本地存储、CSV 导出
│  ├─ Cargo.toml           # Rust 依赖定义
│  └─ tauri.conf.json      # 桌面窗口和打包配置
├─ public/                 # 静态资源
├─ dist/                   # 前端构建产物
├─ index.html              # 前端入口
├─ package.json            # Node 脚本和前端依赖
└─ README.md
```

## 打包信息

当前 Tauri 配置中的产品信息如下：

- 产品名：`AutoSign Lite`
- 应用标识：`cn.xieyuqiyu.autosignlite`
- 默认窗口大小：`1320 x 860`
- 最小窗口大小：`1180 x 820`

当前配置的打包目标：

- macOS：`dmg`
- Windows：`nsis`

## 开发说明

- 前端和后端桥接通过 `invoke` 调用 Tauri 命令完成
- 网络请求和本地文件读写都在 `src-tauri/src/lib.rs` 中处理
- 本地账号会按最近登录时间排序
- 手机号登录流程依赖图形验证码和短信验证码接口返回
- `token` 会在登录成功后写入本地账号记录，可用于后续栏位请求

## 已知边界

- 这是面向个人使用场景的桌面工具，不是多租户系统
- 本地会保存敏感信息，使用前需要明确本机安全边界
- 当前没有完善的自动化测试和错误恢复机制
- 目前 README 说明基于现有代码实现，不代表远端接口永久稳定

## 后续建议

如果后面继续迭代，建议优先补这几类内容：

- 账号数据加密存储
- 更明确的错误提示和重试机制
- CSV 导出字段说明
- 基础自动化测试
- 发布流程和版本记录

## 常用入口

日常开发最常用的几个文件：

- `src/main.js`
- `src/style.css`
- `src-tauri/src/lib.rs`
- `src-tauri/tauri.conf.json`

如果只是想快速跑起来，优先执行：

```bash
npm run tauri:dev
```
