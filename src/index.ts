import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { ImapService } from './imap-service.js';
import { SmtpService } from './smtp-service.js';
import { EmailOperations } from './email-operations.js';
import { 
  ListMessagesSchema, 
  FindMessageSchema, 
  SendMessageSchema,
  GetMessageSchema,
  MarkAsReadSchema,
  ReplyToMessageSchema,
  GetThreadSchema,
  GetAttachmentSchema,
} from './types.js';

// Load environment variables
dotenv.config();

class EmailMCPServer {
  private server: Server;
  private emailOperations: EmailOperations;

  constructor() {
    this.server = new Server(
      {
        name: 'easy-gmail-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize IMAP and SMTP services
    const imapConfig = {
      host: process.env.IMAP_HOST || 'imap.gmail.com',
      port: parseInt(process.env.IMAP_PORT || '993'),
      user: process.env.EMAIL_ADDRESS!,
      password: process.env.EMAIL_PASSWORD!,
      tls: true,
    };

    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.EMAIL_ADDRESS!,
      password: process.env.EMAIL_PASSWORD!,
    };

    const imapService = new ImapService(imapConfig);
    const smtpService = new SmtpService(smtpConfig);
    this.emailOperations = new EmailOperations(imapService, smtpService);

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // ===== EXISTING TOOLS =====
          {
            name: 'listMessages',
            description: 'List recent messages from Gmail inbox',
            inputSchema: {
              type: 'object',
              properties: {
                count: {
                  type: 'number',
                  description: 'Number of messages to retrieve (default: 10, max: 100)',
                  minimum: 1,
                  maximum: 100,
                  default: 10,
                },
              },
            },
          },
          {
            name: 'findMessage',
            description: 'Search for messages containing specific words or phrases',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query (supports Gmail search syntax)',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'sendMessage',
            description: 'Send an email message',
            inputSchema: {
              type: 'object',
              properties: {
                to: {
                  type: 'string',
                  description: 'Recipient email address',
                  format: 'email',
                },
                subject: {
                  type: 'string',
                  description: 'Email subject',
                },
                body: {
                  type: 'string',
                  description: 'Email message body',
                },
                cc: {
                  type: 'string',
                  description: 'CC email address (optional)',
                  format: 'email',
                },
                bcc: {
                  type: 'string',
                  description: 'BCC email address (optional)',
                  format: 'email',
                },
              },
              required: ['to', 'subject', 'body'],
            },
          },

          // ===== NEW TOOLS =====
          {
            name: 'getMessage',
            description: 'Get a single email message with full body content. Use this to read the complete email text.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The message ID (UID) to retrieve. Get IDs from listMessages or findMessage.',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'markAsRead',
            description: 'Mark an email message as read or unread',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The message ID (UID) to mark',
                },
                read: {
                  type: 'boolean',
                  description: 'Set to true to mark as read, false to mark as unread (default: true)',
                  default: true,
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'replyToMessage',
            description: 'Reply to an existing email message. The reply will be properly threaded in Gmail.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The message ID (UID) to reply to',
                },
                body: {
                  type: 'string',
                  description: 'The reply message body',
                },
                includeQuote: {
                  type: 'boolean',
                  description: 'Include quoted original message in reply (default: true)',
                  default: true,
                },
              },
              required: ['id', 'body'],
            },
          },
          {
            name: 'getThread',
            description: 'Get all messages in an email thread/conversation. Returns messages sorted chronologically.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The message ID (UID) of any message in the thread',
                },
              },
              required: ['id'],
            },
          },
          {
            name: 'getAttachment',
            description: 'Download an attachment from an email message. Returns base64-encoded content.',
            inputSchema: {
              type: 'object',
              properties: {
                messageId: {
                  type: 'string',
                  description: 'The message ID (UID) containing the attachment',
                },
                attachmentIndex: {
                  type: 'number',
                  description: 'Index of the attachment (0-based, default: 0 for first attachment)',
                  minimum: 0,
                  default: 0,
                },
                maxSizeBytes: {
                  type: 'number',
                  description: 'Maximum attachment size in bytes (default: 10MB, max: 25MB)',
                  default: 10485760,
                  maximum: 26214400,
                },
              },
              required: ['messageId'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // ===== EXISTING HANDLERS =====
          case 'listMessages': {
            const params = ListMessagesSchema.parse(args || {});
            const messages = await this.emailOperations.listMessages(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    count: messages.length,
                    messages: messages.map(msg => ({
                      id: msg.id,
                      subject: msg.subject,
                      from: msg.from,
                      date: msg.date,
                      snippet: msg.snippet,
                      isRead: msg.isRead,
                      hasAttachments: msg.hasAttachments,
                    })),
                  }, null, 2),
                },
              ],
            };
          }

          case 'findMessage': {
            const params = FindMessageSchema.parse(args);
            const result = await this.emailOperations.findMessages(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    query: result.query,
                    totalCount: result.totalCount,
                    foundMessages: result.messages.length,
                    messages: result.messages.map(msg => ({
                      id: msg.id,
                      subject: msg.subject,
                      from: msg.from,
                      date: msg.date,
                      snippet: msg.snippet,
                      isRead: msg.isRead,
                    })),
                  }, null, 2),
                },
              ],
            };
          }

          case 'sendMessage': {
            const params = SendMessageSchema.parse(args);
            const result = await this.emailOperations.sendMessage(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: result.success,
                    messageId: result.messageId,
                    message: result.message,
                  }, null, 2),
                },
              ],
            };
          }

          // ===== NEW HANDLERS =====
          case 'getMessage': {
            const params = GetMessageSchema.parse(args);
            const message = await this.emailOperations.getMessage(params);
            
            if (!message) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      message: 'Message not found',
                    }, null, 2),
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: {
                      id: message.id,
                      subject: message.subject,
                      from: message.from,
                      to: message.to,
                      cc: message.cc,
                      date: message.date,
                      body: message.body,
                      isRead: message.isRead,
                      hasAttachments: message.hasAttachments,
                      attachments: message.attachments,
                      messageId: message.messageId,
                      inReplyTo: message.inReplyTo,
                    },
                  }, null, 2),
                },
              ],
            };
          }

          case 'markAsRead': {
            const params = MarkAsReadSchema.parse(args);
            const result = await this.emailOperations.markAsRead(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'replyToMessage': {
            const params = ReplyToMessageSchema.parse(args);
            const result = await this.emailOperations.replyToMessage(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: result.success,
                    messageId: result.messageId,
                    message: result.message,
                  }, null, 2),
                },
              ],
            };
          }

          case 'getThread': {
            const params = GetThreadSchema.parse(args);
            const result = await this.emailOperations.getThread(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    threadId: result.threadId,
                    messageCount: result.messageCount,
                    messages: result.messages.map(msg => ({
                      id: msg.id,
                      subject: msg.subject,
                      from: msg.from,
                      date: msg.date,
                      body: msg.body,
                      isRead: msg.isRead,
                    })),
                  }, null, 2),
                },
              ],
            };
          }

          case 'getAttachment': {
            const params = GetAttachmentSchema.parse(args);
            const attachment = await this.emailOperations.getAttachment(params);
            
            if (!attachment) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      message: 'Attachment not found',
                    }, null, 2),
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    attachment: {
                      filename: attachment.filename,
                      contentType: attachment.contentType,
                      size: attachment.size,
                      content: attachment.content, // Base64 encoded
                    },
                  }, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new McpError(ErrorCode.InternalError, errorMessage);
      }
    });
  }

  async run() {
    // Check if environment variables are set
    if (!process.env.EMAIL_ADDRESS || !process.env.EMAIL_PASSWORD) {
      console.error('Missing required environment variables. Please check your .env file.');
      console.error('Required variables: EMAIL_ADDRESS, EMAIL_PASSWORD');
      process.exit(1);
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Easy Gmail MCP server v2.0.0 running on stdio');
  }
}

// Start the server
const server = new EmailMCPServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
