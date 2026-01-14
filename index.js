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

// Whitelisted channels or commands (optional)
const ALLOWED_CHANNELS = []; // Add channel IDs that don't need age
const ALLOWED_COMMANDS = ['!help', '!rules', '!age'];

function checkMessage(content) {
  const redFlags = [];
  let detectedAge = null;
  let ageInMessage = false;
  
  const cleanContent = content.toLowerCase();
  
  // ====== CHECK 1: MUST INCLUDE AGE ======
  const agePatterns = [
    /\b(\d{1,2})\s*(?:m|f|male|female)\b/i,      // "19m", "21f"
    /\b(\d{1,2})\s*(?:yo|y\.o\.)\b/i,            // "19yo", "21 y.o."
    /\b(\d{1,2})\s*(?:years?|yrs?)\s*old\b/i,    // "19 years old"
    /\b(\d{1,2})\s*(?:years?|yrs?)\b/i,          // "19 years"
    /\bage\s*(\d{1,2})\b/i,                      // "age 19"
    /\b(\d{1,2})\s*\/\s*[mf]\b/i,                // "19/m"
    /\b[MF]\s*\/\s*(\d{1,2})\b/i,                // "M/19"
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
  
  // If NO age found in message
  if (!ageInMessage) {
    redFlags.push('no age provided');
  }
  
  // ====== CHECK 2: AGE VALIDATION ======
  if (detectedAge !== null) {
    if (detectedAge < 18) {
      redFlags.push(`underage (${detectedAge})`);
    } else if (detectedAge > 50) {
      redFlags.push(`suspicious age (${detectedAge})`);
    }
  }
  
  // ====== CHECK 3: OTHER RED FLAGS ======
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
    score: redFlags.length * 30
  };
}

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  client.user.setActivity('checking ages ⚠️', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== YOUR_SERVER_ID) return;
  
  // Check if in allowed channel
  if (ALLOWED_CHANNELS.includes(message.channel.id)) return;
  
  // Check if it's an allowed command
  const isCommand = ALLOWED_COMMANDS.some(cmd => 
    message.content.toLowerCase().startsWith(cmd)
  );
  if (isCommand) return;
  
  const result = checkMessage(message.content);
  
  if (result.isBad) {
    try {
      await message.delete();
      console.log(`🗑️ Deleted from ${message.author.tag} - ${result.reasons[0]}`);
      
      // Send warning to user if no age provided
      if (result.noAgeProvided) {
        try {
          await message.author.send(
            `⚠️ **Your message in ${message.guild.name} was deleted.**\n` +
            `**Reason:** You must include your age in your message (e.g., "19m looking for...", "21 femboy", etc.)\n` +
            `**Examples:** "19m looking for friends", "21 femboy top", "25 M verse"\n` +
            `Please include your age and gender in your next message.`
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
        
        // Determine embed color based on severity
        let embedColor = '#2b2d31'; // Default gray
        if (result.reasons.includes('underage')) {
          embedColor = '#ff0000'; // Red for underage
        } else if (result.noAgeProvided) {
          embedColor = '#ff9900'; // Orange for no age
        }
        
        // Create the embed
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setDescription(
            `**APP**\n` +
            `**${dateString}**\n\n` +
            `**${message.author.username}**\n` +
            `\`id: ${message.author.id} | reason: ${result.reasons[0] || 'no age provided'} |\`\n` +
            `\`${dateString}\`\n\n` +
            `**Message:**\n${truncatedMessage}\n\n` +
            `✅ ban • ⚠️ ignore`
          )
          .setFooter({ 
            text: `pending action` 
          });
        
        // Only add ban/ignore buttons if underage or suspicious
        const shouldShowButtons = result.reasons.some(r => 
          r.includes('underage') || r.includes('suspicious')
        );
        
        if (shouldShowButtons) {
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`ban_${message.author.id}_${message.id}`)
                .setLabel('ban')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✅'),
              new ButtonBuilder()
                .setCustomId(`ignore_${message.author.id}_${message.id}`)
                .setLabel('ignore')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⚠️')
            );
          
          await logChannel.send({ 
            embeds: [embed],
            components: [row]
          });
        } else {
          // For "no age provided", just log without buttons
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

// Handle button clicks (same as before)
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
    rule: 'Age required in all messages'
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
