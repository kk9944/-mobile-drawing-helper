# 手机辅助画图

一个给手机使用的本地网页工具：用摄像头看布面，把照片或 PNG 半透明叠在画面上，再通过四个角点做透视校准。

## 功能

- iPhone Safari 友好的相机画面，优先使用后置摄像头
- 导入照片或 PNG
- 四角拖动校准，图案可整体拖动
- 透明度、缩放、旋转
- 左右/上下翻转
- 网格辅助
- 锁定/重新校准

## 本地运行

在这个目录里启动静态服务：

```powershell
node server.mjs
```

电脑浏览器访问：

```text
http://localhost:5173
```

iPhone Safari 访问相机时需要安全上下文。`localhost` 只对运行服务的设备有效，如果要让 iPhone 访问电脑上的网页，建议放到 HTTPS 环境，比如 GitHub Pages、Cloudflare Pages，或使用可信任证书的局域网 HTTPS 服务。
