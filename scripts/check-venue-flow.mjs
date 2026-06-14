import assert from "node:assert/strict";
import fs from "node:fs";

const htmlFiles = ["index.html", "404.html"];
const sql = fs.readFileSync("supabase_sportloop.sql", "utf8");

function assertIncludes(source, text, label) {
  assert.ok(source.includes(text), label);
}

assertIncludes(sql, "create table if not exists public.venues", "SQL 缺少 venues 表");
assertIncludes(sql, "grant select, insert, update, delete on public.venues to authenticated;", "SQL 缺少 venues authenticated 授权");
assertIncludes(sql, "alter table public.venues enable row level security;", "SQL 缺少 venues RLS");
assertIncludes(sql, "create policy venues_authenticated_select on public.venues", "SQL 缺少 venues 读取策略");
assertIncludes(sql, "create policy venues_admin_insert on public.venues", "SQL 缺少 venues 新增策略");
assertIncludes(sql, "create policy venues_admin_update on public.venues", "SQL 缺少 venues 更新策略");
assertIncludes(sql, "create policy venues_admin_delete on public.venues", "SQL 缺少 venues 删除策略");
assert.ok(!sql.includes('create policy "venues_full_access"'), "SQL 仍有 venues 全公开策略");

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  assertIncludes(html, 'supabaseRequest("venues?select=*&order=name.asc")', `${file} 没有从 Supabase 读取 venues`);
  assertIncludes(html, "store.venues = venueRows.map(dbVenueToLocal);", `${file} 没有把远程 venues 写入页面状态`);
  assertIncludes(html, "await saveRemoteVenue(venue);", `${file} 保存场馆没有等待 Supabase 成功`);
  assertIncludes(html, "await deleteRemoteVenue(venueId);", `${file} 删除场馆没有等待 Supabase 成功`);
  assert.ok(!html.includes("venues?select=*&user_id=eq."), `${file} 仍按个人 user_id 读取场馆`);
}

console.log("venue flow checks passed");
