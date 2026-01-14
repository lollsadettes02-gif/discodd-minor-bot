const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');

console.log('🚀 Bot starting...');

// ============ CONFIGURAZIONE FIXATA ============
const CONFIG = {
  SERVER_ID: '1447204367089270874',
  LOG_CHANNEL_ID: '1457870506505011331',
  SPECIFIC_CHANNEL_ID: '1447208095217619055',
  
  // Pattern FIXED: solo quelli necessari
  AGE_CONTEXT_KEYWORDS: ['top', 'bottom', 'verse', 'dm', 'dms', 'looking', 'm', 'f', 'male', 'female'],
  
  // Messaggi FIXED
  DELETE_MESSAGES: {
    SPECIFIC_CHANNEL: '🗑️ Messaggio cancellato nel canale specifico',
    MINOR_DETECTED: '🚨 Minore rilevato'
  }
};

// ============ FUNZIONI DI UTILITÀ ============
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toLowerCase();
}

// ============ RILEVAMENTO MINORI FIXED ============
function detectMinorContent(text) {
  const lower = text.toLowerCase();
  
  // SOLO pattern CHIARI di minori (1-17)
  const patterns = [
    // "17 looking for friends", "16 top", "15 dm me"
    /\b(1[0-7])\s+(looking|top|bottom|verse|dm|dms)\b/i,
    
    // "looking for 16", "want 15"
    /\b(looking|want|seeking)\s+(?:for\s+)?(1[0-7])\b/i,
    
    // "16m" o "17f" (compatti)
    /\b(1[0-7])\s*[mf]\b/i,
    
    // "15 yo" "16 years"
    /\b(1[0-7])\s+(?:yo|years?|yrs?|y\/o)\b/i,
  ];
  
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const age = parseInt(match[1] || match[2]);
      return {
        age: age,
        type: 'MINOR_DETECTED',
        match: match[0]
      };
    }
  }
  
  return null;
}

// ============ CONTROLLO CANALE SPECIFICO FIXED ============
function checkSpecificChannelRules(text, attachments) {
  const lower = text.toLowerCase();
  
  // Cerca età 1-99 con contesto (per canale specifico)
  const ageMatch = lower.match(/\b(\d{1,2})\s+(top|bottom|verse|dm|dms|looking|m|f)\b/i);
  const hasAge = ageMatch !== null;
  
  // Controlla se ci sono attachment validi (solo Discord CDN)
  const hasAttachments = attachments.size > 0;
  const hasValidAttachments = hasAttachments && 
    Array.from(attachments.values()).every(att => 
      att.url.includes('cdn.discordapp.com') || 
      att.url.includes('media.discordapp.net')
    );
  
  return {
    shouldDelete: !hasAge || !hasValidAttachments,
    reason: !hasAge ? 'no_age' : 'no_attachments',
    detectedAge: hasAge ? parseInt(ageMatch[1]) : null
  };
}

// ============ CLIENT DISCORD ============
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// ============ EVENTI FIXED ============
client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
  client.user.setActivity('monitoring ages ⚠️', { type: 'WATCHING' });
  client.user.setStatus('dnd');
});

client.on('messageCreate', async (message) => {
  // Validazioni iniziali
  if (message.author.bot) return;
  if (!message.guild || message.guild.id !== CONFIG.SERVER_ID) return;
  
  try {
    // ===== GESTIONE CANALE SPECIFICO =====
    if (message.channel.id === CONFIG.SPECIFIC_CHANNEL_ID) {
      const check = checkSpecificChannelRules(message.content, message.attachments);
      
      if (check.shouldDelete) {
        await message.delete().catch(() => {});
        console.log(`${CONFIG.DELETE_MESSAGES.SPECIFIC_CHANNEL}: ${message.author.tag} - ${check.reason}`);
      }
      return;
    }
    
    // ===== RILEVAMENTO MINORI ESPLICITI =====
    const minorDetection = detectMinorContent(message.content);
    
    if (minorDetection) {
      await handleMinorDetection(message, minorDetection);
    }
    
  } catch (error) {
    console.error('❌ Errore elaborazione messaggio:', error.message);
  }
});

