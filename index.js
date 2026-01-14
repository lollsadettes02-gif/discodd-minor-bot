// SIMPLE DISCORD BOT FOR MOBILE DEPLOYMENT
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

console.log('🚀 Bot starting...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Your server ID
const YOUR_SERVER_ID = '1447204367089270874';
const LOG_CHANNEL_ID = '1457870506505011331';

// Simple detector
function checkMessage(content) {
  const warnings = [];
  
  // Check for underage (under 18)
  const ageMatch = content.match(/\b(1[0-7])\s*(m|f|yo|years?)\b/i);
  if (ageMatch) {
    warnings.push(`UNDERAGE (${ageMatch[1]})`);
  }
  
  // Check reversal symbols
  if (/[🔄↩↪]/.test(content)) {
    warnings.push('REVERSAL SYMBOL');
  }
  
  // Check "looking for older"
  if (/looking for.*(older|daddy)/i.test(content)) {
    warnings.push('SEEKING OLDER');
  }
  
  // Check "dms open"
  if (/dms? open/i.test(content)) {
    warnings.push('DMS OPEN');
  }
  
  // Check suspicious age (50+)
  if (/(5[0-9]|6[0-9])\s*(m|f)/i.test(content)) {
    warnings.push('SUSPICIOUS AGE');
  }
  
  return {
    isBad: warnings.length > 0,
    warnings,
    score: warnings.length * 30
  };
}

// When bot is ready
client.once('ready', () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
  console.log(`✅ Server: ${YOUR_SERVER_ID}`);
  console.log(`✅ Log channel: ${LOG_CHANNEL_ID}`);
  
  client.user.setActivity('for minors ⚠️', { type: 'WATCHING' });
});

// Check every message
client.on('messageCreate', async (message) => {
  // Ignore bots and DMs
  if (message.author.bot) return;
  if (!message.guild) return;
  
  // Only check your server
  if (message.guild.id !== YOUR_SERVER_ID) return;
  
  const check = checkMessage(message.content);
  
  if (check.isBad) {
    try {
      // Delete the message
      await message.delete();
      console.log(`🗑️ Deleted message from ${message.author.tag}`);
      
      // Send to log channel
      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('🚨 Minor Detected')
          .setDescription(`**User:** ${message.author.tag}\n**Score:** ${check.score}/100`)
          .addFields(
            { name: 'Reasons', value: check.warnings.join('\n') },
            { name: 'Message', value: message.content.substring(0, 1000) }
          )
          .setTimestamp();
        
        await logChannel.send({ embeds: [embed] });
        console.log(`📝 Logged to channel ${LOG_CHANNEL_ID}`);
      }
      
    } catch (error) {
      console.log('⚠️ Error:', error.message);
    }
  }
});

// Login with token from Railway
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('❌ Login failed:', error.message);
});

// Simple health check
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`🌐 Health check on port ${PORT}`);
});
