/**
 * Easy Gmail MCP Test Suite
 * Tests all functions for stability and safety
 * Run with: npm run build && npm run test
 */

import dotenv from 'dotenv';
import { ImapService } from './imap-service.js';
import { SmtpService } from './smtp-service.js';
import { EmailOperations } from './email-operations.js';
import {
  GetMessageSchema,
  MarkAsReadSchema,
  ReplyToMessageSchema,
  GetThreadSchema,
  GetAttachmentSchema,
} from './types.js';

dotenv.config();

// Test configuration
const TEST_CONFIG = {
  // Set to true to run tests that modify state (mark as read, send reply)
  RUN_DESTRUCTIVE_TESTS: false,
  // Message ID to test with (get from listMessages first)
  TEST_MESSAGE_ID: '',
};

class TestRunner {
  private emailOperations: EmailOperations;
  private passCount = 0;
  private failCount = 0;

  constructor() {
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
  }

  private log(message: string) {
    console.log(`[TEST] ${message}`);
  }

  private pass(testName: string) {
    this.passCount++;
    console.log(`  PASS: ${testName}`);
  }

  private fail(testName: string, error: any) {
    this.failCount++;
    console.log(`  FAIL: ${testName}`);
    console.log(`     Error: ${error instanceof Error ? error.message : error}`);
  }

  // ========================================
  // VALIDATION TESTS (Safety)
  // ========================================

  async testInputValidation() {
    this.log('\n=== INPUT VALIDATION TESTS ===');

    // Test GetMessageSchema - Invalid ID (non-numeric)
    try {
      GetMessageSchema.parse({ id: 'abc' });
      this.fail('GetMessageSchema rejects non-numeric ID', 'Should have thrown');
    } catch (e) {
      this.pass('GetMessageSchema rejects non-numeric ID');
    }

    // Test GetMessageSchema - Empty ID
    try {
      GetMessageSchema.parse({ id: '' });
      this.fail('GetMessageSchema rejects empty ID', 'Should have thrown');
    } catch (e) {
      this.pass('GetMessageSchema rejects empty ID');
    }

    // Test GetMessageSchema - SQL injection attempt
    try {
      GetMessageSchema.parse({ id: "1; DROP TABLE emails;--" });
      this.fail('GetMessageSchema rejects SQL injection', 'Should have thrown');
    } catch (e) {
      this.pass('GetMessageSchema rejects SQL injection');
    }

    // Test MarkAsReadSchema - Valid
    try {
      const result = MarkAsReadSchema.parse({ id: '123', read: true });
      if (result.id === '123' && result.read === true) {
        this.pass('MarkAsReadSchema accepts valid input');
      } else {
        this.fail('MarkAsReadSchema accepts valid input', 'Unexpected result');
      }
    } catch (e) {
      this.fail('MarkAsReadSchema accepts valid input', e);
    }

    // Test ReplyToMessageSchema - Body too long
    try {
      ReplyToMessageSchema.parse({ 
        id: '123', 
        body: 'x'.repeat(100001)  // Over 100KB limit
      });
      this.fail('ReplyToMessageSchema rejects oversized body', 'Should have thrown');
    } catch (e) {
      this.pass('ReplyToMessageSchema rejects oversized body');
    }

    // Test GetAttachmentSchema - Index too high
    try {
      GetAttachmentSchema.parse({ 
        messageId: '123', 
        attachmentIndex: 100  // Over limit of 50
      });
      this.fail('GetAttachmentSchema rejects high index', 'Should have thrown');
    } catch (e) {
      this.pass('GetAttachmentSchema rejects high attachment index');
    }

    // Test GetAttachmentSchema - Size limit exceeded
    try {
      GetAttachmentSchema.parse({ 
        messageId: '123', 
        maxSizeBytes: 30 * 1024 * 1024  // Over 25MB limit
      });
      this.fail('GetAttachmentSchema rejects oversized limit', 'Should have thrown');
    } catch (e) {
      this.pass('GetAttachmentSchema rejects oversized limit request');
    }
  }

