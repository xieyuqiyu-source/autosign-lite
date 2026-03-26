# AutoSign Lite

一个轻量的桌面小工具，使用 Tauri 2 + Vite + daisyUI 开发，定位是“插件式”的极简账号操作面板。它替代了之前的 Python 版，支持本地保存账号、密码登录、手机号验证码登录、获取 pit 三栏位，以及栏位验证码提取，并且已经具备 macOS `dmg` 和 Windows `exe` 的打包能力。

## 当前功能

- 单窗口、紧凑型、daisyUI 极简界面
- 支持两种登录方式
- 密码登录
- 手机号验证码登录
- 本地保存多个账号记录
- 账号列表支持载入
- 密码账号可直接载入并登录
- 手机号账号可直接载入手机号并继续验证码流程
- 登录成功后自动保存 `Bearer token`
- 支持导出账号列表 CSV
- 自动调用 pit 接口并展示三个栏位
- 已解锁栏位支持展示账号、密码、状态
- 每个栏位支持获取验证码、复制账号、复制密码、复制验证码
- 获取验证码时带 loading 状态

## 技术方案

- 前端：Vite + 原生 JavaScript
- 桌面壳：Tauri 2
- UI：Tailwind CSS + daisyUI
- 本地存储：Rust 侧 JSON 文件
- 接口请求：Rust `reqwest`

这个方案比 Electron 更省资源，适合做常驻小工具，也更适合后续打包 `dmg` / `exe`。

## 接口约定

### 1. 密码登录接口

- 地址：`https://jiegehao.cn/api/policy/password`
- 方法：`POST`
- 请求体：

```json
{
  "account": "xxx",
  "password": "xxx"
}
```

成功后从返回体 `data.token` 中提取 token，并以：

```text
Authorization: Bearer <token>
```

形式调用后续接口。

### 2. 图形验证码接口

- 地址：`https://jiegehao.cn/api/captcha`
- 方法：`GET`

返回示例字段：

- `captchaId`
- `picPath`
- `captchaLength`
- `openCaptcha`

前端会直接显示 `picPath` 对应的 base64 图片。

### 3. 获取短信验证码接口

- 地址：`https://jiegehao.cn/api/policy/code`
- 方法：`POST`
- 请求体：

```json
{
  "phone": "187xxxx6466",
  "bi": 1,
  "captcha": "714618",
  "captchaId": "mkeSbecxUeK0S4dV1h7g"
}
```

### 4. 手机号登录接口

- 地址：`https://jiegehao.cn/api/policy/identity`
- 方法：`POST`
- 请求体：

```json
{
  "phone": "187xxxx6466",
  "code": "797246"
}
```

成功后同样从返回体中提取 token。

### 5. pit 接口

- 地址：`https://jiegehao.cn/api/lease/pit`
- 方法：`GET`
- 请求头：

```text
Authorization: Bearer <token>
```

接口返回 3 个栏位数据，前端按顺序渲染为三张紧凑卡片。

### 6. 栏位验证码接口

- 地址：
  `https://jiegehao.cn/api/lease/gpt/code?user_name=<pit.account>&bus_seat_id=<pit.seat_id>`
- 方法：`GET`
- 请求头：

```text
Authorization: Bearer <token>
```

其中：

- `user_name` 来自 pit 栏位中的 `account`
- `bus_seat_id` 来自 pit 栏位中的 `seat_id`

## 目录结构

```text
AutoSign/
├── src/                 # 前端界面
├── src-tauri/           # Rust / Tauri 后端
├── package.json
└── README.md
```

关键文件：

- `src/main.js`：前端界面与交互逻辑
- `src/style.css`：少量全局样式
- `src-tauri/src/lib.rs`：接口调用、本地存储、导出逻辑
- `.github/workflows/windows-build.yml`：GitHub Actions Windows 自动打包

## 本地开发

先安装依赖：

```bash
cd /Users/xieyuqiyu/Documents/谢雨奇项目/AutoSign
npm install
```

启动桌面开发模式：

```bash
npm run tauri:dev
```

只跑前端预览：

```bash
npm run dev
```

## 本地数据

账号数据会保存在系统应用数据目录下的 `accounts.json` 中，字段包含：

- `account`
- `password`
- `login_type`
- `last_login`
- `token`

其中：

- 密码登录记录的 `login_type` 为 `password`
- 手机号登录记录的 `login_type` 为 `phone`
- 手机号记录默认不保存短信验证码，只保存手机号和 token

## 打包

打包桌面安装包：

```bash
npm run tauri:build
```

默认配置已按这两个目标准备：

- macOS: `dmg`
- Windows: `nsis` 安装包

## GitHub 仓库与自动构建

仓库：

- [autosign-lite](https://github.com/xieyuqiyu-source/autosign-lite)

## GitHub Actions 自动构建 exe

仓库已包含工作流：

`/.github/workflows/windows-build.yml`

作用：

- 在 `windows-latest` 上自动构建 Windows 安装包
- 支持手动触发 `workflow_dispatch`
- 或者推送 tag，例如 `app-v0.1.0`
- 构建结果会作为 GitHub Release 附件上传
- 当前已经验证可以产出：
- `AutoSign.Lite_0.1.0_x64-setup.exe`

## 可继续扩展

- 删除账号
- 编辑账号备注
- pit 栏位状态颜色区分
- 自动登录上次账号
- 打包签名与发布流程
