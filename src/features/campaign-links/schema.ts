import { z } from "zod";

// ─── Constants ──────────────────────────────────────────────────────────────

export const PAYMENT_MODELS = ["CPL", "CPA"] as const;
export type PaymentModelValue = (typeof PAYMENT_MODELS)[number];

export const PAYMENT_MODEL_LABELS: Record<PaymentModelValue, string> = {
  CPL: "CPL (Cost Per Lead)",
  CPA: "CPA (Cost Per Action)",
};

// ─── Validation ─────────────────────────────────────────────────────────────

export const campaignLinkSchema = z
  .object({
    taboolaCampaignExternalId: z.string().min(1, "Taboola campaign is required"),
    taboolaCampaignName: z.string().min(1, "Campaign name is required"),
    keitaroCampaignId: z.string().min(1, "Keitaro campaign is required"),
    paymentModel: z.enum(PAYMENT_MODELS, {
      message: "Payment model is required",
    }),
    cplRate: z
      .string()
      .transform((v) => (v.trim() === "" ? null : v.trim()))
      .nullable(),
    country: z
      .string()
      .transform((v) => (v.trim() === "" ? null : v.trim().toUpperCase()))
      .nullable()
      .optional(),
    adspectStreamId: z
      .string()
      .transform((v) => (v.trim() === "" ? null : v.trim()))
      .nullable()
      .optional(),
  })
  .refine(
    (data) => {
      if (data.paymentModel === "CPL") {
        if (!data.cplRate) return false;
        const num = Number(data.cplRate);
        return !Number.isNaN(num) && num > 0;
      }
      return true;
    },
    {
      message: "CPL rate is required and must be greater than 0",
      path: ["cplRate"],
    },
  );
