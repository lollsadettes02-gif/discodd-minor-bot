const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

console.log('🚀 Starting Discord bot...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ]
});

const YOUR_SERVER_ID = '1447204367089270874';
const LOG_CHANNEL_ID = '1457870506505011331';
const SPECIFIC_CHANNEL_ID = '1447208095217619055';

// ====== SMART AGE DETECTION ======
function extractAge(content) {
  const text = content.toLowerCase().replace(/\s+/g, ' ');
  let age = null;
  
  // Pattern 1: Direct age at start (like "20 looking for fun")
  const startPattern = /^(\d{1,2})\s+(?:top|bottom|verse|dom|sub|femboy|masc|looking|dm|dms|send|any)/i;
  const startMatch = text.match(startPattern);
  if (startMatch) {
    const num = parseInt(startMatch[1]);
    if (num >= 1 && num <= 99) {
      return num;
    }
  }
  
  // Pattern 2: Common age formats
  const patterns = [
    /\b(\d{1,2})\s*(?:m|f|male|female|yo|y\.o\.|years?|yrs?)\b/i,
    /\b(?:age|aged)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*\/\s*(?:m|f)\b/i,
    /\b(?:m|f)\s*\/\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:top|bottom|verse)\b/i,
    /\b(?:top|bottom|verse)\s*(\d{1,2})\b/i,
    /\bdms?\s*(?:open|closed)?\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*dms?\b/i,
    /\bsend\s*(?:age|asl)?\s*(\d{1,2})\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      if (num >= 1 && num <= 99) {
        return num;
      }
    }
  }
  
  // Pattern 3: Standalone age in context
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^\d]/g, '');
    if (word && !isNaN(word)) {
      const num = parseInt(word);
      if (num >= 1 && num <= 99) {
        // Check context around the number
        const context = words.slice(Math.max(0, i - 2), Math.min(words.length, i + 3)).join(' ');
        const ageIndicators = ['top', 'bottom', 'verse', 'dom', 'sub', 'looking', 'dm', 'dms', 'send', 'age', 'male', 'female', 'm', 'f', 'yo'];
        const isAgeContext = ageIndicators.some(indicator => 
          context.includes(indicator)
        );
        
        if (isAgeContext) {
          return num;
        }
      }
    }
  }
  
  return null;
}

function checkMessage(content, attachments, channelId) {
  const redFlags = [];
  let shouldLog = false;
  
  const age = extractAge(content);
  
  // ====== UNDERAGE DETECTION ======
  if (age !== null) {
    if (age < 18) {
      redFlags.push(`underage (${age})`);
      shouldLog = true;
    } else if (age > 50) {
      redFlags.push(`suspicious age (${age})`);
      shouldLog = true;
    }
  }
  
  // ====== REVERSAL SYMBOLS ======
  if (/[🔄↩↪]/.test(content)) {
    redFlags.push('reversal symbols');
    shouldLog = true;
  }
  
  // ====== SEEKING OLDER ======
  if (/looking for.*(?:older|daddy|mature)/i.test(content)) {
    redFlags.push('seeking older');
    shouldLog = true;
  }
  
  // ====== DMS OPEN WITH AGE ======
  if (/dms? open/i.test(content.toLowerCase()) && age !== null && age < 30) {
    redFlags.push('dms open with age');
    shouldLog = true;
  }
  
  // ====== SPECIFIC CHANNEL RULES ======
  if (channelId === SPECIFIC_CHANNEL_ID) {
    const hasAttachments = attachments.size > 0;
    const hasValidAttachments = hasAttachments && 
      Array.from(attachments.values()).every(att => 
        att.url.includes('cdn.discordapp.com') || 
        att.url.includes('media.discordapp.net') ||
        att.contentType?.startsWith('image/') ||
        att.contentType?.startsWith('video/')
      );
    
    if (!age) {
      redFlags.push('no age (channel rule)');
    }
    
    if (!hasValidAttachments) {
      redFlags.push('no valid attachments (channel rule)');
    }
  }
  
  return {
    isBad: redFlags.length > 0,
    shouldLog: shouldLog,
    reasons: redFlags,
    age: age,
    originalMessage: content
  };
}

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  client.user.setActivity('checking ages ⚠️', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== YOUR_SERVER_ID) return;
  
  const result = checkMessage(message.content, message.attachments, message.channel.id);
  
  if (result.isBad) {
    try {
      await message.delete();
      console.log(`🗑️ Deleted from ${message.author.tag}: ${result.reasons[0]}`);
      
      // === ONLY LOG TO BANS CHANNEL IF SHOULDLOG ===
      if (result.shouldLog) {
        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          const now = new Date();
          const timeString = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          }).toLowerCase();
          
          const dateString = `Today at ${timeString}`;
          
          const truncatedMessage = message.content.length > 500 
            ? message.content.substring(0, 497) + '...' 
            : message.content;
          
          const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setDescription(
              `**APP**\n` +
              `**${dateString}**\n\n` +
              `**${message.author.username}**\n` +
              `**Channel:** ${message.channel.name}\n` +
              `\`id: ${message.author.id} | reason: ${result.reasons[0]} |\`\n` +
              `\`${dateString}\`\n\n` +
              `**Message:**\n${truncatedMessage}\n\n` +
              `✅ ban • ⚠️ ignore`
            )
            .setFooter({ text: `pending action` });
          
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`ban_${message.author.id}_${message.id}`)
                .setLabel('ban')
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId(`ignore_${message.author.id}_${message.id}`)
                .setLabel('ignore')
                .setStyle(ButtonStyle.Secondary)
            );
          
          await logChannel.send({ 
            embeds: [embed],
            components: [row]
          });
          
          console.log(`📝 Logged to bans channel: ${message.author.username}`);
        }
      }
      // === NO LOGGING FOR SIMPLE RULE VIOLATIONS ===
      
    } catch (error) {
      console.log('⚠️ Error:', error.message);
    }
  }
});

