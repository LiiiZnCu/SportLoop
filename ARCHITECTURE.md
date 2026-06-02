# SportLoop 架构说明

## 文件职责

- `index.html`：主应用，包含页面结构、样式、交互逻辑和 Supabase 连接代码。
- `404.html`：GitHub Pages 兜底页，内容必须和 `index.html` 保持一致。
- `assets/`：页面加载的图片资源。
- `manifest.webmanifest`：手机和平板添加到主屏幕时使用。
- `supabase_sportloop.sql`：Supabase 数据表、索引、权限和初始器材数据。

## 数据流

- 学生登录后，前端通过 Supabase Auth 获取登录身份。
- 登录和注册分开处理：登录只调用密码登录，注册页才调用 Supabase 注册。
- 器材、认证、借用、续借、留言和工单通过 Supabase REST 接口读写。
- `student_profiles` 保存姓名、学号、院系和认证状态，只有学号不可重复；姓名和院系允许重复。
- `loans` 保存借用、续借和归还结果。
- `admin_contacts` 保存学生联系管理员的消息和管理员回复。
- `work_orders` 保存报修/报损工单。
- `admin_users` 决定某个登录账号是否能进入管理员端。

## 关键决定

- GitHub Pages 只能放公开前端，所以网页里只放 Supabase publishable key。
- 数据权限交给 Supabase RLS 控制，学生只能看自己的记录，管理员可以看全量。
- 未认证用户不再默认占用假学号，提交校园认证后才写入数据库。
