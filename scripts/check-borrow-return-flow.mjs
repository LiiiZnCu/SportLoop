import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fallbackHtml = fs.readFileSync(new URL("../404.html", import.meta.url), "utf8");
const sql = fs.readFileSync(new URL("../supabase_sportloop.sql", import.meta.url), "utf8");
const damageFunction = fs.readFileSync(new URL("../supabase/functions/analyze-equipment-damage/index.ts", import.meta.url), "utf8");

const checks = [
  ["借出同步后必须进入待补照片状态", html.includes('status: "待补借出照片"')],
  ["旧借用缺照片也必须拦回待补照片", html.includes("function loanNeedsBeforePhoto") && html.includes("loanNeedsBeforePhoto(loan)")],
  ["档案当前借用要显示待补照片记录", html.includes("const archiveActive = activeBorrowLoans();") && html.includes("const currentCount = archiveActive.length;")],
  ["未补借出前照片不能算正式信用记录", html.includes("function confirmedBorrowLoans") && html.includes("const active = confirmedBorrowLoans();")],
  ["旧记录补照片不重复扣库存", html.includes("const shouldReserveInventory = loan.status === \"待补借出照片\"") && html.includes("shouldReserveInventory ? updateRemoteEquipment(item) : Promise.resolve()")],
  ["照片上传前必须压缩", html.includes("function compressImageFile") && html.includes("PHOTO_MAX_SIDE") && html.includes("canvas.toDataURL(\"image/jpeg\"")],
  ["当前借用列表包含待补借出照片状态", html.includes('"待补借出照片", "使用中", "待归还", "异常待归还"')],
  ["本地缓存不能保存照片大字段", html.includes("function localStoreSnapshot") && html.includes("stripLoanPhotosForLocalCache") && html.includes('cached.beforePhotoDataUrl = ""') && html.includes('cached.returnPhotoDataUrl = ""')],
  ["借出确认页有借出前照片上传入口", html.includes('id="borrowBeforePhotoInput"')],
  ["借出前照片上传后才完成借用", html.includes("finishBorrowWithBeforePhoto")],
  ["归还检测页不再要求重新上传借出前照片", !html.includes('id="beforePhotoInput"')],
  ["归还检测调用已保存的借出前照片", html.includes("beforeImageDataUrl: loan.beforePhotoDataUrl")],
  ["检测放行必须经过统一硬规则", html.includes("function detectionCanPass") && html.includes("result.confidence >= DETECTION_PASS_CONFIDENCE") && html.includes("result.targetMatched === true")],
  ["低可信度或非目标器材必须转异常", damageFunction.includes("const forcedInvalid = confidence < 0.7 || targetMatched !== true || comparable !== true")],
  ["乒乓球拍正反面不能当作可对比照片", damageFunction.includes("正反面") && damageFunction.includes("不同可见面") && damageFunction.includes("comparable")],
  ["不可比时仍要输出单张可见破损", damageFunction.includes("单张可见破损") && damageFunction.includes("边缘缺口") && damageFunction.includes("不能因为不可比而省略")],
  ["无法识别目标器材必须提示重传或反馈管理员", html.includes("重新上传照片") && html.includes("反馈给管理员")],
  ["异常检测结果必须能直接返回首页", html.includes('反馈给管理员</button>\n                </div>\n                <button class="secondary-button" data-route="home"')],
  ["检测正常后才允许机器归还", html.includes("returnMachineAllowed") && html.includes("const passed = detectionCanPass(normalizedResult)") && html.includes("loan.returnMachineAllowed = passed")],
  ["机器归还前检查后端允许标记", html.includes("请先完成归还检测，检测正常后机器才允许扫码归还")],
  ["MiniMax 额度问题要显示短提示", html.includes("function friendlyFunctionError") && html.includes("quota has been exceeded") && html.includes("MiniMax 余额不足") && damageFunction.includes("quota has been exceeded") && damageFunction.includes("MiniMax 余额不足")],
  ["MiniMax 图片请求使用官方 image_url 格式", damageFunction.includes("{ url: beforeImageDataUrl }") && damageFunction.includes("{ url: afterImageDataUrl }") && !damageFunction.includes("max_long_side_pixel") && !damageFunction.includes("detail: \"default\"")],
  ["前端必须指向已部署检测函数的 Supabase 项目", html.includes("https://jwylvubakymfkdncuwhp.supabase.co") && html.includes("sb_publishable_LQqefYrKcOKLIqqFqNTjgQ_qFjyZOB8")],
  ["五个轻动效必须保留", html.includes(".tab-button.active svg") && html.includes("fanTextRise") && html.includes("aiDetectProgress") && html.includes("listItemIn") && html.includes(".admin-dashboard-scroll .admin-task-card::after")],
  ["底部导航激活态不能整体上浮", !html.includes("translateY(-3px) scale(1.06)") && html.includes("transform: scale(1.04);")],
  ["底部导航必须用滑动选中底板", html.includes(".tabbar::before") && html.includes("--tab-index") && html.includes("--tab-indicator-opacity")],
  ["页面切换只在路由变化时动", html.includes("function applyRouteMotion") && html.includes("state.renderedRoute") && html.includes("is-route-entering")],
  ["AI 检测必须有扫描线和步骤完成态", html.includes("is-ai-scanning") && html.includes("is-done") && html.includes("issueReveal")],
  ["管理员扇形入口必须有吸附反馈", html.includes("markAdminFanSettling") && html.includes("is-settling") && html.includes("fanDockPulse")],
  ["输入框聚焦必须有轻反馈", html.includes(".field:focus-within > span") && html.includes("box-shadow: 0 0 0 4px rgba(159, 18, 57, 0.08)")],
  ["照片选择必须有完成反馈", html.includes("function markPhotoSelected") && html.includes(".photo-name.is-selected") && html.includes("upload-real.is-selected")],
  ["提交成功必须有按钮完成态", html.includes("function finishWithButtonFeedback") && html.includes("is-action-done") && html.includes("actionDonePulse")],
  ["空状态必须有轻淡入", html.includes("emptyStateIn") && html.includes(".empty") && html.includes("translateY(4px)")],
  ["管理员待办数字变化必须有轻反馈", html.includes("adminTaskCountClass") && html.includes("admin-task-number") && html.includes("adminCountPulse")],
  ["我的档案三列指标必须居中", html.includes("justify-items: center;") && html.includes("justify-content: center;") && html.includes("text-align: center;")],
  ["数据库保存借出前照片", sql.includes("before_photo_data_url text not null default ''")],
  ["数据库保存归还后照片", sql.includes("return_photo_data_url text not null default ''")],
  ["数据库保存机器归还允许标记", sql.includes("return_machine_allowed boolean not null default false")],
  ["404 与首页保持一致", html === fallbackHtml],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`借还流程检查失败：${failed.length}/${checks.length}`);
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`借还流程检查通过：${checks.length}/${checks.length}`);
