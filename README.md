# SportLoop GitHub Pages

这是 SportLoop 的静态发布版本，可以直接部署到 GitHub Pages。当前版本已接入 Supabase，用来保存学生认证、器材档案、借用续借、批量借出申请、联系管理员和报修工单。

## 发布内容

- `index.html`：完整应用页面，CSS 和 JS 已内联。
- `404.html`：GitHub Pages 兜底页，内容与首页一致。
- `manifest.webmanifest`：手机和平板添加到主屏幕时使用。
- `.nojekyll`：避免 GitHub Pages 对静态资源做 Jekyll 处理。
- `assets/`：页面实际用到的图片资源。
- `supabase_sportloop.sql`：Supabase 建表和权限脚本。

## Supabase

前端只使用公开 key，不要把 `service_role` 或 secret key 放进网页。

当前项目地址：

```text
https://jwylvubakymfkdncuwhp.supabase.co
```

建库方法：

1. 打开 Supabase 项目后台。
2. 进入 `SQL Editor`。
3. 复制 `supabase_sportloop.sql` 全部内容并运行。
4. 如果管理员端提示“管理员未授权”，复制页面显示的 UID，插入 `admin_users` 表。
5. 管理员授权后，在管理员端录入器材；脚本不会再自动生成演示器材。

这次新增了 `batch_borrow_requests` 表和 `loans.batch_request_id` 字段。线上数据库要重新运行一遍 `supabase_sportloop.sql`，批量申请才能同步。

登录和注册是分开的：未注册账号不能直接登录，必须先在网页注册页创建账号。账号不能重复；校园认证里只有学号不能重复，姓名和院系可以相同。批量借出申请由学生提交，管理员审批通过后，学生才能在机器批量借出和归还。

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
cd /Users/liiizncu/Documents/GitHub/SportLoop
python3 -m http.server 5178 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:5178/
```

## 常用检查

```bash
node -e "const fs=require('fs'); for (const f of ['index.html','404.html']) { const h=fs.readFileSync(f,'utf8'); new Function(h.match(/<script>([\\s\\S]*)<\\/script>/)[1]); }"
cmp -s index.html 404.html && echo ok
```
