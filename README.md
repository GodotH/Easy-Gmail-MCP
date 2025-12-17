# Easy Gmail MCP

> **A powerful Model Context Protocol (MCP) server for Gmail** — Read, send, reply, and manage emails directly from Claude Desktop or any MCP-compatible AI assistant.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)]()
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)]()

---

## What Makes This Special

**Easy Gmail MCP** lets AI assistants like Claude interact with your Gmail inbox naturally. No complex OAuth flows, no Google Cloud Console setup — just a simple app password and you're ready to go in under 5 minutes.

### Key Features

| Feature | Description |
|---------|-------------|
| **Read Full Emails** | Get complete email content, not just snippets |
| **Send Emails** | Compose and send emails with CC/BCC support |
| **Threaded Replies** | Reply to emails while keeping conversation threads intact |
| **View Conversations** | See all messages in an email thread |
| **Mark Read/Unread** | Manage your inbox state |
| **Download Attachments** | Extract attachments from emails |
| **Search Inbox** | Find emails using Gmail search syntax |

---

## Quick Start (5 Minutes)

### Step 1: Get a Gmail App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required)
3. Go to **App Passwords** (search "app passwords" in account settings)
4. Select **Mail** and your device
5. Click **Generate** → Copy the 16-character password

> **Important:** You need 2-Step Verification enabled to create app passwords.

### Step 2: Clone & Install

```bash
git clone https://github.com/GodotH/Easy-Gmail-MCP.git
cd Easy-Gmail-MCP
npm install
```

### Step 3: Configure Environment

Create a `.env` file in the project root:

```env
EMAIL_ADDRESS=your.email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

> Replace `xxxx xxxx xxxx xxxx` with your 16-character app password (spaces optional).

### Step 4: Build

```bash
npm run build
```

### Step 5: Add to Claude Desktop

Open your Claude Desktop config file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "node",
      "args": ["C:/path/to/Easy-Gmail-MCP/dist/index.js"],
      "cwd": "C:/path/to/Easy-Gmail-MCP"
    }
  }
}
```

> Replace `C:/path/to/Easy-Gmail-MCP` with your actual path.

### Step 6: Restart Claude Desktop

Close and reopen Claude Desktop. You should now be able to interact with your Gmail!

---

## Available Tools

### listMessages
List recent messages from your inbox.

```
"Show me my last 10 emails"
```

**Parameters:**
- `count` (optional): Number of messages (1-100, default: 10)

---

### findMessage
Search for emails using Gmail search syntax.

```
"Find emails from john@example.com about the project"
```

**Parameters:**
- `query` (required): Search query

**Supported search operators:**
- `from:sender@example.com`
- `to:recipient@example.com`
- `subject:keyword`
- `has:attachment`
- `is:unread`
- `after:2024/01/01`
- `before:2024/12/31`

---

### getMessage
Read the full content of a specific email.

```
"Read email ID 19"
```

**Parameters:**
- `id` (required): Message ID (from listMessages or findMessage)

**Returns:** Complete email with body, attachments info, and threading headers.

---

### sendMessage
Send a new email.

```
"Send an email to jane@example.com with subject 'Meeting Tomorrow' saying 'Hi Jane, can we meet at 3pm?'"
```

**Parameters:**
- `to` (required): Recipient email
- `subject` (required): Email subject
- `body` (required): Message content
- `cc` (optional): CC recipient
- `bcc` (optional): BCC recipient

---

### replyToMessage
Reply to an existing email (maintains thread).

```
"Reply to email 19 saying 'Thanks for the information!'"
```

**Parameters:**
- `id` (required): Message ID to reply to
- `body` (required): Reply content
- `includeQuote` (optional): Include original message (default: true)

---

### getThread
Get all messages in a conversation.

```
"Show me the full conversation for email 19"
```

**Parameters:**
- `id` (required): Any message ID in the thread

---

### markAsRead
Mark an email as read or unread.

```
"Mark email 19 as read"
```

**Parameters:**
- `id` (required): Message ID
- `read` (optional): true for read, false for unread (default: true)

---

### getAttachment
Download an attachment from an email.

```
"Download the first attachment from email 19"
```

**Parameters:**
- `messageId` (required): Message ID
- `attachmentIndex` (optional): Which attachment (0-based, default: 0)
- `maxSizeBytes` (optional): Size limit (default: 10MB, max: 25MB)

---

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_ADDRESS` | Yes | - | Your Gmail address |
| `EMAIL_PASSWORD` | Yes | - | Gmail App Password |
| `IMAP_HOST` | No | `imap.gmail.com` | IMAP server |
| `IMAP_PORT` | No | `993` | IMAP port |
| `SMTP_HOST` | No | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | No | `587` | SMTP port |

### Other Email Providers

Easy Gmail MCP works with any email provider that supports IMAP/SMTP:

**Outlook/Hotmail:**
```env
IMAP_HOST=outlook.office365.com
IMAP_PORT=993
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
```

**Yahoo:**
```env
IMAP_HOST=imap.mail.yahoo.com
IMAP_PORT=993
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
```

---

## Docker Usage (Optional)

```bash
# Build
docker build -t easy-gmail-mcp .

# Run
docker run --rm -i --env-file .env easy-gmail-mcp
```

Or with docker-compose:

```bash
docker-compose up -d
```

---

## Development

```bash
# Install dependencies
npm install

# Development mode (with tsx)
npm run dev

# Watch for changes
npm run watch

# Build for production
npm run build

# Start production
npm start
```

---

## Security Notes

- **App Passwords** are specific to your app and can be revoked anytime
- **Never share** your `.env` file or commit it to git
- The `.gitignore` already excludes `.env`
- App passwords don't give access to your Google account settings
- You can delete the app password anytime to revoke access

---

## Troubleshooting

### "Authentication failed"
- Ensure 2-Step Verification is enabled on your Google account
- Generate a new App Password (they can only be viewed once)
- Make sure you're using the App Password, not your regular password

### "Connection refused"
- Check if your firewall allows ports 993 (IMAP) and 587 (SMTP)
- Verify IMAP is enabled in Gmail settings: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP

### "Message not found"
- Message IDs change between sessions
- Use `listMessages` or `findMessage` to get current IDs

### Claude Desktop doesn't see the tools
- Verify the path in `claude_desktop_config.json` is correct
- Restart Claude Desktop completely (not just close the window)
- Check the path uses forward slashes or escaped backslashes

---

## Changelog

### v2.0.0 (Current)
- **NEW:** `getMessage` - Read full email content
- **NEW:** `replyToMessage` - Threaded replies
- **NEW:** `getThread` - View full conversations
- **NEW:** `markAsRead` - Mark emails read/unread
- **NEW:** `getAttachment` - Download attachments
- Improved email parsing with mailparser
- Better error handling

### v1.0.0 (Original)
- Basic `listMessages`, `findMessage`, `sendMessage`

---

## Credits

This project is a fork of [Sallytion/Gmail-MCP](https://github.com/Sallytion/Gmail-MCP), extended with additional functionality for full email management.

---

## License

MIT License — feel free to use, modify, and distribute.

---

## Author

**Godot Huard**
- GitHub: [@GodotH](https://github.com/GodotH)

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Star History

If you find this useful, please give it a star! It helps others discover the project.