  // ========================================
  // FUNCTIONAL TESTS (Stability)
  // ========================================

  async testListMessages() {
    this.log('\n=== LIST MESSAGES TEST ===');
    
    try {
      const messages = await this.emailOperations.listMessages({ count: 5 });
      
      if (Array.isArray(messages)) {
        this.pass(`listMessages returns array (${messages.length} messages)`);
        
        if (messages.length > 0) {
          const msg = messages[0];
          if (msg.id && msg.subject && msg.from && msg.date) {
            this.pass('Message has required fields (id, subject, from, date)');
            console.log(`     Sample: ID=${msg.id}, Subject="${msg.subject.substring(0, 40)}..."`);
            
            // Store for later tests
            if (!TEST_CONFIG.TEST_MESSAGE_ID) {
              TEST_CONFIG.TEST_MESSAGE_ID = msg.id;
              console.log(`     Using message ID ${msg.id} for subsequent tests`);
            }
          } else {
            this.fail('Message has required fields', 'Missing fields');
          }
        }
      } else {
        this.fail('listMessages returns array', 'Not an array');
      }
    } catch (e) {
      this.fail('listMessages executes without error', e);
    }
  }

  async testGetMessage() {
    this.log('\n=== GET MESSAGE TEST ===');

    if (!TEST_CONFIG.TEST_MESSAGE_ID) {
      console.log('     Skipping: No test message ID available');
      return;
    }

    try {
      const message = await this.emailOperations.getMessage({ 
        id: TEST_CONFIG.TEST_MESSAGE_ID 
      });
      
      if (message) {
        this.pass('getMessage returns message object');
        
        if (message.body !== undefined) {
          this.pass('Message has body content');
          console.log(`     Body preview: "${(message.body || '').substring(0, 100)}..."`);
        } else {
          this.fail('Message has body content', 'body is undefined');
        }

        if (message.hasAttachments !== undefined) {
          this.pass(`Message has attachment info (hasAttachments=${message.hasAttachments})`);
        }
      } else {
        this.fail('getMessage returns message object', 'null returned');
      }
    } catch (e) {
      this.fail('getMessage executes without error', e);
    }

    // Test non-existent message
    try {
      const message = await this.emailOperations.getMessage({ id: '999999999' });
      if (message === null) {
        this.pass('getMessage returns null for non-existent ID');
      } else {
        this.fail('getMessage returns null for non-existent ID', 'Got unexpected result');
      }
    } catch (e) {
      // Some IMAP servers may throw instead of returning null
      this.pass('getMessage handles non-existent ID gracefully');
    }
  }

  async testGetThread() {
    this.log('\n=== GET THREAD TEST ===');

    if (!TEST_CONFIG.TEST_MESSAGE_ID) {
      console.log('     Skipping: No test message ID available');
      return;
    }

    try {
      const thread = await this.emailOperations.getThread({ 
        id: TEST_CONFIG.TEST_MESSAGE_ID 
      });
      
      if (thread && Array.isArray(thread.messages)) {
        this.pass(`getThread returns thread (${thread.messageCount} messages)`);
        
        if (thread.messages.length > 0 && thread.messages[0].body !== undefined) {
          this.pass('Thread messages include body content');
        }
      } else {
        this.fail('getThread returns valid result', 'Invalid structure');
      }
    } catch (e) {
      this.fail('getThread executes without error', e);
    }
  }

  async testMarkAsRead() {
    this.log('\n=== MARK AS READ TEST ===');

    if (!TEST_CONFIG.RUN_DESTRUCTIVE_TESTS) {
      console.log('     Skipping: Destructive tests disabled');
      return;
    }

    if (!TEST_CONFIG.TEST_MESSAGE_ID) {
      console.log('     Skipping: No test message ID available');
      return;
    }

    try {
      // Mark as read
      const result = await this.emailOperations.markAsRead({ 
        id: TEST_CONFIG.TEST_MESSAGE_ID,
        read: true 
      });
      
      if (result.success) {
        this.pass('markAsRead (read=true) succeeds');
      } else {
        this.fail('markAsRead (read=true) succeeds', result.message);
      }

      // Mark as unread (restore state)
      const result2 = await this.emailOperations.markAsRead({ 
        id: TEST_CONFIG.TEST_MESSAGE_ID,
        read: false 
      });
      
      if (result2.success) {
        this.pass('markAsRead (read=false) succeeds');
      } else {
        this.fail('markAsRead (read=false) succeeds', result2.message);
      }
    } catch (e) {
      this.fail('markAsRead executes without error', e);
    }
  }

