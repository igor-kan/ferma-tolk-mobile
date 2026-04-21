/**
 * api/speech.js — Background Speech-to-Text & Assistant Response
 * -------------------------------------------------------------
 * FT-006 / FT-009 / FT-010 / FT-014 / FT-027
 *
 * This handler now offloads transcription and assistant response building
 * to a background job, returning a jobId immediately (202 Accepted).
 */

import { requireAuth } from './_auth-session.js';
import { checkAll, getClientIp, REJECTION_MESSAGES } from './_rate-limiter.js';
import { DEEPGRAM_API_KEY, APP_ORIGIN, assertServerEnv } from './_config.js';
import { secLog, secLogSync } from './_security-log.js';
import { supabaseAdmin } from './_supabase-admin.js';
import {
  filterAssistantTransactions,
  buildAssistantResponse,
} from '../src/features/assistant/assistant.js';

export const config = { runtime: 'edge' };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil(MAX_AUDIO_BYTES * (4 / 3)) + 16;

const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/webm; codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/ogg; codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
]);

const ALLOWED_ORIGINS = new Set(
  [
    APP_ORIGIN,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
  ].filter(Boolean)
);

function isCorsAllowed(req) {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /\.vercel\.app$/.test(origin);
}

function corsHeaders(req) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, ctx) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    secLogSync(req, {
      t: 'SIZE_REJECTED',
      outcome: 'denied',
      status: 413,
      reason: 'CONTENT_LENGTH_EXCEEDED',
      uid: 'anon',
    });
    return json({ error: `Request body too large.` }, 413);
  }

  if (!isCorsAllowed(req)) {
    secLogSync(req, {
      t: 'CORS_REJECTED',
      outcome: 'denied',
      status: 403,
      reason: 'DISALLOWED_ORIGIN',
      uid: 'anon',
    });
    return json({ error: 'Forbidden' }, 403);
  }

  const ip = getClientIp(req);
  const { user, error: authError, response: authResponse } = await requireAuth(req);
  if (authError) return authResponse;

  const rateCheck = checkAll({ ip, userId: user.id, req });
  if (!rateCheck.allowed) {
    return json(
      { error: REJECTION_MESSAGES[rateCheck.reason] || 'Too many requests.' },
      429,
      rateCheck.headers
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { audioBase64, mimeType, language = 'ru', selectedMonth, selectedYear } = body;

  if (!audioBase64) return json({ error: 'audioBase64 is required' }, 400);
  if (audioBase64.length > MAX_BASE64_CHARS) {
    secLogSync(req, {
      t: 'SIZE_REJECTED',
      outcome: 'denied',
      status: 413,
      reason: 'BASE64_LENGTH_EXCEEDED',
      uid: user.id,
      ip,
    });
    return json({ error: `Audio payload too large.` }, 413);
  }

  const normalizedMime = (mimeType || 'audio/webm').toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return json({ error: `Unsupported audio type: "${normalizedMime}".` }, 415);
  }

  let audioContent;
  try {
    const rawBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const byteChars = atob(rawBase64);
    if (byteChars.length > MAX_AUDIO_BYTES) {
      secLogSync(req, {
        t: 'SIZE_REJECTED',
        outcome: 'denied',
        status: 413,
        reason: 'DECODED_BYTES_EXCEEDED',
        uid: user.id,
        ip,
      });
      return json({ error: `Decoded audio too large.` }, 413);
    }
    audioContent = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) audioContent[i] = byteChars.charCodeAt(i);
  } catch (err) {
    return json({ error: `Invalid base64 audio: ${err.message}` }, 400);
  }

  if (!DEEPGRAM_API_KEY) {
    const configErr = assertServerEnv('speech');
    if (configErr) return configErr;
    return json({ error: 'Speech service is not configured' }, 500);
  }

  // ── 8. Create background job ──────────────────────────────────────────────
  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      user_id: user.id,
      type: 'speech_to_text',
      status: 'pending',
      payload: { mimeType: normalizedMime, language, selectedMonth, selectedYear },
    })
    .select()
    .single();

  if (jobError) {
    console.error('[speech] Job creation failed:', jobError);
    return json({ error: 'Failed to initiate background processing' }, 500);
  }

  // ── 9. Execute background logic via waitUntil ─────────────────────────────
  ctx.waitUntil(
    processSpeechJob(job.id, user.id, audioContent, {
      mimeType: normalizedMime,
      language,
      selectedMonth,
      selectedYear,
    })
  );

  await secLog(
    req,
    {
      t: 'JOB_CREATED',
      outcome: 'allowed',
      status: 202,
      uid: user.id,
      ip,
      jobId: job.id,
    },
    'info'
  );

  return json({ jobId: job.id }, 202, {
    ...corsHeaders(req),
    ...rateCheck.headers,
  });
}

