const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type DamageLevel = "normal" | "minor" | "obvious" | "severe";
type SideName = "front" | "back";

type SideResult = {
  side: SideName;
  side_label: "正面" | "反面";
  status: "正常" | "异常";
  damage_level: DamageLevel;
  target_matched: boolean;
  comparable: boolean;
  has_damage: boolean;
  summary: string;
  issues: string[];
};

type DamageResult = {
  status: "正常" | "异常";
  damage_level: DamageLevel;
  risk_label: "低" | "中" | "高";
  confidence: number;
  issue_count: number;
  summary: string;
  issues: string[];
  side_results: SideResult[];
  needs_admin_review: boolean;
  target_matched: boolean;
  comparable: boolean;
};

type ImagePair = {
  front: string;
  back: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`缺少环境变量：${name}`);
  return value;
}

function cleanModelText(text: string) {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseModelJson(text: string) {
  const cleaned = cleanModelText(text);
  const direct = tryParseJson(cleaned);
  if (direct) return direct;
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("MiniMax 未返回 JSON 结果");
  const extracted = tryParseJson(match[0]);
  if (!extracted) throw new Error("MiniMax 返回 JSON 格式错误");
  return extracted;
}

function isImageDataUrl(value: unknown) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function imageFromPair(value: unknown, side: SideName) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  const direct = record[side];
  return isImageDataUrl(direct) ? String(direct).trim() : "";
}

function readImagePair(body: Record<string, unknown>, key: "before" | "after"): ImagePair {
  const camelPair = body[`${key}Images`];
  const snakePair = body[`${key}_images`];
  const legacy = key === "before" ? body.beforeImageDataUrl : body.afterImageDataUrl;
  return {
    front: imageFromPair(camelPair, "front") || imageFromPair(snakePair, "front") || (isImageDataUrl(legacy) ? String(legacy).trim() : ""),
    back: imageFromPair(camelPair, "back") || imageFromPair(snakePair, "back"),
  };
}

function assertImagePair(pair: ImagePair, label: "借出前" | "归还") {
  if (!isImageDataUrl(pair.front)) throw new Error(`请上传${label}正面照片`);
  if (!isImageDataUrl(pair.back)) throw new Error(`请上传${label}反面照片`);
}

function normalizeLevel(value: unknown): DamageLevel {
  const raw = String(value || "").toLowerCase();
  if (["normal", "正常", "none", "no"].includes(raw)) return "normal";
  if (["minor", "轻微", "轻微损耗"].includes(raw)) return "minor";
  if (["obvious", "明显", "明显损耗", "damaged"].includes(raw)) return "obvious";
  if (["severe", "严重", "严重损坏"].includes(raw)) return "severe";
  return "obvious";
}

function maxDamageLevel(levels: DamageLevel[]): DamageLevel {
  const weight: Record<DamageLevel, number> = { normal: 0, minor: 1, obvious: 2, severe: 3 };
  return levels.reduce((max, level) => weight[level] > weight[max] ? level : max, "normal" as DamageLevel);
}

function clampConfidence(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.75;
  if (num > 1) return Math.min(1, Math.max(0, num / 100));
  return Math.min(1, Math.max(0, num));
}

function issuesFrom(value: unknown, limit = 5) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit) : [];
}

function mentionsDifferentVisibleSide(text: string) {
  return /正反面|正反两面|正面和反面|正面与反面|反面和正面|反面与正面|不同可见面|不同拍面|黑色胶面和红色胶面|红色胶面和黑色胶面/.test(text);
}

function sideLabel(side: SideName): "正面" | "反面" {
  return side === "front" ? "正面" : "反面";
}

function normalizeSideResult(raw: unknown, side: SideName): SideResult {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const issues = issuesFrom(data.issues, 4);
  const damageLevel = normalizeLevel(data.damage_level || data.damageLevel);
  const targetMatched = data.target_matched === true || data.targetMatched === true;
  const comparable = data.comparable === true;
  const hasDamage = data.has_damage === true || data.hasDamage === true || damageLevel !== "normal" || issues.length > 0;
  const status = targetMatched && comparable && !hasDamage && damageLevel === "normal" && data.status !== "异常" ? "正常" : "异常";
  const label = sideLabel(side);
  const fallback = targetMatched
    ? (comparable ? `${label}未发现明显新增损耗。` : `${label}照片无法和借出前同面有效对比。`)
    : `${label}照片未清楚显示目标器材。`;

  return {
    side,
    side_label: label,
    status,
    damage_level: damageLevel,
    target_matched: targetMatched,
    comparable,
    has_damage: hasDamage,
    summary: String(data.summary || fallback).trim(),
    issues,
  };
}

