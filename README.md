# AutoSign Lite

一个轻量的桌面小工具，目标是替代之前的 Python 版，后续可以直接打包成 macOS `dmg` 和 Windows `exe`。

## 当前功能

- 单窗口轻量界面
- 本地保存多个账号密码
- 账号列表支持“载入并登录”
- 登录成功后自动保存 `Bearer token`
- 调用 `pit` 接口并展示 3 个椭圆栏位
- 每个账号和密码旁边都带复制按钮
- 预留“获取验证码”按钮，等待验证码接口接入

## 技术方案

- 前端：Vite + 原生 JavaScript
- 桌面壳：Tauri 2
- 本地存储：Rust 侧 JSON 文件
- 接口请求：Rust `reqwest`

这个方案比 Electron 更省资源，适合做常驻小工具，也更适合后续打包 `dmg` / `exe`。

## 接口约定

### 登录接口

- 地址：`https://jiegehao.cn/api/policy/password`
- 方法：`POST`
- 请求体：

```json
{
  "account": "xxx",
  "password": "xxx"
}
```

### pit 接口

- 地址：`https://jiegehao.cn/api/lease/pit`
- 方法：`GET`
- 请求头：

```text
Authorization: Bearer <token>
```

## 目录结构

```text
AutoSign/
├── src/                 # 前端界面
├── src-tauri/           # Rust / Tauri 后端
├── package.json
└── README.md
```

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

## 打包

打包桌面安装包：

```bash
npm run tauri:build
```

默认配置已按这两个目标准备：

- macOS: `dmg`
- Windows: `nsis` 安装包

## GitHub Actions 自动构建 exe

仓库已包含工作流：

`/.github/workflows/windows-build.yml`

作用：

- 在 `windows-latest` 上自动构建 Windows 安装包
- 支持手动触发 `workflow_dispatch`
- 或者推送 tag，例如 `app-v0.1.0`
- 构建结果会作为 GitHub Release 附件上传

如果你后面要我继续补，我可以直接做：

- 验证码接口接入
- pit 栏位状态颜色区分
- 删除账号
- 自动登录上次账号
- 打包签名与发布流程
