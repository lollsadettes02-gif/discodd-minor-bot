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
  
  // Check for underage (ONLY 1-17)
  const ageMatch = content.match(/\b(1[0-7])\s*(?:m|f|male|female|yo|years?)?\b/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    if (age < 18) {
      redFlags.push('underage');
      detectedAge = age;
    }
  }
  
  // Reversal symbols
  if (/[🔄↩↪]/.test(content)) {
    redFlags.push('reversal symbols');
  }
  
  // Seeking older
  if (/looking for.*(?:older|daddy|mature)/i.test(content)) {
    redFlags.push('seeking older');
  }
  
  // DMs open with underage
  if (/dms? open.*\b(1[0-7])\b/i.test(content)) {
    redFlags.push('dms open');
  }
  
  // Suspicious high age (50+)
  if (/(5[0-9]|6[0-9]|7[0-9])\s*(?:m|f)/i.test(content)) {
    redFlags.push('suspiciously high age');
  }
  
  return {
    isBad: redFlags.length > 0,
    reasons: redFlags,
    age: detectedAge,
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
        
        // Create age display if found
        const ageDisplay = result.age ? `${result.age} ` : '';
        const emojiDisplay = result.age ? '❤️' : '';
        
        // Create embed EXACTLY like your example
        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setDescription(
            `**APP**\n` +
            `**${dateString}**\n\n` +
            `**${message.author.username}**\n` +
            `${ageDisplay}${emojiDisplay}\n` +
            `\`id: ${message.author.id} | reason: ${result.reasons[0] || 'suspicious content'} |\`\n` +
            `\`${dateString}\`\n\n` +
            `✅ ban • ⚠️ ignore`
          )
          .setFooter({ 
            text: `ignored by @so? (edited)`
          });
        
        // Create buttons
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
        
        // Send embed with buttons
        const logMessage = await logChannel.send({ 
          embeds: [embed],
          components: [row]
        });
        
        // Add reactions
        await logMessage.react('✅');
        await logMessage.react('⚠️');
        
        console.log(`📝 Logged: ${message.author.username}`);
      }
      
    } catch (error) {
      console.log('⚠️ Error:', error.message);
    }
  }
});

// Handle button clicks
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const [action, userId] = interaction.customId.split('_');
  
  if (action === 'ban') {
    try {
      const member = await interaction.guild.members.fetch(userId);
      await member.ban({ reason: 'Auto-mod: Underage' });
      await interaction.reply({ content: `✅ Banned ${member.user.tag}`, ephemeral: true });
      
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: `banned by ${interaction.user.tag}` });
      await interaction.message.edit({ embeds: [embed], components: [] });
      
    } catch (error) {
      await interaction.reply({ content: '❌ Could not ban', ephemeral: true });
    }
  }
  
  if (action === 'ignore') {
    await interaction.reply({ content: '⚠️ Ignored', ephemeral: true });
    
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFooter({ text: `ignored by ${interaction.user.tag}` });
    await interaction.message.edit({ embeds: [embed], components: [] });
  }
});

// Handle reactions
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.message.channel.id !== LOG_CHANNEL_ID) return;
  
  const embed = reaction.message.embeds[0];
  if (!embed) return;
  
  const idMatch = embed.description?.match(/id:\s*(\d+)/);
  if (!idMatch) return;
  
  const userId = idMatch[1];
  
  if (reaction.emoji.name === '✅') {
    try {
      const member = await reaction.message.guild.members.fetch(userId);
      await member.ban({ reason: 'Reaction ban' });
      
      const updatedEmbed = EmbedBuilder.from(embed)
        .setFooter({ text: `banned by ${user.tag}` });
      await reaction.message.edit({ embeds: [updatedEmbed], components: [] });
      
    } catch (error) {
      console.log('Ban error:', error.message);
    }
  }
  
  if (reaction.emoji.name === '⚠️') {
    const updatedEmbed = EmbedBuilder.from(embed)
      .setFooter({ text: `ignored by ${user.tag}` });
    await reaction.message.edit({ embeds: [updatedEmbed], components: [] });
  }
  
  await reaction.users.remove(user.id);
});

// Health check
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.json({ status: 'online', bot: client.user?.tag || 'Starting...' });
});

app.listen(PORT, () => {
  console.log(`🌐 Health check: http://localhost:${PORT}`);
});

// Login
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('❌ Login failed:', error.message);
  process.exit(1);
});
