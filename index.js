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

function checkMessage(content) {
  const redFlags = [];
  let detectedAge = null;
  
  const cleanContent = content.toLowerCase();
  
  // 1. Underage with context
  const underageMatch = cleanContent.match(/\b(1[0-7])\s*(?:m|f|male|female|yo|yrs?|years?|y\.o\.|age)\b/);
  if (underageMatch) {
    const age = parseInt(underageMatch[1]);
    redFlags.push(`underage (${age})`);
    detectedAge = age;
  }
  
  // 2. Reversal symbols
  if (/[🔄↩↪]/.test(content)) {
    redFlags.push('reversal symbols');
  }
  
  // 3. "dm" + number (suspicious)
  const dmPattern = cleanContent.match(/(\d{1,2})\s*dm\b|\bdm\s*(\d{1,2})\b/);
  if (dmPattern) {
    redFlags.push('dm with age');
  }
  
  // 4. "looking for older"
  if (/looking for.*(?:older|daddy|mature)/i.test(content)) {
    redFlags.push('seeking older');
  }
  
  // 5. Suspicious high age (40+)
  if (/([4-9][0-9]|100)\s*(?:m|f)/i.test(content)) {
    redFlags.push('suspicious age');
  }
  
  // 6. DMs open + number
  if (/dms? open/i.test(cleanContent) && /\b\d{1,2}\b/.test(cleanContent)) {
    redFlags.push('dms open');
  }
  
  return {
    isBad: redFlags.length > 0,
    reasons: redFlags,
    age: detectedAge,
    originalMessage: content,
    score: redFlags.length * 30
  };
}

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  client.user.setActivity('for minors ⚠️', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== YOUR_SERVER_ID) return;
  
  const result = checkMessage(message.content);
  
  if (result.isBad) {
    try {
      await message.delete();
      console.log(`🗑️ Deleted from ${message.author.tag}`);
      
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
        
        // Create the embed WITH ORIGINAL MESSAGE
        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setDescription(
            `**APP**\n` +
            `**${dateString}**\n\n` +
            `**${message.author.username}**\n` +
            `\`id: ${message.author.id} | reason: ${result.reasons[0] || 'suspicious content'} |\`\n` +
            `\`${dateString}\`\n\n` +
            `**Message:**\n${truncatedMessage}\n\n` +
            `✅ ban • ⚠️ ignore`
          )
          .setFooter({ 
            text: `pending action` // Shows it's waiting for action
          });
        
        // Create buttons
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
        
        // Send embed with buttons
        await logChannel.send({ 
          embeds: [embed],
          components: [row]
        });
        
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
  
  // Get original embed data
  const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
  const embedData = originalEmbed.data;
  
  if (action === 'ban') {
    try {
      // Try to ban the user
      const member = await interaction.guild.members.fetch(userId);
      await member.ban({ reason: `Auto-mod: ${embedData.description?.split('reason: ')[1]?.split(' |')[0] || 'Suspicious content'}` });
      
      // Update embed to show BANNED status with timestamp
      const updatedEmbed = new EmbedBuilder()
        .setColor('#ff0000') // Red for ban
        .setDescription(embedData.description)
        .setFooter({ 
          text: `banned by @${interaction.user.username} • ${actionDate} at ${actionTime}` 
        });
      
      // Edit original message to remove buttons and show action
      await interaction.message.edit({ 
        embeds: [updatedEmbed],
        components: [] // Remove buttons
      });
      
      // Send confirmation (ephemeral - only moderator sees)
      await interaction.reply({ 
        content: `✅ Banned ${member.user.tag}`, 
        ephemeral: true 
      });
      
      console.log(`🔨 Banned ${member.user.tag} by ${interaction.user.tag}`);
      
    } catch (error) {
      console.log('Ban error:', error.message);
      
      // Still update embed to show attempted action
      const failedEmbed = new EmbedBuilder()
        .setColor('#ff9900') // Orange/yellow for failed
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
    // Update embed to show IGNORED status with timestamp
    const updatedEmbed = new EmbedBuilder()
      .setColor('#808080') // Grey for ignore
      .setDescription(embedData.description)
      .setFooter({ 
        text: `ignored by @${interaction.user.username} • ${actionDate} at ${actionTime}` 
      });
    
    // Edit original message to remove buttons and show action
    await interaction.message.edit({ 
      embeds: [updatedEmbed],
      components: [] // Remove buttons
    });
    
    // Send confirmation
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
