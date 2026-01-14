const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const axios = require('axios');

const TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = '1447204367089270874';
const VANITY = 'playmate';
const CHECK_EVERY = 2000;

const rest = new REST({ version: '10' }).setToken(TOKEN);

console.log('🔥 PLAYMATE SNIPER STARTING...');
console.log(`🎯 Target: ${VANITY}`);
console.log(`🏠 Server: ${GUILD_ID}`);

let checks = 0;
let lastLog = Date.now();

async function checkVanity() {
    try {
        await axios.get(`https://discord.com/api/v10/invites/${VANITY}`, {
            headers: { 'Authorization': `Bot ${TOKEN}` },
            timeout: 3000
        });
        return false;
    } catch (err) {
        if (err.response?.status === 404) return true;
        return false;
    }
}

async function claimVanity() {
    try {
        console.log(`🚀 ATTEMPTING TO CLAIM: ${VANITY}`);
        
        // FIXED: Use correct route
        await rest.patch(
            Routes.guild(GUILD_ID), // THIS IS THE FIX
            { 
                body: { code: VANITY },
                headers: { 'Content-Type': 'application/json' }
            }
        );
        
        console.log(`✅ SUCCESS! https://discord.gg/${VANITY}`);
        console.log('👁️ Still monitoring in case it gets stolen...');
        
        // Optional: Add webhook notification here
        // await sendDiscordNotification();
        
    } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
        console.log(`Error code: ${err.code}`);
        console.log(`Error details:`, err.rawError || 'No details');
    }
}

setInterval(async () => {
    checks++;
    
    if (Date.now() - lastLog > 30000) {
        console.log(`[${new Date().toLocaleTimeString()}] Still alive (${checks} checks)`);
        lastLog = Date.now();
    }
    
    if (await checkVanity()) {
        console.log(`🚨 ${VANITY} IS FREE!`);
        await claimVanity();
    }
}, CHECK_EVERY);

console.log('✅ Sniper running. Waiting...');

// Keep process alive
process.on('uncaughtException', (err) => {
    console.log('Uncaught error:', err.message);
});
process.on('unhandledRejection', (err) => {
    console.log('Unhandled rejection:', err.message);
});