// ============ GESTIONE MINORI RILEVATI FIXED ============
async function handleMinorDetection(message, detection) {
  try {
    await message.delete();
    
    console.log(`${CONFIG.DELETE_MESSAGES.MINOR_DETECTED}: ${message.author.tag} (${detection.age})`);
    
    // Invia log al canale dedicato
    const logChannel = message.guild.channels.cache.get(CONFIG.LOG_CHANNEL_ID);
    if (!logChannel) {
      console.warn('⚠️ Canale di log non trovato');
      return;
    }
    
    const timeString = getCurrentTime();
    const embed = createMinorEmbed(message, detection, timeString);
    const actionRow = createActionRow(message.author.id);
    
    await logChannel.send({ 
      embeds: [embed],
      components: [actionRow]
    });
    
  } catch (error) {
    console.error('❌ Errore gestione minore:', error.message);
  }
}

function createMinorEmbed(message, detection, timeString) {
  const truncatedContent = message.content.length > 500 
    ? message.content.substring(0, 497) + '...' 
    : message.content;
  
  return new EmbedBuilder()
    .setColor('#2b2d31')
    .setDescription(
      `**APP**\n` +
      `**Today at ${timeString}**\n\n` +
      `**${message.author.username}**\n` +
      `\`id: ${message.author.id} | reason: underage (${detection.age}) |\`\n` +
      `\`Today at ${timeString}\`\n\n` +
      `**Message:**\n${truncatedContent}\n\n` +
      `✅ ban • ⚠️ ignore`
    )
    .setFooter({ 
      text: `pending action` 
    })
    .setTimestamp();
}

function createActionRow(userId) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`ban_${userId}`)
        .setLabel('ban')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`ignore_${userId}`)
        .setLabel('ignore')
        .setStyle(ButtonStyle.Secondary)
    );
}

// ============ GESTIONE INTERAZIONI FIXED ============
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  
  const [action, userId] = interaction.customId.split('_');
  const timeString = getCurrentTime();
  
  try {
    if (action === 'ban') {
      await handleBan(interaction, userId, timeString);
    } else if (action === 'ignore') {
      await handleIgnore(interaction, userId, timeString);
    }
    
  } catch (error) {
    console.error('❌ Errore gestione interazione:', error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: '❌ Errore', ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Errore', ephemeral: true });
    }
  }
});

async function handleBan(interaction, userId, timeString) {
  try {
    await interaction.guild.members.ban(userId, { 
      reason: `Minor detected (${timeString})` 
    });
    
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setFooter({ 
        text: `banned by @${interaction.user.username} • Today at ${timeString}` 
      });
    
    await interaction.message.edit({ 
      embeds: [embed], 
      components: [] 
    });
    
    await interaction.reply({ 
      content: '✅ User banned', 
      ephemeral: true 
    });
    
  } catch (error) {
    await interaction.reply({ 
      content: '❌ Cannot ban user', 
      ephemeral: true 
    });
  }
}

async function handleIgnore(interaction, userId, timeString) {
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setFooter({ 
      text: `ignored by @${interaction.user.username} • Today at ${timeString}` 
    });
  
  await interaction.message.edit({ 
    embeds: [embed], 
    components: [] 
  });
  
  await interaction.reply({ 
    content: '⚠️ User ignored', 
    ephemeral: true 
  });
}

// ============ SERVER WEB PER HEALTH CHECK ============
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    bot: client.user?.tag || 'Starting...',
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Health check: http://localhost:${PORT}`);
});

// ============ LOGIN ============
client.login(process.env.BOT_TOKEN).catch(error => {
  console.error('❌ Login failed:', error.message);
  process.exit(1);
});
