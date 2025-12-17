import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

// Existing schemas
export const ListMessagesSchema = z.object({
  count: z.number().min(1).max(100).optional().default(10),
});

export const FindMessageSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
});

export const SendMessageSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject cannot be empty'),
  body: z.string().min(1, 'Message body cannot be empty'),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
});

// NEW: Get single message by ID
export const GetMessageSchema = z.object({
  id: z.string()
    .min(1, 'Message ID cannot be empty')
    .regex(/^\d+$/, 'Message ID must be numeric'),
});

// NEW: Mark message as read/unread
export const MarkAsReadSchema = z.object({
  id: z.string()
    .min(1, 'Message ID cannot be empty')
    .regex(/^\d+$/, 'Message ID must be numeric'),
  read: z.boolean().optional().default(true),
});

// NEW: Reply to a message (threaded)
export const ReplyToMessageSchema = z.object({
  id: z.string()
    .min(1, 'Message ID cannot be empty')
    .regex(/^\d+$/, 'Message ID must be numeric'),
  body: z.string()
    .min(1, 'Reply body cannot be empty')
    .max(100000, 'Reply body too long (max 100KB)'),
  includeQuote: z.boolean().optional().default(true),
});

// NEW: Get thread (all messages in conversation)
export const GetThreadSchema = z.object({
  id: z.string()
    .min(1, 'Message ID cannot be empty')
    .regex(/^\d+$/, 'Message ID must be numeric'),
});

// NEW: Get attachment
export const GetAttachmentSchema = z.object({
  messageId: z.string()
    .min(1, 'Message ID cannot be empty')
    .regex(/^\d+$/, 'Message ID must be numeric'),
  attachmentIndex: z.number()
    .min(0, 'Attachment index must be non-negative')
    .max(50, 'Attachment index too high')
    .optional()
    .default(0),
  maxSizeBytes: z.number()
    .min(1)
    .max(25 * 1024 * 1024, 'Max attachment size is 25MB')
    .optional()
    .default(10 * 1024 * 1024), // Default 10MB limit
});

// ============================================
// TYPE EXPORTS
// ============================================

export type ListMessagesParams = z.infer<typeof ListMessagesSchema>;
export type FindMessageParams = z.infer<typeof FindMessageSchema>;
export type SendMessageParams = z.infer<typeof SendMessageSchema>;
export type GetMessageParams = z.infer<typeof GetMessageSchema>;
export type MarkAsReadParams = z.infer<typeof MarkAsReadSchema>;
export type ReplyToMessageParams = z.infer<typeof ReplyToMessageSchema>;
export type GetThreadParams = z.infer<typeof GetThreadSchema>;
export type GetAttachmentParams = z.infer<typeof GetAttachmentSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  date: string;
  snippet: string;
  body?: string;
  bodyHtml?: string;
  labels: string[];
  isRead?: boolean;
  hasAttachments?: boolean;
  attachments?: AttachmentInfo[];
  inReplyTo?: string;
  references?: string[];
  messageId?: string; // RFC 822 Message-ID header
}

export interface AttachmentInfo {
  index: number;
  filename: string;
  contentType: string;
  size: number;
}

export interface AttachmentContent {
  filename: string;
  contentType: string;
  size: number;
  content: string; // Base64 encoded
}

export interface SearchResult {
  messages: EmailMessage[];
  totalCount: number;
  query: string;
}

export interface SendResult {
  messageId: string;
  success: boolean;
  message: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
}

export interface ThreadResult {
  messages: EmailMessage[];
  threadId: string;
  messageCount: number;
}
