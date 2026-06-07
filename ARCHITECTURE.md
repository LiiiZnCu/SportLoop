# SportLoop 架构说明

## 文件职责

- `index.html`：主应用，包含页面结构、样式、交互逻辑和 Supabase 连接代码。
- `404.html`：GitHub Pages 兜底页，内容必须和 `index.html` 保持一致。
- `assets/`：页面加载的图片资源。
- `manifest.webmanifest`：手机和平板添加到主屏幕时使用。
- `supabase_sportloop.sql`：Supabase 数据表、索引和权限脚本。
- `supabase/functions/analyze-equipment-damage/index.ts`：Supabase Edge Function，读取 MiniMax secret 并调用 MiniMax-M3 做归还照片损耗检测。

## 数据流

- 学生登录后，前端通过 Supabase Auth 获取登录身份。
- 登录和注册分开处理：登录只调用密码登录，注册页才调用 Supabase 注册。
- 器材、认证、借用、续借、批量申请、留言、工单、机器同步记录和管理员操作记录通过 Supabase REST 接口读写。
- 器材档案由管理员端录入和维护；NFC 机器端负责“入库模式”和扫码，管理员端只接收同步结果，也可以手动修改数量和状态。
- 管理员端首页只保留工作台总览和按弧线排布的扇形入口卡；批量申请、学生留言、报修工单、器材档案、同步记录、操作记录和数据导出分别进入独立页面。
- `equipment.nfc_tags` 保存机器同步来的芯片清单，`equipment.machine_synced_at` 保存最近一次机器同步时间。
- `machine_sync_logs` 保存每次机器入库同步结果，包括新增芯片数、重复芯片数、失败数和摘要。
- `admin_operation_logs` 保存管理员录入、审批、回复、维修、导出等关键操作。
- 数据库没有器材时学生端显示空状态。
- `student_profiles` 保存姓名、学号、院系和认证状态，只有学号不可重复；姓名和院系允许重复。
- `loans` 保存借用、续借、借出前照片、归还照片、归还检测结果和机器归还允许标记。
- 机器端先完成借出扫码，学生端同步后生成 `待补借出照片` 记录；学生上传借出前照片后，借用才改为 `使用中` 并扣减库存。
- 归还检测页把 `loans.before_photo_data_url` 和学生新上传的归还照片传给 `analyze-equipment-damage`，函数调用中国区 MiniMax-M3 后返回检测结论，前端把结论写回 `loans.detect_result`。
- 检测放行条件是硬规则：两张图都必须清楚显示目标器材、可对比、可信度不低于阈值，并且没有新增损耗。任一条件不满足都算异常，只允许重新上传或反馈管理员。
- 只有检测通过时，前端才把 `loans.return_machine_allowed` 改为 `true`，机器端才能扫码归还；检测异常会生成管理员待复核工单。
- `batch_borrow_requests` 保存学生批量借出申请；管理员审批通过后，学生才能机器批量借出和归还。
- `admin_contacts` 保存学生联系管理员的消息和管理员回复。
- `work_orders` 保存报修/报损工单。
- `admin_users` 决定某个登录账号是否能进入管理员端。

## 关键决定

- GitHub Pages 只能放公开前端，所以网页里只放 Supabase publishable key。
- MiniMax API Key 只放 Supabase Edge Function Secrets，不进入 GitHub Pages 前端代码。
- 数据权限交给 Supabase RLS 控制，学生只能看自己的记录，管理员可以看全量。
- 未认证用户不再默认占用假学号，提交校园认证后才写入数据库。
- 批量申请不直接扣库存；审批通过后，学生同步机器批量扫码会生成待补照片记录，逐件上传借出前照片后才扣库存并进入正式借用。
- 管理员端不做 NFC 识别；NFC 芯片由外部机器处理，网页只接收机器同步后的入库数据。
- 同一个 NFC 芯片不能重复入库；如果机器同步里出现已存在芯片，只记录重复，不再增加库存。
- 管理员端不再把全部管理模块堆在一个长页面，入口卡负责导航，减少滑过目标区域的问题。
