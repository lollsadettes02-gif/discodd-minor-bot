import discord
from discord.ext import commands
import os
from datetime import datetime
import sys

# Bot setup
intents = discord.Intents.default()
intents.message_content = True
intents.messages = True

bot = commands.Bot(command_prefix='!', intents=intents)

# Configuration
TARGET_CHANNEL_ID = 1447208095217619055
SERVER_ID = 144720436708927087

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
    '.mp4', '.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv'
}

@bot.event
async def on_ready():
    print('=' * 50)
    print(f'🤖 Bot Name: {bot.user.name}')
    print(f'🆔 Bot ID: {bot.user.id}')
    print(f'🕐 Started: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    print('=' * 50)
    print(f'🎯 Target Channel: {TARGET_CHANNEL_ID}')
    print(f'🏠 Server ID: {SERVER_ID}')
    print(f'👥 Connected to {len(bot.guilds)} server(s)')
    print('=' * 50)
    
    # Set status
    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name="media-only channel"
        )
    )
    
    # Sync commands
    try:
        synced = await bot.tree.sync()
        print(f'✅ Synced {len(synced)} slash command(s)')
    except Exception as e:
        print(f'⚠️ Command sync error: {e}')

@bot.event
async def on_message(message):
    # Ignore bot messages
    if message.author.bot:
        return
    
    # Only monitor target channel
    if message.channel.id == TARGET_CHANNEL_ID:
        print(f'📨 Message from {message.author}: {message.content[:50]}...' if message.content else '📨 Message from {message.author} (no text)')
        
        has_valid_attachment = False
        
        # Check attachments
        if message.attachments:
            print(f'📎 Attachments found: {len(message.attachments)}')
            for attachment in message.attachments:
                filename = attachment.filename.lower()
                print(f'  📁 File: {filename}')
                
                # Check extension
                for ext in ALLOWED_EXTENSIONS:
                    if filename.endswith(ext):
                        has_valid_attachment = True
                        print(f'  ✅ Valid {ext} file')
                        break
                
                if has_valid_attachment:
                    break
        
        # Delete if no valid attachments
        if not has_valid_attachment:
            print('❌ No valid attachments - deleting message')
            try:
                # Try to DM user
                try:
                    warning_embed = discord.Embed(
                        title="⚠️ Message Deleted",
                        description=f"Your message in <#{TARGET_CHANNEL_ID}> was automatically removed.",
                        color=discord.Color.orange()
                    )
                    warning_embed.add_field(
                        name="Reason",
                        value="This channel **requires photos or videos** with every message.",
                        inline=False
                    )
                    warning_embed.add_field(
                        name="Allowed Files",
                        value="• Images: JPG, PNG, GIF, WEBP\n• Videos: MP4, MOV, AVI, WEBM",
                        inline=False
                    )
                    warning_embed.set_footer(text="Media-Only Channel Bot")
                    
                    await message.author.send(embed=warning_embed)
                    print(f'📤 Sent DM to {message.author}')
                except:
                    print(f'⚠️ Could not DM {message.author}')
                
                # Delete the message
                await message.delete()
                print(f'🗑️ Deleted message from {message.author}')
                
            except discord.errors.NotFound:
                print('⚠️ Message already deleted')
            except Exception as e:
                print(f'❌ Error: {e}')
        else:
            print('✅ Message allowed (has valid attachment)')
    
    # Process commands
    await bot.process_commands(message)

@bot.tree.command(name="help", description="Show bot commands and info")
async def help_command(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🤖 Media-Only Channel Bot",
        description="Automatically deletes messages without photos/videos",
        color=discord.Color.blue()
    )
    
    embed.add_field(
        name="📋 Commands",
        value="`/help` - This menu\n`/rules` - Channel rules\n`/status` - Bot status\n`/ping` - Check latency",
        inline=False
    )
    
    embed.add_field(
        name="🎯 Channel ID",
        value=f"`{TARGET_CHANNEL_ID}`",
        inline=True
    )
    
    embed.add_field(
        name="📁 Allowed Files",
        value="Images & Videos",
        inline=True
    )
    
    embed.add_field(
        name="⚙️ Version",
        value="1.0.0",
        inline=True
    )
    
    embed.set_footer(text=f"Requested by {interaction.user.name}")
    
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="rules", description="Show channel rules")
async def rules(interaction: discord.Interaction):
    embed = discord.Embed(
        title="📸 #connections - Channel Rules",
        description="**18+ Media-Only Channel**\nEvery message must include photos or videos.",
        color=discord.Color.orange()
    )
    
    embed.add_field(
        name="✅ **ALLOWED**",
        value="• Messages with attached images/videos\n• Text accompanying media is fine\n• Multiple attachments welcome\n• Discussion about shared media",
        inline=False
    )
    
    embed.add_field(
        name="❌ **AUTO-DELETED**",
        value="• Text-only messages\n• Links without media\n• Unsupported file types\n• Empty messages",
        inline=False
    )
    
    embed.add_field(
        name="📎 **Supported Formats**",
        value="**Images:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`\n**Videos:** `.mp4`, `.mov`, `.avi`, `.webm`, `.mkv`",
        inline=False
    )
    
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="status", description="Check bot status")
async def status(interaction: discord.Interaction):
    latency = round(bot.latency * 1000)
    
    # Create status embed
    embed = discord.Embed(
        title="🤖 Bot Status Report",
        color=discord.Color.green() if latency < 150 else discord.Color.orange()
    )
    
    # Add fields
    embed.add_field(name="🏓 Latency", value=f"`{latency}ms`", inline=True)
    embed.add_field(name="⚡ Uptime", value=f"`Online`", inline=True)
    embed.add_field(name="🖥️ Host", value="`Render.com`", inline=True)
    embed.add_field(name="🎯 Channel", value=f"<#{TARGET_CHANNEL_ID}>", inline=True)
    embed.add_field(name="👥 Users", value=f"`{len(bot.users)}`", inline=True)
    embed.add_field(name="📊 Servers", value=f"`{len(bot.guilds)}`", inline=True)
    
    # Add timestamp
    embed.timestamp = datetime.utcnow()
    embed.set_footer(text="Media-Only Channel Bot")
    
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot.tree.command(name="ping", description="Test bot response time")
async def ping(interaction: discord.Interaction):
    latency = round(bot.latency * 1000)
    
    # Color based on latency
    if latency < 100:
        color = discord.Color.green()
        status = "Excellent"
    elif latency < 200:
        color = discord.Color.yellow()
        status = "Good"
    else:
        color = discord.Color.red()
        status = "Slow"
    
    embed = discord.Embed(
        title="🏓 Pong!",
        description=f"**Latency:** `{latency}ms`\n**Status:** `{status}`",
        color=color
    )
    
    await interaction.response.send_message(embed=embed, ephemeral=True)

# Error handling
@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.CommandNotFound):
        return
    print(f"❌ Command Error: {error}")

if __name__ == "__main__":
    # Get token from environment variable
    token = os.getenv('DISCORD_TOKEN')
    
    if token:
        print("🚀 Starting bot...")
        bot.run(token)
    else:
        print("❌ ERROR: DISCORD_TOKEN environment variable not set!")
        print("💡 Set it in Render dashboard: Environment → Add Environment Variable")
        print("   Key: DISCORD_TOKEN")
        print("   Value: Your bot token from Discord Developer Portal")
