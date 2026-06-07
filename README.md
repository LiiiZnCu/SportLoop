# SportLoop GitHub Pages

这是 SportLoop 的静态发布版本，可以直接部署到 GitHub Pages。当前版本已接入 Supabase，用来保存学生认证、器材档案、机器入库同步、借用续借、批量借出申请、联系管理员、报修工单和管理员操作记录。

## 发布内容

- `index.html`：完整应用页面，CSS 和 JS 已内联。
- `404.html`：GitHub Pages 兜底页，内容与首页一致。
- `manifest.webmanifest`：手机和平板添加到主屏幕时使用。
- `.nojekyll`：避免 GitHub Pages 对静态资源做 Jekyll 处理。
- `assets/`：页面实际用到的图片资源。
- `supabase_sportloop.sql`：Supabase 建表和权限脚本。
- `supabase/functions/analyze-equipment-damage/`：归还照片损耗检测 Edge Function，负责调用 MiniMax-M3。

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

这次新增了 `batch_borrow_requests`、`machine_sync_logs`、`admin_operation_logs` 表，新增了 `loans.batch_request_id`、`loans.before_photo_data_url`、`loans.return_photo_data_url`、`loans.return_machine_allowed` 字段，以及 `equipment.nfc_tags`、`equipment.machine_synced_at` 字段。线上数据库要重新运行一遍 `supabase_sportloop.sql`，批量申请、机器入库同步记录、归还检测闭环和管理员操作记录才能生效。

登录和注册是分开的：未注册账号不能直接登录，必须先在网页注册页创建账号。账号不能重复；校园认证里只有学号不能重复，姓名和院系可以相同。批量借出申请由学生提交，管理员审批通过后，学生先在机器扫码，再在学生端逐件上传借出前照片，全部补齐后才算借出成功。

单件借还流程：机器端先扫码，学生端同步后上传借出前照片，保存后借用才生效；归还时学生上传归还照片，MiniMax 对比借出前照片，只有检测正常时才把“允许机器扫码归还”的标记写回后端。

机器端是独立系统：机器进入“入库模式”后扫描器材 NFC，网页管理员端只接收机器同步结果。新芯片会增加库存，重复芯片不会重复增加数量，并会写入机器入库同步记录。管理员端还可以搜索筛选器材、手动修改库存状态、导出库存/同步/操作记录。

### MiniMax 归还检测

项目使用中国区 MiniMax-M3 做归还前照片损耗检测。MiniMax key 不能写进 `index.html`，必须放在 Supabase Edge Function Secrets。

需要在 Supabase `Edge Functions -> Secrets` 里添加：

```text
MINIMAX_API_KEY=你的 MiniMax 中国区 API Key
MINIMAX_BASE_URL=https://api.minimaxi.com
MINIMAX_MODEL=MiniMax-M3
```

部署函数：

```bash
cd /Users/liiizncu/Documents/GitHub/SportLoop
supabase functions deploy analyze-equipment-damage --project-ref jwylvubakymfkdncuwhp
```

检测逻辑：学生借出成功前先上传“借出前照片”；归还检测页只上传“归还照片”。网页把已保存的借出前照片和归还照片交给 Supabase Edge Function，函数再调用 MiniMax-M3 返回“正常/异常、可信度、是否为目标器材、是否可对比、风险、问题点和说明”。只有两张图都清楚显示目标器材、可对比、可信度达标且没有新增损耗时，才会写入机器归还允许标记；否则显示异常，学生可重新上传或反馈给管理员。

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
