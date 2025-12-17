import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { 
  EmailMessage, 
  SearchResult, 
  AttachmentInfo, 
  AttachmentContent,
  ThreadResult,
  OperationResult 
} from './types.js';

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

export class ImapService {
  private config: ImapConfig;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  /**
   * Create a new IMAP connection
   */
  private createConnection(): Imap {
    return new Imap({
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: this.config.tls,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000,
      authTimeout: 10000,
    });
  }

  /**
   * Safely extract email address from header
   */
  private extractEmail(header: string): string {
    if (!header) return '';
    const match = header.match(/<([^>]+)>/) || header.match(/([^\s<]+@[^\s>]+)/);
    return match ? match[1] : header;
  }

  /**
   * Parse headers from raw header string
   */
  private parseHeaders(headerStr: string): Record<string, string> {
    const headers: Record<string, string> = {};
    const lines = headerStr.split(/\r?\n/);
    let currentKey = '';
    let currentValue = '';

    for (const line of lines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        // Continuation of previous header
        currentValue += ' ' + line.trim();
      } else if (line.includes(':')) {
        // Save previous header
        if (currentKey) {
          headers[currentKey.toLowerCase()] = currentValue;
        }
        const colonIndex = line.indexOf(':');
        currentKey = line.substring(0, colonIndex).trim();
        currentValue = line.substring(colonIndex + 1).trim();
      }
    }
    // Save last header
    if (currentKey) {
      headers[currentKey.toLowerCase()] = currentValue;
    }

