# Discord Media-Only Channel Bot

🤖 Automatically deletes messages without attachments in a specific Discord channel.

## Features
- ✅ Deletes text-only messages in target channel
- ✅ Allows messages with photos/videos
- ✅ Sends DM warnings to users
- ✅ Slash commands for rules/status
- ✅ Hosted on Render 24/7

## Channel Configuration
- **Server ID:** `144720436708927087`
- **Channel ID:** `1447208095217619055`

## Setup

### 1. Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application → Bot
3. Enable Privileged Gateway Intents:
   - Message Content Intent
4. Copy Bot Token

### 2. Render Deployment
1. Fork/Push this repository to GitHub
2. Go to [Render.com](https://render.com)
3. Connect GitHub repository
4. Add environment variable:
   - `DISCORD_TOKEN` = your_bot_token_here
5. Deploy!

### 3. Invite Bot to Server
