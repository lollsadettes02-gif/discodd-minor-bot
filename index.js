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

// CERCA MINORI ESPLICITI
function findMinor(text) {
  const lower = text.toLowerCase();
  
  // Pattern 1: "17 looking for" o "15 top" etc
  const minorPattern = /\b(1[0-7])\s+(?:looking|top|bottom|verse|dm|dms|m|f|male|female|yo|years?)\b/i;
  const match = text.match(minorPattern);
  if (match) {
    return parseInt(match[1]);
  }
  
  // Pattern 2: Numero all'inizio seguito da contesto sessuale
  const startPattern = /^(1[0-7])\s+.*(?:looking|top|bottom|verse|dm|dms)/i;
  const startMatch = text.match(startPattern);
  if (startMatch) {
    return parseInt(startMatch[1]);
  }
  
  return null;
}

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  client.user.setActivity('checking ages ⚠️', { type: 'WATCHING' });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== YOUR_SERVER_ID) return;
  
  const minorAge = findMinor(message.content);
  const hasAttachments = message.attachments.size > 0;
  
  // REGOLE CANALE SPECIFICO
  if (message.channel.id === SPECIFIC_CHANNEL_ID) {
    // Cerca qualsiasi numero come età per il canale specifico
    const anyAgeMatch = message.content.match(/\b(\d{1,2})\s+(?:top|bottom|verse|dm|dms|looking|m|f)\b/i);
    const hasAge = anyAgeMatch !== null;
    
    if (!hasAge || !hasAttachments) {
      try {
        await message.delete();
        console.log(`🗑️ Deleted in specific channel: ${message.author.tag}`);
      } catch (e) {}
    }
    return;
  }
  
  // SOLO SE TROVA MINORE ESPLICITO (1-17 con contesto)
  if (minorAge !== null) {
    try {
      await message.delete();
      console.log(`🚨 Minor detected: ${message.author.tag} (${minorAge})`);
      
      // LOGGA SOLO MINORI ESPLICITI
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
            `\`id: ${message.author.id} | reason: underage (${minorAge}) |\`\n` +
            `\`Today at ${timeString}\`\n\n` +
            `**Message:**\n${message.content.substring(0, 500)}\n\n` +
            `✅ ban • ⚠️ ignore`
          )
          .setFooter({ text: `pending action` });
        
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`ban_${message.author.id}`)
              .setLabel('ban')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`ignore_${message.author.id}`)
              .setLabel('ignore')
              .setStyle(ButtonStyle.Secondary)
          );
        
        await logChannel.send({ 
          embeds: [embed],
          components: [row]
        });
      }
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
});

// GESTISCI BOTTONI
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const [action, userId] = interaction.customId.split('_');
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
  
  if (action === 'ban') {
    try {
      await interaction.guild.members.ban(userId, { reason: 'Minor' });
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: `banned by @${interaction.user.username} • Today at ${timeString}` });
      await interaction.message.edit({ embeds: [embed], components: [] });
      await interaction.reply({ content: `✅ Banned`, ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `❌ Error`, ephemeral: true });
    }
  }
  
  if (action === 'ignore') {
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFooter({ text: `ignored by @${interaction.user.username} • Today at ${timeString}` });
    await interaction.message.edit({ embeds: [embed], components: [] });
    await interaction.reply({ content: `⚠️ Ignored`, ephemeral: true });
  }
});

// HEALTH CHECK
const app = express();
app.get('/', (req, res) => res.json({ status: 'online', bot: client.user?.tag || 'Starting...' }));
app.listen(process.env.PORT || 10000);

// LOGIN
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('❌ Login failed:', error.message);
  process.exit(1);
});
