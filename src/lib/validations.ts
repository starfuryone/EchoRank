import { z } from "zod";
import { ValidationError } from "@/lib/api-handler";

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  businessName: z.string().min(1).max(200),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").max(200).optional(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "SATISFIED",
      "NEEDS_FOLLOWUP",
      "RECOVERED",
      "LOST",
    ])
    .optional(),
});

export const updateRecoveryTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const submitFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional().nullable(),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  channel: z.enum(["EMAIL", "SMS"]).default("EMAIL"),
  location: z.string().max(200).optional().nullable(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().max(500).optional(),
  body: z.string().min(1).max(10000),
  type: z.enum(["feedback_request", "review_request", "recovery"]),
});

export const createReviewLinkSchema = z.object({
  platform: z.enum(["google", "facebook", "trustpilot", "yelp", "other"]),
  url: z.string().url().max(2000),
  label: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export const inviteTeamMemberSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logo: z.string().url().max(2000).optional().nullable(),
  brandPrimaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  brandSecondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  supportEmail: z.string().email().max(255).optional().nullable(),
  googleReviewLink: z.string().url().max(2000).optional().nullable(),
  facebookReviewLink: z.string().url().max(2000).optional().nullable(),
  trustpilotLink: z.string().url().max(2000).optional().nullable(),
  timezone: z.string().max(100).optional(),
  defaultLanguage: z.string().max(10).optional(),
});

export const enterpriseInquirySchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  company: z.string().min(1).max(200),
  locations: z.number().int().min(1).optional(),
  message: z.string().max(5000).optional(),
});

// Helper to validate and parse
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new ValidationError(
      `${firstIssue.path.join(".")}: ${firstIssue.message}`,
    );
  }
  return result.data;
}