// Handle button clicks
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const [action, userId, messageId] = interaction.customId.split('_');
  const now = new Date();
  const actionTime = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
  const actionDate = now.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
  
  const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
  const embedData = originalEmbed.data;
  
  if (action === 'ban') {
    try {
      const member = await interaction.guild.members.fetch(userId);
      await member.ban({ reason: `Auto-mod: ${embedData.description?.split('reason: ')[1]?.split(' |')[0] || 'Minor detected'}` });
      
      const updatedEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setDescription(embedData.description)
        .setFooter({ 
          text: `banned by @${interaction.user.username} • ${actionDate} at ${actionTime}` 
        });
      
      await interaction.message.edit({ 
        embeds: [updatedEmbed],
        components: []
      });
      
      await interaction.reply({ 
        content: `✅ Banned ${member.user.tag}`, 
        ephemeral: true 
      });
      
      console.log(`🔨 Banned ${member.user.tag} by ${interaction.user.tag}`);
      
    } catch (error) {
      console.log('Ban error:', error.message);
      
      const failedEmbed = new EmbedBuilder()
        .setColor('#ff9900')
        .setDescription(embedData.description)
        .setFooter({ 
          text: `ban attempted by @${interaction.user.username} • ${actionDate} at ${actionTime} (failed)` 
        });
      
      await interaction.message.edit({ 
        embeds: [failedEmbed],
        components: []
      });
      
      await interaction.reply({ 
        content: `❌ Could not ban user: ${error.message}`, 
        ephemeral: true 
      });
    }
  }
  
  if (action === 'ignore') {
    const updatedEmbed = new EmbedBuilder()
      .setColor('#808080')
      .setDescription(embedData.description)
      .setFooter({ 
        text: `ignored by @${interaction.user.username} • ${actionDate} at ${actionTime}` 
      });
    
    await interaction.message.edit({ 
      embeds: [updatedEmbed],
      components: []
    });
    
    await interaction.reply({ 
      content: `⚠️ Ignored user ${userId}`, 
      ephemeral: true 
    });
    
    console.log(`👁️ Ignored ${userId} by ${interaction.user.tag}`);
  }
});

// Health check
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    bot: client.user?.tag || 'Starting...',
    uptime: process.uptime()
  });
});

app.listen(PORT, () => {
  console.log(`🌐 Health check: http://localhost:${PORT}`);
});

// Login
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('❌ Login failed:', error.message);
  process.exit(1);
});
