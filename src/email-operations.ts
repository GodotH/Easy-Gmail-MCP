import { ImapService } from './imap-service.js';
import { SmtpService } from './smtp-service.js';
import { 
  EmailMessage, 
  SearchResult, 
  SendResult, 
  OperationResult,
  ThreadResult,
  AttachmentContent,
  ListMessagesParams, 
  FindMessageParams, 
  SendMessageParams,
  GetMessageParams,
  MarkAsReadParams,
  ReplyToMessageParams,
  GetThreadParams,
  GetAttachmentParams,
} from './types.js';

export class EmailOperations {
  constructor(
    private imapService: ImapService,
    private smtpService: SmtpService
  ) {}

  /**
   * List recent messages from email inbox
   */
  async listMessages(params: ListMessagesParams): Promise<EmailMessage[]> {
    try {
      return await this.imapService.listMessages(params.count);
    } catch (error) {
      throw new Error(`Failed to list messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search for messages containing specific words
   */
  async findMessages(params: FindMessageParams): Promise<SearchResult> {
    try {
      return await this.imapService.searchMessages(params.query);
    } catch (error) {
      throw new Error(`Failed to search messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send an email message
   */
  async sendMessage(params: SendMessageParams): Promise<SendResult> {
    try {
      return await this.smtpService.sendMessage(params);
    } catch (error) {
      return {
        messageId: '',
        success: false,
        message: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get a single message with full body content
   */
  async getMessage(params: GetMessageParams): Promise<EmailMessage | null> {
    try {
      return await this.imapService.getMessage(params.id);
    } catch (error) {
      throw new Error(`Failed to get message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark a message as read or unread
   */
  async markAsRead(params: MarkAsReadParams): Promise<OperationResult> {
    try {
      return await this.imapService.markAsRead(params.id, params.read);
    } catch (error) {
      return {
        success: false,
        message: `Failed to update message: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reply to a message (threaded)
   */
  async replyToMessage(params: ReplyToMessageParams): Promise<SendResult> {
    try {
      // First, get the original message headers for threading
      const originalHeaders = await this.imapService.getMessageHeaders(params.id);
      
      if (!originalHeaders) {
        return {
          messageId: '',
          success: false,
          message: 'Original message not found'
        };
      }

      // Extract sender's email for reply
      const fromMatch = originalHeaders.from.match(/<([^>]+)>/) || 
                        originalHeaders.from.match(/([^\s<]+@[^\s>]+)/);
      const replyTo = fromMatch ? fromMatch[1] : originalHeaders.from;

      if (!replyTo || !replyTo.includes('@')) {
        return {
          messageId: '',
          success: false,
          message: 'Could not determine reply address from original message'
        };
      }

      // Build reply body with optional quote
      let replyBody = params.body;
      
      if (params.includeQuote && originalHeaders.body) {
        const quotedBody = originalHeaders.body
          .split('\n')
          .map(line => `> ${line}`)
          .join('\n');
        
        const formattedDate = new Date(originalHeaders.date).toLocaleString();
        replyBody = `${params.body}\n\n---\nOn ${formattedDate}, ${originalHeaders.from} wrote:\n${quotedBody}`;
      }

      // Send reply with threading headers
      return await this.smtpService.sendReply({
        to: replyTo,
        subject: originalHeaders.subject,
        body: replyBody,
        inReplyTo: originalHeaders.messageId,
        references: originalHeaders.references,
      });
    } catch (error) {
      return {
        messageId: '',
        success: false,
        message: `Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all messages in a thread/conversation
   */
  async getThread(params: GetThreadParams): Promise<ThreadResult> {
    try {
      return await this.imapService.getThread(params.id);
    } catch (error) {
      throw new Error(`Failed to get thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get attachment from a message
   */
  async getAttachment(params: GetAttachmentParams): Promise<AttachmentContent | null> {
    try {
      return await this.imapService.getAttachment(
        params.messageId, 
        params.attachmentIndex,
        params.maxSizeBytes
      );
    } catch (error) {
      throw new Error(`Failed to get attachment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