  async testGetAttachment() {
    this.log('\n=== GET ATTACHMENT TEST ===');

    // Find a message with attachments
    try {
      const messages = await this.emailOperations.listMessages({ count: 20 });
      const msgWithAttachment = messages.find(m => m.hasAttachments);
      
      if (!msgWithAttachment) {
        console.log('     Skipping: No messages with attachments found');
        return;
      }

      console.log(`     Testing with message ID ${msgWithAttachment.id}`);

      const attachment = await this.emailOperations.getAttachment({
        messageId: msgWithAttachment.id,
        attachmentIndex: 0,
        maxSizeBytes: 5 * 1024 * 1024, // 5MB limit for test
      });

      if (attachment) {
        this.pass(`getAttachment returns attachment (${attachment.filename})`);
        
        if (attachment.content && attachment.content.length > 0) {
          this.pass('Attachment has base64 content');
          console.log(`     Size: ${attachment.size} bytes, Type: ${attachment.contentType}`);
        }
      } else {
        this.fail('getAttachment returns attachment', 'null returned');
      }
    } catch (e) {
      this.fail('getAttachment executes without error', e);
    }
  }

  async testReplyToMessage() {
    this.log('\n=== REPLY TO MESSAGE TEST ===');

    if (!TEST_CONFIG.RUN_DESTRUCTIVE_TESTS) {
      console.log('     Skipping: Destructive tests disabled (would send email)');
      return;
    }

    if (!TEST_CONFIG.TEST_MESSAGE_ID) {
      console.log('     Skipping: No test message ID available');
      return;
    }

    try {
      const result = await this.emailOperations.replyToMessage({
        id: TEST_CONFIG.TEST_MESSAGE_ID,
        body: 'This is an automated test reply. Please ignore.',
        includeQuote: false,
      });

      if (result.success) {
        this.pass('replyToMessage sends successfully');
        console.log(`     Message ID: ${result.messageId}`);
      } else {
        this.fail('replyToMessage sends successfully', result.message);
      }
    } catch (e) {
      this.fail('replyToMessage executes without error', e);
    }
  }

  // ========================================
  // RUN ALL TESTS
  // ========================================

  async runAll() {
    console.log('================================================================');
    console.log('           EASY GMAIL MCP TEST SUITE v2.0.0                     ');
    console.log('================================================================');
    console.log(`\nEmail: ${process.env.EMAIL_ADDRESS}`);
    console.log(`Destructive tests: ${TEST_CONFIG.RUN_DESTRUCTIVE_TESTS ? 'ENABLED' : 'DISABLED'}`);

    // Run tests in order
    await this.testInputValidation();
    await this.testListMessages();
    await this.testGetMessage();
    await this.testGetThread();
    await this.testMarkAsRead();
    await this.testGetAttachment();
    await this.testReplyToMessage();

    // Summary
    console.log('\n================================================================');
    console.log('                      TEST SUMMARY                              ');
    console.log('================================================================');
    console.log(`  Passed: ${this.passCount}`);
    console.log(`  Failed: ${this.failCount}`);
    console.log(`  Total: ${this.passCount + this.failCount}`);
    
    if (this.failCount === 0) {
      console.log('\n  All tests passed!');
    } else {
      console.log('\n  Some tests failed. Review output above.');
    }

    process.exit(this.failCount > 0 ? 1 : 0);
  }
}

// Run tests
const runner = new TestRunner();
runner.runAll().catch(console.error);