/**
 * Background processing logic.
 */
async function processSpeechJob(jobId, userId, audioContent, options) {
  const {
    mimeType,
    language,
    selectedMonth: _selectedMonth,
    selectedYear: _selectedYear,
  } = options;

  try {
    await supabaseAdmin.from('jobs').update({ status: 'processing' }).eq('id', jobId);

    // 1. Transcription
    const deepgramRes = await fetch(
      `https://api.deepgram.com/v1/listen?language=${language}&model=nova-2&smart_format=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': mimeType,
        },
        body: audioContent,
      }
    );

    if (!deepgramRes.ok) throw new Error(`Deepgram failed (${deepgramRes.status})`);
    const dgData = await deepgramRes.json();
    const transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

    if (!transcript) {
      await supabaseAdmin
        .from('jobs')
        .update({
          status: 'completed',
          result: { transcript: '', botResponse: 'Speech not recognized' },
        })
        .eq('id', jobId);
      return;
    }

    // 2. Insert User Message
    await supabaseAdmin.from('chat_messages').insert({
      user_id: userId,
      role: 'user',
      content: transcript,
    });

    // 3. Fetch Context for Assistant
    const [txRes, taxRes, mapRes] = await Promise.all([
      supabaseAdmin.from('transactions').select('*').eq('user_id', userId).is('deleted_at', null),
      Promise.all([
        supabaseAdmin.from('transaction_categories').select('*').order('sort_order'),
        supabaseAdmin.from('transaction_sub_categories').select('*').order('sort_order'),
        supabaseAdmin.from('opex_sub_categories').select('*').order('sort_order'),
      ]),
      supabaseAdmin
        .from('description_mappings')
        .select('description_key, sub_category_id')
        .eq('user_id', userId),
    ]);

    const transactions = (txRes.data || []).map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      subCategory: r.sub_category,
      amount: parseFloat(r.amount),
      liters: r.liters != null ? parseFloat(r.liters) : undefined,
      fuelType: r.fuel_type,
      description: r.description,
      date: r.entry_date,
    }));

    const [catData, subData, opexData] = taxRes;
    const taxonomy = {
      categories: catData.data || [],
      subCategories: subData.data || [],
      opexSubCategories: opexData.data || [],
    };

    const descriptionMappings = {};
    if (mapRes.data) {
      for (const r of mapRes.data) descriptionMappings[r.description_key] = r.sub_category_id;
    }

    // 4. Assistant Logic
    const { filtered, effectivePeriod, matchedCat } = filterAssistantTransactions({
      transactions,
      lowerText: transcript.toLowerCase(),
      language,
      taxonomy,
    });

    const botResponse = buildAssistantResponse({
      filtered,
      effectivePeriod,
      matchedCat,
      lowerText: transcript.toLowerCase(),
      language,
    });

    // 5. Insert Bot Message
    await supabaseAdmin.from('chat_messages').insert({
      user_id: userId,
      role: 'bot',
      content: botResponse,
    });

    // 6. Complete Job
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'completed',
        result: { transcript, botResponse },
      })
      .eq('id', jobId);
  } catch (err) {
    console.error(`[speech-job ${jobId}] error:`, err);
    await supabaseAdmin
      .from('jobs')
      .update({
        status: 'failed',
        error: err.message,
      })
      .eq('id', jobId);
  }
}