function pickRawSide(raw: Record<string, unknown>, side: SideName) {
  const rows = raw.side_results || raw.sideResults;
  if (Array.isArray(rows)) {
    return rows.find((row) => {
      if (!row || typeof row !== "object") return false;
      const data = row as Record<string, unknown>;
      return data.side === side || data.side_label === sideLabel(side);
    });
  }
  if (rows && typeof rows === "object") {
    const data = rows as Record<string, unknown>;
    return data[side] || data[sideLabel(side)];
  }
  return null;
}

function normalizeResult(raw: Record<string, unknown>): DamageResult {
  const sideResults = [
    normalizeSideResult(pickRawSide(raw, "front"), "front"),
    normalizeSideResult(pickRawSide(raw, "back"), "back"),
  ];
  const confidence = clampConfidence(raw.confidence);
  const rawIssues = issuesFrom(raw.issues);
  const sideIssues = sideResults.flatMap((side) => side.issues.map((issue) => `${side.side_label}：${issue}`));
  const allIssueText = [raw.summary, ...rawIssues, ...sideIssues, ...sideResults.map((side) => side.summary)].map((item) => String(item || "")).join(" ");
  const sideMismatch = mentionsDifferentVisibleSide(allIssueText);
  const targetMatched = raw.target_matched === true && sideResults.every((side) => side.target_matched);
  const comparable = raw.comparable === true && sideResults.every((side) => side.comparable) && !sideMismatch;
  const sideDamageLevel = maxDamageLevel(sideResults.map((side) => side.damage_level));
  const rawDamageLevel = normalizeLevel(raw.damage_level);
  const damageLevel = maxDamageLevel([rawDamageLevel, sideDamageLevel]);
  const forcedInvalid = confidence < 0.7 || !targetMatched || !comparable;
  const abnormal = forcedInvalid || damageLevel !== "normal" || sideResults.some((side) => side.status === "异常");
  const invalidReason = !targetMatched
    ? "正反两面照片中有一面未清楚显示目标器材，无法完成归还质检。"
    : sideMismatch
      ? "正反两面照片未按同一面对应对比，请重新上传正面和反面照片。"
      : !comparable
        ? "正反两面照片中有一面无法有效对比目标器材，请重新上传清晰照片。"
        : "检测可信度过低，请重新上传清晰照片。";
  const issues = [...rawIssues, ...sideIssues].filter(Boolean).slice(0, 8);
  const normalizedIssues = abnormal && !issues.length ? [invalidReason] : issues;

  return {
    status: abnormal ? "异常" : "正常",
    damage_level: abnormal && damageLevel === "normal" ? "obvious" : damageLevel,
    risk_label: damageLevel === "severe" || damageLevel === "obvious" ? "高" : (damageLevel === "minor" || abnormal ? "中" : "低"),
    confidence,
    issue_count: abnormal ? Math.max(1, normalizedIssues.length) : 0,
    summary: String(forcedInvalid ? invalidReason : (raw.summary || (abnormal ? "检测到疑似新增损耗，建议管理员复核。" : "正反两面均未发现明显新增损耗。"))).trim(),
    issues: normalizedIssues,
    side_results: sideResults,
    needs_admin_review: abnormal || Boolean(raw.needs_admin_review),
    target_matched: targetMatched,
    comparable,
  };
}

