# Changelog

All notable changes to Easy Gmail MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-12-16

### Added
- **getMessage** - Read full email body content by message ID
- **replyToMessage** - Send threaded replies that maintain Gmail conversation threads
- **getThread** - Retrieve all messages in an email conversation
- **markAsRead** - Mark emails as read or unread
- **getAttachment** - Download email attachments as base64

### Changed
- `listMessages` now returns `isRead` and `hasAttachments` flags
- `findMessage` now returns `isRead` flag
- Improved error messages with more descriptive information
- Updated version to 2.0.0

### Technical
- Added `mailparser` for robust MIME parsing
- Implemented RFC 2822 threading via `In-Reply-To` and `References` headers
- Added Zod validation schemas for all new tools
- Extended `EmailMessage` interface with body, threading, and attachment fields

## [1.0.0] - 2024-XX-XX (Original by Sallytion)

### Added
- Initial release
- `listMessages` - List recent inbox messages
- `findMessage` - Search messages by query
- `sendMessage` - Send new emails
- IMAP/SMTP support with app password authentication
- Docker support
