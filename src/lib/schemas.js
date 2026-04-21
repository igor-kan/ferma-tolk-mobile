import { z } from 'zod';

export const VALID_TX_TYPES = new Set(['income', 'expense']);
export const VALID_CATEGORIES = new Set([
  'opex',
  'capex',
  'operationalRevenue',
  'subsidies',
  'assetSale',
]);
export const VALID_FUEL_TYPES = new Set(['petrol', 'diesel', 'propan', 'other']);
export const ALLOWED_MIME_TYPES = new Set([
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

export const MAX_AUDIO_MB = 5;
export const MAX_AUDIO_BYTES = MAX_AUDIO_MB * 1024 * 1024;
export const MAX_BASE64_CHARS = Math.ceil(MAX_AUDIO_BYTES * (4 / 3)) + 16;
export const MAX_BODY_BYTES = 8 * 1024 * 1024;

export const MAX_DESCRIPTION_LEN = 1000;
export const MAX_PROJECT_SLUG_LEN = 100;
export const MAX_PROJECT_LABEL_LEN = 200;
export const MAX_AMOUNT = 999_999_999_99;

function s(v) {
  return (v == null ? '' : String(v)).trim();
}

function parseDate(v) {
  if (typeof v !== 'string' || !v) return false;
  const d = new Date(v);
  return !isNaN(d.getTime());
}

export const TransactionSchema = z
  .object({
    id: z
      .any()
      .optional()
      .transform((v) => (v == null ? null : s(v))),
    type: z
      .any()
      .transform(s)
      .refine((v) => VALID_TX_TYPES.has(v), { message: 'type must be valid' }),
    category: z
      .any()
      .optional()
      .transform((v) => (v == null ? null : s(v)))
      .refine((v) => v == null || v === '' || VALID_CATEGORIES.has(v), {
        message: 'category must be valid',
      }),
    subCategory: z
      .any()
      .optional()
      .transform((v) => (v == null ? null : s(v)))
      .refine((v) => v == null || v === '' || v.length <= 100, {
        message: 'subCategory must be <= 100 chars',
      }),
    projectId: z
      .any()
      .optional()
      .transform((v) => (v == null ? null : s(v))),
    amount: z
      .any()
      .transform((v) => parseFloat(v))
      .refine((v) => Number.isFinite(v), { message: 'amount must be a number' })
      .refine((v) => v > 0, { message: 'amount must be greater than 0' })
      .refine((v) => v <= MAX_AMOUNT, { message: 'amount exceeds maximum' }),
    liters: z
      .any()
      .optional()
      .transform((v) => (v === '' || v == null ? null : parseFloat(v)))
      .refine((v) => v == null || Number.isFinite(v), { message: 'liters must be a number' })
      .refine((v) => v == null || v >= 0, { message: 'liters must be >= 0' })
      .refine((v) => v == null || v <= 100_000, { message: 'liters value is unreasonably large' }),
    fuelType: z
      .any()
      .optional()
      .transform((v) => (v == null ? null : s(v)))
      .refine((v) => v == null || v === '' || VALID_FUEL_TYPES.has(v), {
        message: 'fuelType must be valid',
      }),
    isFuel: z
      .any()
      .optional()
      .transform((v) => Boolean(v)),
    description: z
      .any()
      .optional()
      .transform((v) => (v == null ? null : s(v)))
      .refine((v) => v == null || v.length <= MAX_DESCRIPTION_LEN, {
        message: 'description must be <= 1000 chars',
      })
      // eslint-disable-next-line no-control-regex
      .transform((v) => (v == null ? null : v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''))),
    date: z
      .any()
      .optional()
      .refine((v) => !v || parseDate(v), { message: 'date must be valid ISO 8601 date string' })
      .transform((v) => (v ? new Date(v).toISOString() : new Date().toISOString())),
  })
  .transform((val) => ({
    id: val.id,
    type: val.type,
    category:
      val.category && val.category !== ''
        ? val.category
        : val.type === 'income'
          ? 'operationalRevenue'
          : 'opex',
    subCategory: val.subCategory && val.subCategory !== '' ? val.subCategory : null,
    projectId: val.projectId && val.projectId !== '' ? val.projectId : null,
    amount: val.amount,
    liters: val.liters !== null ? val.liters : null,
    fuelType: val.fuelType && val.fuelType !== '' ? val.fuelType : null,
    isFuel: val.isFuel,
    description: val.description || null,
    date: val.date,
  }));

export const TransactionUpdateSchema = z
  .any()
  .superRefine((raw, ctx) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Update payload must be an object' });
      return;
    }
    const ALLOWED = new Set([
      'type',
      'category',
      'subCategory',
      'projectId',
      'amount',
      'liters',
      'fuelType',
      'isFuel',
      'description',
      'date',
      'version',
    ]);
    const keys = Object.keys(raw);
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Update payload must contain at least one field',
      });
      return;
    }
    const unknown = keys.filter((k) => !ALLOWED.has(k));
    if (unknown.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown field(s): ${unknown.join(', ')}`,
      });
    }

    if (raw.type !== undefined) {
      const type = s(raw.type);
      if (!VALID_TX_TYPES.has(type))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'type must be valid' });
    }
    if (raw.amount !== undefined) {
      const amount = parseFloat(raw.amount);
      if (!Number.isFinite(amount) || amount <= 0)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount must be a positive number' });
      else if (amount > MAX_AMOUNT)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'amount exceeds maximum' });
    }
    if (raw.category !== undefined) {
      const category = s(raw.category);
      if (category && !VALID_CATEGORIES.has(category))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'category must be valid' });
    }
    if (raw.subCategory !== undefined) {
      const subCategory = s(raw.subCategory);
      if (subCategory.length > 100)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'subCategory must be <= 100 chars' });
    }
    if (raw.liters !== undefined && raw.liters !== null && raw.liters !== '') {
      const liters = parseFloat(raw.liters);
      if (!Number.isFinite(liters) || liters < 0)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'liters must be a non-negative number',
        });
    }
    if (raw.fuelType !== undefined) {
      const fuelType = s(raw.fuelType);
      if (fuelType && !VALID_FUEL_TYPES.has(fuelType))
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'fuelType must be valid' });
    }
    if (raw.description !== undefined) {
      const description = s(raw.description);
      if (description.length > MAX_DESCRIPTION_LEN)
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'description must be <= 1000 chars' });
    }
    if (raw.date !== undefined) {
      if (!parseDate(raw.date))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'date must be valid ISO 8601 date string',
        });
    }
  })
  .transform((raw) => {
    const value = {};
    if (!raw || typeof raw !== 'object') return value;
    if (raw.type !== undefined) value.type = s(raw.type);
    if (raw.amount !== undefined) value.amount = parseFloat(raw.amount);
    if (raw.category !== undefined) value.category = s(raw.category) || null;
    if (raw.subCategory !== undefined) value.subCategory = s(raw.subCategory) || null;
    if (raw.liters !== undefined && raw.liters !== null && raw.liters !== '')
      value.liters = parseFloat(raw.liters);
    if (raw.fuelType !== undefined) value.fuelType = s(raw.fuelType) || null;
    if (raw.isFuel !== undefined) value.isFuel = Boolean(raw.isFuel);
    if (raw.description !== undefined) {
      const desc = s(raw.description);
      // eslint-disable-next-line no-control-regex
      value.description = desc.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') || null;
    }
    if (raw.date !== undefined) value.date = new Date(raw.date).toISOString();
    if (raw.projectId !== undefined)
      value.projectId = raw.projectId != null ? s(raw.projectId) : null;
    if (raw.version !== undefined) value.version = raw.version;
    return value;
  });

export const ProjectSchema = z
  .any()
  .superRefine((raw, ctx) => {
    if (!raw || typeof raw !== 'object') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Project must be an object' });
      return;
    }
    const label = s(raw.name || raw.label || '');
    if (!label) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Project name is required' });
    } else if (label.length > MAX_PROJECT_LABEL_LEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Project name must be ${MAX_PROJECT_LABEL_LEN} characters or fewer`,
      });
    } else {
      const slug = label
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, MAX_PROJECT_SLUG_LEN);
      if (!slug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Project name produces an empty slug after normalization',
        });
      }
    }
  })
  .transform((raw) => {
    if (!raw) return { slug: '', label: '' };
    const label = s(raw.name || raw.label || '');
    const slug = label
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, MAX_PROJECT_SLUG_LEN);
    return { slug, label };
  });

