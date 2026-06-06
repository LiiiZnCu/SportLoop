# MiniMax Damage Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first usable MiniMax-M3 powered return-photo damage check without exposing the MiniMax key in the browser.

**Architecture:** The GitHub Pages frontend reads the selected return photo as a data URL and calls a Supabase Edge Function. The Edge Function reads MiniMax secrets from environment variables, calls China-region MiniMax-M3, normalizes the answer to JSON, and the frontend stores the result on the loan.

**Tech Stack:** Single-file HTML/CSS/JS, Supabase Edge Functions, MiniMax-M3 Chat Completions.

---

### Task 1: Edge Function

**Files:**
- Create: `/Users/liiizncu/Documents/GitHub/SportLoop/supabase/functions/analyze-equipment-damage/index.ts`

- [ ] Create a Supabase Edge Function that accepts `equipmentName`, `assetId`, and `afterImageDataUrl`, calls `https://api.minimaxi.com/v1/chat/completions`, and returns normalized JSON.

### Task 2: Frontend Wiring

**Files:**
- Modify: `/Users/liiizncu/Documents/GitHub/SportLoop/index.html`
- Copy to: `/Users/liiizncu/Documents/GitHub/SportLoop/404.html`

- [ ] Add a Supabase function request helper.
- [ ] Change the detection page buttons to use uploaded photo AI detection.
- [ ] Store the MiniMax result in `loan.detectResult` and show the result page.

### Task 3: Docs And Verification

**Files:**
- Modify: `/Users/liiizncu/Documents/GitHub/SportLoop/README.md`
- Modify: `/Users/liiizncu/Documents/ui/CONTEXT.md`
- Modify: `/Users/liiizncu/Documents/ui/lessons.md`

- [ ] Document required secrets and deploy command.
- [ ] Run JS syntax check and confirm `index.html` equals `404.html`.