    return headers;
  }

  /**
   * List recent messages from INBOX (headers only)
   */
  async listMessages(count: number = 10): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();
      const messages: EmailMessage[] = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err: any, box: any) => {
          if (err) {
            imap.end();
            reject(new Error(`Failed to open inbox: ${err.message}`));
            return;
          }

          const total = box.messages.total;
          if (total === 0) {
            imap.end();
            resolve([]);
            return;
          }

          const start = Math.max(1, total - count + 1);
          const range = `${start}:${total}`;

          const fetch = imap.seq.fetch(range, {
            bodies: 'HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID IN-REPLY-TO REFERENCES)',
            struct: true
          });

          fetch.on('message', (msg: any, seqno: any) => {
            let header = '';
            let attrs: any = null;
            
            msg.on('body', (stream: any) => {
              stream.on('data', (chunk: any) => {
                header += chunk.toString('utf8');
              });
            });

            msg.once('attributes', (a: any) => {
              attrs = a;
            });

            msg.once('end', () => {
              try {
                const headers = this.parseHeaders(header);
                const hasAttachments = attrs.struct && 
                  JSON.stringify(attrs.struct).includes('"disposition":["attachment"');

                const message: EmailMessage = {
                  id: attrs.uid.toString(),
                  threadId: attrs.uid.toString(),
                  subject: headers.subject || '(No Subject)',
                  from: headers.from || '',
                  to: (headers.to || '').split(',').map((e: string) => e.trim()).filter(Boolean),
                  cc: headers.cc ? headers.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : undefined,
                  date: attrs.date?.toISOString() || new Date().toISOString(),
                  snippet: `${headers.subject || '(No Subject)'} - ${headers.from || 'Unknown sender'}`,
                  labels: ['INBOX'],
                  isRead: attrs.flags?.includes('\\Seen') || false,
                  hasAttachments,
                  messageId: headers['message-id'],
                  inReplyTo: headers['in-reply-to'],
                  references: headers.references?.split(/\s+/).filter(Boolean),
                };

                messages.push(message);
              } catch (error) {
                console.error('Error parsing message:', error);
              }
            });
          });

          fetch.once('error', (err: any) => {
            imap.end();
            reject(new Error(`Fetch error: ${err.message}`));
          });

          fetch.once('end', () => {
            imap.end();
            messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            resolve(messages);
          });
        });
      });

      imap.once('error', (err: any) => {
        reject(new Error(`IMAP connection error: ${err.message}`));
      });

      imap.connect();
    });
  }

  /**
   * Search for messages containing specific terms
   */
  async searchMessages(query: string): Promise<SearchResult> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();
      const messages: EmailMessage[] = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err: any, box: any) => {
          if (err) {
            imap.end();
            reject(new Error(`Failed to open inbox: ${err.message}`));
            return;
          }

          imap.search(['ALL', ['TEXT', query]], (err: any, results: any) => {
            if (err) {
              imap.end();
              reject(new Error(`Search error: ${err.message}`));
              return;
            }

            if (!results || results.length === 0) {
              imap.end();
              resolve({ messages: [], totalCount: 0, query });
              return;
            }

            const limitedResults = results.slice(-50); // Most recent 50

            const fetch = imap.fetch(limitedResults, {
              bodies: 'HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)',
              struct: true
            });

            fetch.on('message', (msg: any, seqno: any) => {
              let header = '';
              let attrs: any = null;
              
              msg.on('body', (stream: any) => {
                stream.on('data', (chunk: any) => {
                  header += chunk.toString('utf8');
                });
              });

              msg.once('attributes', (a: any) => {
                attrs = a;
              });

              msg.once('end', () => {
                try {
                  const headers = this.parseHeaders(header);

                  const message: EmailMessage = {
                    id: attrs.uid.toString(),
                    threadId: attrs.uid.toString(),
                    subject: headers.subject || '(No Subject)',
                    from: headers.from || '',
                    to: (headers.to || '').split(',').map((e: string) => e.trim()).filter(Boolean),
                    date: attrs.date?.toISOString() || new Date().toISOString(),
                    snippet: `${headers.subject || '(No Subject)'} - ${headers.from || 'Unknown sender'}`,
                    labels: ['INBOX'],
                    isRead: attrs.flags?.includes('\\Seen') || false,
                  };

                  messages.push(message);
                } catch (error) {
                  console.error('Error parsing message:', error);
                }
              });
            });

            fetch.once('error', (err: any) => {
              imap.end();
              reject(new Error(`Fetch error: ${err.message}`));
            });

            fetch.once('end', () => {
              imap.end();
              messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              resolve({
                messages,
                totalCount: results.length,
                query
              });
            });
          });
        });
      });

      imap.once('error', (err: any) => {
        reject(new Error(`IMAP connection error: ${err.message}`));
      });

      imap.connect();
    });
  }

  /**
   * Get a single message with full body content
   */
  async getMessage(uid: string): Promise<EmailMessage | null> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err: any, box: any) => {
          if (err) {
            imap.end();
            reject(new Error(`Failed to open inbox: ${err.message}`));
            return;
          }

          const fetch = imap.fetch([uid], {
            bodies: '',  // Fetch entire message
            struct: true
          });

          let messageFound = false;

          fetch.on('message', (msg: any, seqno: any) => {
            messageFound = true;
            let rawMessage = Buffer.alloc(0);
            let attrs: any = null;
            
            msg.on('body', (stream: any) => {
              const chunks: Buffer[] = [];
              stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
              });
              stream.once('end', () => {
                rawMessage = Buffer.concat(chunks);
              });
            });

            msg.once('attributes', (a: any) => {
              attrs = a;
            });

            msg.once('end', async () => {
              try {
                const parsed: ParsedMail = await simpleParser(rawMessage);
                
                // Extract attachment info (without content)
                const attachments: AttachmentInfo[] = (parsed.attachments || []).map((att, index) => ({
                  index,
                  filename: att.filename || `attachment_${index}`,
                  contentType: att.contentType || 'application/octet-stream',
                  size: att.size || 0,
                }));

                const message: EmailMessage = {
                  id: uid,
                  threadId: uid,
                  subject: parsed.subject || '(No Subject)',
                  from: parsed.from?.text || '',
                  to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(t => t.text) : [parsed.to.text]) : [],
                  cc: parsed.cc ? (Array.isArray(parsed.cc) ? parsed.cc.map(c => c.text) : [parsed.cc.text]) : undefined,
                  date: parsed.date?.toISOString() || new Date().toISOString(),
                  snippet: (parsed.text || '').substring(0, 200),
                  body: parsed.text || '',
                  bodyHtml: parsed.html || undefined,
                  labels: ['INBOX'],
                  isRead: attrs?.flags?.includes('\\Seen') || false,
                  hasAttachments: attachments.length > 0,
                  attachments,
                  messageId: parsed.messageId,
                  inReplyTo: parsed.inReplyTo,
                  references: parsed.references ? 
                    (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : undefined,
                };

                imap.end();
                resolve(message);
              } catch (error) {
                imap.end();
                reject(new Error(`Failed to parse message: ${error instanceof Error ? error.message : 'Unknown error'}`));
              }
            });
          });

          fetch.once('error', (err: any) => {
            imap.end();
            reject(new Error(`Fetch error: ${err.message}`));
          });

          fetch.once('end', () => {
            if (!messageFound) {
              imap.end();
              resolve(null);
            }
          });
        });
      });

      imap.once('error', (err: any) => {
        reject(new Error(`IMAP connection error: ${err.message}`));
      });

      imap.connect();
    });
  }

  /**
   * Mark a message as read or unread
   */
  async markAsRead(uid: string, read: boolean = true): Promise<OperationResult> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err: any, box: any) => { // false = read-write mode
          if (err) {
            imap.end();
            reject(new Error(`Failed to open inbox: ${err.message}`));
            return;
          }

          const flagOperation = read ? 'addFlags' : 'delFlags';
          
          imap[flagOperation]([uid], ['\\Seen'], (err: any) => {
            imap.end();
            
            if (err) {
              resolve({
                success: false,
                message: `Failed to ${read ? 'mark as read' : 'mark as unread'}: ${err.message}`
              });
            } else {
              resolve({
                success: true,
                message: `Message ${read ? 'marked as read' : 'marked as unread'} successfully`
              });
            }
          });
        });
      });

      imap.once('error', (err: any) => {
        reject(new Error(`IMAP connection error: ${err.message}`));
      });

      imap.connect();
    });
  }

  /**
   * Get thread/conversation messages by finding related messages
   * Uses In-Reply-To and References headers to find thread members
   */
  async getThread(uid: string): Promise<ThreadResult> {
    return new Promise(async (resolve, reject) => {
      try {
        // First, get the original message to find its Message-ID and References
        const originalMessage = await this.getMessage(uid);
        
        if (!originalMessage) {
          resolve({
            messages: [],
            threadId: uid,
            messageCount: 0
          });
          return;
        }

        // Collect all message IDs in the thread
        const threadMessageIds = new Set<string>();
        
        if (originalMessage.messageId) {
          threadMessageIds.add(originalMessage.messageId);
        }
        if (originalMessage.inReplyTo) {
          threadMessageIds.add(originalMessage.inReplyTo);
        }
        if (originalMessage.references) {
          originalMessage.references.forEach(ref => threadMessageIds.add(ref));
        }

        if (threadMessageIds.size === 0) {
          // No thread info, return just this message
          resolve({
            messages: [originalMessage],
            threadId: uid,
            messageCount: 1
          });
          return;
        }

        // Search for all messages in the thread
        const imap = this.createConnection();
        const messages: EmailMessage[] = [];

        imap.once('ready', () => {
          imap.openBox('INBOX', true, async (err: any, box: any) => {
            if (err) {
              imap.end();
              resolve({
                messages: [originalMessage],
                threadId: uid,
                messageCount: 1
              });
              return;
            }

            // Search for messages with matching Message-ID or References
            const searchPromises = Array.from(threadMessageIds).map(msgId => {
              return new Promise<number[]>((res) => {
                imap.search([['HEADER', 'MESSAGE-ID', msgId]], (err: any, results: any) => {
                  res(err ? [] : (results || []));
                });
              });
            });

            // Also search for messages that reference these IDs
            const refSearchPromises = Array.from(threadMessageIds).map(msgId => {
              return new Promise<number[]>((res) => {
                imap.search([['HEADER', 'REFERENCES', msgId]], (err: any, results: any) => {
                  res(err ? [] : (results || []));
                });
              });
            });

            const allResults = await Promise.all([...searchPromises, ...refSearchPromises]);
            const uniqueUids = [...new Set(allResults.flat())];

            if (uniqueUids.length === 0) {
              imap.end();
              resolve({
                messages: [originalMessage],
                threadId: uid,
                messageCount: 1
              });
              return;
            }

            // Fetch all thread messages
            const fetch = imap.fetch(uniqueUids, {
              bodies: '',
              struct: true
            });

            fetch.on('message', (msg: any, seqno: any) => {
              let rawMessage = Buffer.alloc(0);
              let attrs: any = null;
              
              msg.on('body', (stream: any) => {
                const chunks: Buffer[] = [];
                stream.on('data', (chunk: Buffer) => {
                  chunks.push(chunk);
                });
                stream.once('end', () => {
                  rawMessage = Buffer.concat(chunks);
                });
              });

              msg.once('attributes', (a: any) => {
                attrs = a;
              });

              msg.once('end', async () => {
                try {
                  const parsed: ParsedMail = await simpleParser(rawMessage);
                  
                  const message: EmailMessage = {
                    id: attrs.uid.toString(),
                    threadId: uid,
                    subject: parsed.subject || '(No Subject)',
                    from: parsed.from?.text || '',
                    to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(t => t.text) : [parsed.to.text]) : [],
                    date: parsed.date?.toISOString() || new Date().toISOString(),
                    snippet: (parsed.text || '').substring(0, 200),
                    body: parsed.text || '',
                    labels: ['INBOX'],
                    isRead: attrs?.flags?.includes('\\Seen') || false,
                    messageId: parsed.messageId,
                  };

                  messages.push(message);
                } catch (error) {
                  console.error('Error parsing thread message:', error);
                }
              });
            });

            fetch.once('error', (err: any) => {
              imap.end();
              resolve({
                messages: [originalMessage],
                threadId: uid,
                messageCount: 1
              });
            });

            fetch.once('end', () => {
              imap.end();
              // Sort by date (oldest first for thread context)
              messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              resolve({
                messages,
                threadId: uid,
                messageCount: messages.length
              });
            });
          });
        });

        imap.once('error', (err: any) => {
          resolve({
            messages: [originalMessage],
            threadId: uid,
            messageCount: 1
          });
        });

        imap.connect();

      } catch (error) {
        reject(new Error(`Failed to get thread: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Get attachment content from a message
   */
  async getAttachment(uid: string, attachmentIndex: number = 0, maxSizeBytes: number = 10 * 1024 * 1024): Promise<AttachmentContent | null> {
    return new Promise((resolve, reject) => {
      const imap = this.createConnection();

      imap.once('ready', () => {
        imap.openBox('INBOX', true, (err: any, box: any) => {
          if (err) {
            imap.end();
            reject(new Error(`Failed to open inbox: ${err.message}`));
            return;
          }

          const fetch = imap.fetch([uid], {
            bodies: '',
            struct: true
          });

          let messageFound = false;

          fetch.on('message', (msg: any, seqno: any) => {
            messageFound = true;
            let rawMessage = Buffer.alloc(0);
            
            msg.on('body', (stream: any) => {
              const chunks: Buffer[] = [];
              stream.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
              });
              stream.once('end', () => {
                rawMessage = Buffer.concat(chunks);
              });
            });

            msg.once('end', async () => {
              try {
                const parsed: ParsedMail = await simpleParser(rawMessage);
                
                if (!parsed.attachments || parsed.attachments.length === 0) {
                  imap.end();
                  resolve(null);
                  return;
                }

                if (attachmentIndex >= parsed.attachments.length) {
                  imap.end();
                  resolve(null);
                  return;
                }

                const attachment = parsed.attachments[attachmentIndex];
                
                // Safety check: size limit
                if (attachment.size > maxSizeBytes) {
                  imap.end();
                  reject(new Error(`Attachment size (${attachment.size} bytes) exceeds limit (${maxSizeBytes} bytes)`));
                  return;
                }

                const result: AttachmentContent = {
                  filename: attachment.filename || `attachment_${attachmentIndex}`,
                  contentType: attachment.contentType || 'application/octet-stream',
                  size: attachment.size,
                  content: attachment.content.toString('base64'),
                };

                imap.end();
                resolve(result);
              } catch (error) {
                imap.end();
                reject(new Error(`Failed to parse attachment: ${error instanceof Error ? error.message : 'Unknown error'}`));
              }
            });
          });

          fetch.once('error', (err: any) => {
            imap.end();
            reject(new Error(`Fetch error: ${err.message}`));
          });

          fetch.once('end', () => {
            if (!messageFound) {
              imap.end();
              resolve(null);
            }
          });
        });
      });

      imap.once('error', (err: any) => {
        reject(new Error(`IMAP connection error: ${err.message}`));
      });

      imap.connect();
    });
  }

  /**
   * Get message headers for reply (used by replyToMessage)
   */
  async getMessageHeaders(uid: string): Promise<{
    from: string;
    subject: string;
    messageId: string | undefined;
    references: string[];
    date: string;
    body: string;
  } | null> {
    const message = await this.getMessage(uid);
    if (!message) return null;
    
    return {
      from: message.from,
      subject: message.subject,
      messageId: message.messageId,
      references: [
        ...(message.references || []),
        message.messageId
      ].filter(Boolean) as string[],
      date: message.date,
      body: message.body || '',
    };
  }
}