export const SpeechPayloadSchema = z
  .any()
  .superRefine((raw, ctx) => {
    if (!raw || typeof raw !== 'object') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Request body must be a JSON object' });
      return;
    }
    if (!raw.audioBase64 || typeof raw.audioBase64 !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'audioBase64 is required and must be a string',
      });
    } else if (raw.audioBase64.length > MAX_BASE64_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Audio payload too large. Maximum is ${MAX_AUDIO_MB} MB.`,
      });
    } else {
      const rawBase64 = raw.audioBase64.includes(',')
        ? raw.audioBase64.split(',')[1]
        : raw.audioBase64;
      if (!rawBase64)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'audioBase64 contains no data after the data URL prefix',
        });
    }
    const normalizedMime = (raw.mimeType || 'audio/webm').toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unsupported audio type' });
    }
  })
  .transform((raw) => {
    if (!raw) return { rawBase64: '', mimeType: '' };
    const normalizedMime = (raw.mimeType || 'audio/webm').toLowerCase().trim();
    const rawBase64 =
      typeof raw.audioBase64 === 'string' && raw.audioBase64.includes(',')
        ? raw.audioBase64.split(',')[1]
        : raw.audioBase64;
    return { rawBase64, mimeType: normalizedMime };
  });

/**
 * @typedef {import('zod').infer<typeof TransactionSchema>} Transaction
 * @typedef {import('zod').infer<typeof TransactionUpdateSchema>} TransactionUpdate
 * @typedef {import('zod').infer<typeof ProjectSchema>} Project
 * @typedef {import('zod').infer<typeof SpeechPayloadSchema>} SpeechPayload
 */
