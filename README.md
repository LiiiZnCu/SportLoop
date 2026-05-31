# SportLoop GitHub Pages

这是 SportLoop 的静态发布版本，可以直接部署到 GitHub Pages。

## 发布内容

- `index.html`：完整应用页面，CSS 和 JS 已内联。
- `404.html`：GitHub Pages 兜底页，内容与首页一致。
- `manifest.webmanifest`：手机和平板添加到主屏幕时使用。
- `.nojekyll`：避免 GitHub Pages 对静态资源做 Jekyll 处理。
- `assets/`：页面实际用到的图片资源。

## GitHub Pages 设置

1. 把本目录内容推送到 GitHub 仓库。
2. 在 GitHub 仓库里打开 `Settings -> Pages`。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/root`。

发布后访问地址通常是：

```text
https://<你的 GitHub 用户名>.github.io/<仓库名>/
```

## 本地检查

```bash
cd /Users/liiizncu/Documents/ui/sportloop-pages
python3 -m http.server 5175
```

然后打开：

```text
http://127.0.0.1:5175/
```