function minimaxErrorMessage(status: number, text: string) {
  const lower = text.toLowerCase();
  if (
    status === 402 ||
    lower.includes("insufficient_balance") ||
    lower.includes("insufficient balance") ||
    lower.includes("quota has been exceeded") ||
    lower.includes("quota exceeded")
  ) {
    return "MiniMax 余额不足或密钥配置异常，请检查 Supabase 里的 API Key、接口区域和可用额度。";
  }
  if (status === 401 || status === 403 || lower.includes("invalid api key") || lower.includes("unauthorized")) {
    return "MiniMax API Key 无效，请检查 Supabase 里的密钥配置。";
  }
  return `MiniMax 检测服务请求失败（${status}），请稍后重试。`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "只支持 POST 请求" }, 405);

  try {
    const apiKey = requiredEnv("MINIMAX_API_KEY");
    const baseUrl = Deno.env.get("MINIMAX_BASE_URL") || "https://api.minimaxi.com";
    const model = Deno.env.get("MINIMAX_MODEL") || "MiniMax-M3";
    const body = await req.json();

    const equipmentName = String(body.equipmentName || "").trim();
    const assetId = String(body.assetId || "").trim();
    const beforeImages = readImagePair(body, "before");
    const afterImages = readImagePair(body, "after");

    if (!equipmentName || !assetId) throw new Error("缺少器材信息");
    assertImagePair(beforeImages, "借出前");
    assertImagePair(afterImages, "归还");

    const prompt = [
      "你是校园体育器材归还质检助手。",
      "本次必须检查正反两面，四张图片顺序固定：1 借出前正面，2 借出前反面，3 归还正面，4 归还反面。",
      `器材：${equipmentName}，编号：${assetId}。`,
      "只允许比较 1 vs 3、2 vs 4；不要把正面和反面交叉比较。",
      "先分别确认四张图片是否都清楚显示同一类目标器材；任一张不清楚、遮挡严重、不是目标器材，整体必须判异常。",
      "分别扫描正面组和反面组的单面可见破损：边缘缺口、胶皮缺失、露出橙色或木色底层、开裂、翘边、断裂、明显变形、明显污损都必须写入对应 side_results 的 issues。",
      "如果某一面借出前和归还后不是同一可见面、同一关键区域，或者角度导致无法比较，该面 comparable=false，整体异常。",
      "只有正面组和反面组都能确认目标器材、同面同区域可比，且两面都没有新增破损，整体才可判正常。",
      "不要因为轻微光线、阴影差异直接判异常；但不能放宽正反面对应和同一区域对比要求。",
      "必须只返回 JSON，不要 Markdown，不要解释。",
      "JSON 字段固定为：",
      "{",
      '  "damage_level": "normal | minor | obvious | severe",',
      '  "confidence": 0.0 到 1.0,',
      '  "target_matched": true 或 false,',
      '  "comparable": true 或 false,',
      '  "issue_count": 数字,',
      '  "summary": "一句中文结论",',
      '  "issues": ["整体问题点1", "整体问题点2"],',
      '  "side_results": [',
      '    {"side":"front","side_label":"正面","status":"正常 | 异常","damage_level":"normal | minor | obvious | severe","target_matched":true,"comparable":true,"has_damage":false,"summary":"正面结论","issues":[]},',
      '    {"side":"back","side_label":"反面","status":"正常 | 异常","damage_level":"normal | minor | obvious | severe","target_matched":true,"comparable":true,"has_damage":false,"summary":"反面结论","issues":[]}',
      "  ],",
      '  "needs_admin_review": true 或 false',
      "}",
    ].join("\n");

    const minimaxResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        thinking: { type: "adaptive" },
        temperature: 0.1,
        max_completion_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: beforeImages.front } },
              { type: "image_url", image_url: { url: beforeImages.back } },
              { type: "image_url", image_url: { url: afterImages.front } },
              { type: "image_url", image_url: { url: afterImages.back } },
            ],
          },
        ],
      }),
    });

    const minimaxText = await minimaxResponse.text();
    if (!minimaxResponse.ok) {
      throw new Error(minimaxErrorMessage(minimaxResponse.status, minimaxText));
    }

    const minimaxJson = JSON.parse(minimaxText);
    const content = minimaxJson?.choices?.[0]?.message?.content;
    if (!content) throw new Error("MiniMax 未返回检测内容");

    const parsed = parseModelJson(String(content));
    const result = normalizeResult(parsed);

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "检测失败" }, 400);
  }
});
