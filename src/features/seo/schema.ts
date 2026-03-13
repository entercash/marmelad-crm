import { z } from "zod";

// ─── Constants (re-export for forms) ─────────────────────────────────────────

export const PAYMENT_MODELS = ["CPL", "CPA"] as const;
export type PaymentModelValue = (typeof PAYMENT_MODELS)[number];

export const PAYMENT_MODEL_LABELS: Record<PaymentModelValue, string> = {
  CPL: "CPL (Cost Per Lead)",
  CPA: "CPA (Cost Per Action)",
};

// ─── SeoBrand ────────────────────────────────────────────────────────────────

export const seoBrandSchema = z.object({
  name: z
    .string()
    .min(1, "Brand name is required")
    .max(300, "Brand name must be 300 characters or less")
    .transform((v) => v.trim()),
  link: z
    .string()
    .min(1, "Link is required")
    .max(2000, "Link must be 2000 characters or less")
    .transform((v) => v.trim()),
});

// ─── SeoLead ─────────────────────────────────────────────────────────────────

export const seoLeadSchema = z.object({
  seoBrandId: z.string().min(1, "Brand is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date is required"),
  quantity: z
    .string()
    .min(1, "Quantity is required")
    .transform((v) => {
      const num = Number(v.trim());
      if (Number.isNaN(num)) return -1;
      return Math.floor(num);
    })
    .refine((n) => n > 0, { message: "Quantity must be greater than 0" }),
  country: z
    .string()
    .min(1, "Country is required")
    .max(2, "Use ISO alpha-2 code")
    .transform((v) => v.trim().toUpperCase()),
  paymentModel: z.enum(PAYMENT_MODELS, {
    message: "Payment model is required",
  }),
  rate: z
    .string()
    .min(1, "Rate is required")
    .transform((v) => {
      const num = Number(v.trim());
      if (Number.isNaN(num)) return -1;
      return num;
    })
    .refine((n) => n > 0, { message: "Rate must be greater than 0" }),
});
