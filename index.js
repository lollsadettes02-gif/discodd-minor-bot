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
const SPECIFIC_CHANNEL_ID = '1447208095217619055'; // Your specific channel

function checkMessage(content, attachments, channelId) {
  const redFlags = [];
  let detectedAge = null;
  let ageInMessage = false;
  
  const cleanContent = content.toLowerCase();
  
  // ====== AGE DETECTION ======
  const agePatterns = [
    /\b(\d{1,2})\s*(?:m|f|male|female)\b/i,
    /\b(\d{1,2})\s*(?:yo|y\.o\.)\b/i,
    /\b(\d{1,2})\s*(?:years?|yrs?)\s*old\b/i,
    /\b(\d{1,2})\s*(?:years?|yrs?)\b/i,
    /\bage\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\s*\/\s*[mf]\b/i,
    /\b[MF]\s*\/\s*(\d{1,2})\b/i,
  ];
  
  // Check if ANY age pattern exists
  for (const pattern of agePatterns) {
    const match = cleanContent.match(pattern);
    if (match) {
      ageInMessage = true;
      detectedAge = parseInt(match[1]);
      break;
    }
  }
  
  // ====== SPECIFIC CHANNEL RULES ======
  if (channelId === SPECIFIC_CHANNEL_ID) {
    // Rule 1: MUST have age
    if (!ageInMessage) {
      redFlags.push('no age (channel rule)');
    }
    
    // Rule 2: MUST have attachments (images/videos)
    const hasAttachments = attachments.size > 0;
    if (!hasAttachments) {
      redFlags.push('no attachments (channel rule)');
    } else {
      // Check attachments are NOT links (must be uploaded files)
      const allAttachments = Array.from(attachments.values());
      const hasLinks = allAttachments.some(att => 
        att.url.match(/\.(com|net|org|io|me|xyz|link|url)\//i) ||
        att.url.includes('http') && !att.url.includes('cdn.discordapp.com')
      );
      
      if (hasLinks) {
        redFlags.push('links not allowed (channel rule)');
      }
    }
  } else {
    // REGULAR CHANNELS: Just need age
    if (!ageInMessage) {
      redFlags.push('no age provided');
    }
  }
  
  // ====== UNDERAGE DETECTION (ALL CHANNELS) ======
  if (detectedAge !== null) {
    if (detectedAge < 18) {
      redFlags.push(`underage (${detectedAge})`);
    } else if (detectedAge > 50) {
      redFlags.push(`suspicious age (${detectedAge})`);
    }
  }
  
  // ====== OTHER RED FLAGS ======
  if (/[🔄↩↪]/.test(content)) {
    redFlags.push('reversal symbols');
  }
  
  if (/looking for.*(?:older|daddy|mature)/i.test(content)) {
    redFlags.push('seeking older');
  }
  
  if (/dms? open/i.test(cleanContent) && /\b\d{1,2}\b/.test(cleanContent)) {
    redFlags.push('dms open');
  }
  
  return {
    isBad: redFlags.length > 0,
    reasons: redFlags,
    age: detectedAge,
    noAgeProvided: !ageInMessage,
    originalMessage: content,
    hasAttachments: attachments.size > 0,
    score: redFlags.length * 30
  };
}

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  console.log(`✅ Specific channel: ${SPECIFIC_CHANNEL_ID} (age + attachments required)`);
  client.user.setActivity('checking ages ⚠️', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== YOUR_SERVER_ID) return;
  
  const result = checkMessage(message.content, message.attachments, message.channel.id);
  
  if (result.isBad) {
    try {
      await message.delete();
      console.log(`🗑️ Deleted from ${message.author.tag} in #${message.channel.name} - ${result.reasons[0]}`);
      
      // Only send DM warning for UNDERAGE, not for "no age" in specific channel
      const isUnderage = result.reasons.some(r => r.includes('underage'));
      if (isUnderage) {
        try {
          await message.author.send(
            `⚠️ **Your message in ${message.guild.name} was deleted.**\n` +
            `**Reason:** ${result.reasons.join(', ')}\n` +
            `**Channel:** ${message.channel.name}\n` +
            `Please follow server rules.`
          );
        } catch (dmError) {
          // User has DMs closed
        }
      }
      
      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        // Get current time
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        }).toLowerCase();
        
        const dateString = `Today at ${timeString}`;
        
        // Truncate message if too long
        const truncatedMessage = message.content.length > 500 
          ? message.content.substring(0, 497) + '...' 
          : message.content;
        
        // Determine if we should show buttons
        const shouldShowButtons = result.reasons.some(r => 
          r.includes('underage') || r.includes('suspicious')
        );
        
        // Create the embed
        const embed = new EmbedBuilder()
          .setColor(shouldShowButtons ? '#2b2d31' : '#808080')
          .setDescription(
            `**APP**\n` +
            `**${dateString}**\n\n` +
            `**${message.author.username}**\n` +
            `**Channel:** ${message.channel.name}\n` +
            `\`id: ${message.author.id} | reason: ${result.reasons[0] || 'rule violation'} |\`\n` +
            `\`${dateString}\`\n\n` +
            `**Message:**\n${truncatedMessage}\n\n` +
            (shouldShowButtons ? `✅ ban • ⚠️ ignore` : `⚠️ message deleted`)
          )
          .setFooter({ 
            text: shouldShowButtons ? `pending action` : `auto-deleted` 
          });
        
        if (shouldShowButtons) {
          // PROPER BUTTONS (not emojis in text)
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`ban_${message.author.id}_${message.id}`)
                .setLabel('ban')
                .setStyle(ButtonStyle.Danger), // Red button
              new ButtonBuilder()
                .setCustomId(`ignore_${message.author.id}_${message.id}`)
                .setLabel('ignore')
                .setStyle(ButtonStyle.Secondary) // Grey button
            );
          
          await logChannel.send({ 
            embeds: [embed],
            components: [row]
          });
        } else {
          // No buttons for simple rule violations
          await logChannel.send({ 
            embeds: [embed]
          });
        }
        
        console.log(`📝 Logged: ${message.author.username} - ${result.reasons[0]}`);
      }
      
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
      await member.ban({ reason: `Auto-mod: ${embedData.description?.split('reason: ')[1]?.split(' |')[0] || 'Suspicious content'}` });
      
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
    uptime: process.uptime(),
    rules: `Channel ${SPECIFIC_CHANNEL_ID}: Age + Attachments required`
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
