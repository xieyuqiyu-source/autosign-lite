# AutoSign

一个基于 `Tauri 2 + Vite` 的桌面小工具，用来做账号登录、验证码流程和 pit 栏位信息查看。

这个项目的定位很直接：给自己留一个可打包、可常用、比脚本更顺手的桌面操作面板。

## 现在能做什么

- 密码登录
- 手机号 + 验证码登录
- 本地保存多个账号
- 导出账号 CSV
- 登录后保存 token
- 获取 pit 三栏位信息
- 获取栏位验证码并复制

## 平时怎么启动

安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run tauri:dev
```

只看前端：

```bash
npm run dev
```

打包：

```bash
npm run tauri:build
```

## 我以后主要看哪里

- `src/main.js`：前端交互
- `src/style.css`：界面样式
- `src-tauri/src/lib.rs`：接口请求、本地存储、导出逻辑
- `.github/workflows/windows-build.yml`：Windows 自动打包

## 备注

- 这是桌面工具，不是 Web SaaS
- 本地账号数据会保存在应用数据目录
- 如果以后忘了怎么跑，优先执行 `npm run tauri:dev`
