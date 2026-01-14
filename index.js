const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

console.log('🚀 Bot starting...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const YOUR_SERVER_ID = '1447204367089270874';
const LOG_CHANNEL_ID = '1457870506505011331';
const SPECIFIC_CHANNEL_ID = '1447208095217619055';

// === CERCA ETÀ ===
function findAge(text) {
  const lower = text.toLowerCase();
  // Cerca numeri 1-99 seguiti da parole chiave
  const matches = lower.match(/\b(\d{1,2})\s+(top|bottom|verse|dom|sub|masc|femboy|dm|dms|looking|send|age|m|f|male|female)\b/);
  if (matches) return parseInt(matches[1]);
  
  // Cerca numeri all'inizio
  const startMatch = lower.match(/^(\d{1,2})\s+/);
  if (startMatch) return parseInt(startMatch[1]);
  
  return null;
}

// === CONTROLLA MESSAGGIO ===
function checkMessage(content, attachments, channelId) {
  const age = findAge(content);
  
  // === SOLO PER MINORI (1-17) ===
  if (age !== null && age < 18) {
    return {
      shouldDelete: true,
      shouldLog: true,
      reason: `underage (${age})`,
      age: age
    };
  }
  
  // === REGOLE CANALE SPECIFICO ===
  if (channelId === SPECIFIC_CHANNEL_ID) {
    const hasAge = age !== null;
    const hasAttachments = attachments.size > 0;
    const hasValidAttachments = hasAttachments && 
      Array.from(attachments.values()).every(att => 
        att.url.includes('cdn.discordapp.com') || 
        att.url.includes('media.discordapp.net')
      );
    
    if (!hasAge || !hasValidAttachments) {
      return {
        shouldDelete: true,
        shouldLog: false, // NO LOG PER REGOLE CANALE
        reason: hasAge ? 'no attachments' : 'no age',
        age: age
      };
    }
  }
  
  return { shouldDelete: false, shouldLog: false, reason: null, age: age };
}

// === BOT READY ===
client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  client.user.setActivity('checking ages ⚠️', { type: 'WATCHING' });
});

// === GESTIONE MESSAGGI ===
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== YOUR_SERVER_ID) return;
  
  const result = checkMessage(message.content, message.attachments, message.channel.id);
  
  if (result.shouldDelete) {
    try {
      await message.delete();
      console.log(`🗑️ Deleted: ${message.author.tag} - ${result.reason}`);
      
      // === LOGGA SOLO SE MINORE ===
      if (result.shouldLog) {
        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          const now = new Date();
          const timeString = now.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          }).toLowerCase();
          
          const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setDescription(
              `**APP**\n` +
              `**Today at ${timeString}**\n\n` +
              `**${message.author.username}**\n` +
              `\`id: ${message.author.id} | reason: ${result.reason} |\`\n` +
              `\`Today at ${timeString}\`\n\n` +
              `**Message:**\n${message.content.substring(0, 500)}\n\n` +
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
          
          console.log(`📝 Logged minor: ${message.author.username} (${result.age})`);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Error:', error.message);
    }
  }
});

// === GESTIONE BOTTONI ===
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const [action, userId] = interaction.customId.split('_');
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
  
  const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
  
  if (action === 'ban') {
    try {
      const member = await interaction.guild.members.fetch(userId);
      await member.ban({ reason: 'Minor detected' });
      
      const updatedEmbed = EmbedBuilder.from(originalEmbed)
        .setFooter({ text: `banned by @${interaction.user.username} • Today at ${timeString}` });
      
      await interaction.message.edit({ 
        embeds: [updatedEmbed],
        components: []
      });
      
      await interaction.reply({ content: `✅ Banned`, ephemeral: true });
      
    } catch (error) {
      console.log('Ban error:', error.message);
    }
  }
  
  if (action === 'ignore') {
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setFooter({ text: `ignored by @${interaction.user.username} • Today at ${timeString}` });
    
    await interaction.message.edit({ 
      embeds: [updatedEmbed],
      components: []
    });
    
    await interaction.reply({ content: `⚠️ Ignored`, ephemeral: true });
  }
});

// === HEALTH CHECK ===
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

// === LOGIN ===
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('❌ Login failed:', error.message);
  process.exit(1);
});
