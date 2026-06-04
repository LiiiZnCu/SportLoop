# SportLoop 架构说明

## 文件职责

- `index.html`：主应用，包含页面结构、样式、交互逻辑和 Supabase 连接代码。
- `404.html`：GitHub Pages 兜底页，内容必须和 `index.html` 保持一致。
- `assets/`：页面加载的图片资源。
- `manifest.webmanifest`：手机和平板添加到主屏幕时使用。
- `supabase_sportloop.sql`：Supabase 数据表、索引和权限脚本。

## 数据流

- 学生登录后，前端通过 Supabase Auth 获取登录身份。
- 登录和注册分开处理：登录只调用密码登录，注册页才调用 Supabase 注册。
- 器材、认证、借用、续借、批量申请、留言和工单通过 Supabase REST 接口读写。
- 器材档案由管理员端录入和维护；管理员可以粘贴 NFC 机器导出的库存清单同步库存，也可以手动修改数量和状态。
- `equipment.nfc_tags` 保存机器同步来的芯片清单，`equipment.machine_synced_at` 保存最近一次机器同步时间。
- 数据库没有器材时学生端显示空状态。
- `student_profiles` 保存姓名、学号、院系和认证状态，只有学号不可重复；姓名和院系允许重复。
- `loans` 保存借用、续借和归还结果。
- `batch_borrow_requests` 保存学生批量借出申请；管理员审批通过后，学生才能机器批量借出和归还。
- `admin_contacts` 保存学生联系管理员的消息和管理员回复。
- `work_orders` 保存报修/报损工单。
- `admin_users` 决定某个登录账号是否能进入管理员端。

## 关键决定

- GitHub Pages 只能放公开前端，所以网页里只放 Supabase publishable key。
- 数据权限交给 Supabase RLS 控制，学生只能看自己的记录，管理员可以看全量。
- 未认证用户不再默认占用假学号，提交校园认证后才写入数据库。
- 批量申请不直接扣库存；只有学生在审批通过后同步机器批量借出时，才生成借用记录并减少库存。
- 管理员端不做 NFC 识别；NFC 芯片由外部机器处理，网页只接收机器同步后的库存数据。
