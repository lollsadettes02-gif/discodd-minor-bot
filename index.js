const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const axios = require('axios');

const TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = '1447204367089270874';
const VANITY = 'playmate';
const CHECK_EVERY = 2000; // 2 seconds

const rest = new REST({ version: '10' }).setToken(TOKEN);

let checks = 0;
let lastLog = Date.now();

console.log(`🔥 PLAYMATE SNIPER ACTIVATED`);
console.log(`🎯 Target: ${VANITY}`);
console.log(`🏠 Server: ${GUILD_ID}`);
console.log(`⏱️ Checking every ${CHECK_EVERY}ms`);
console.log(`================================`);

async function checkVanity() {
    try {
        const res = await axios.get(`https://discord.com/api/v10/invites/${VANITY}`, {
            headers: { 'Authorization': `Bot ${TOKEN}` },
            timeout: 3000
        });
        return false; // 200 = taken
    } catch (err) {
        if (err.response?.status === 404) {
            return true; // 404 = available
        }
        return false;
    }
}

async function claimVanity() {
    try {
        console.log(`🚀 ATTEMPTING TO CLAIM: ${VANITY}`);
        
        await rest.patch(
            Routes.guildVanityURL(GUILD_ID),
            { body: { code: VANITY } }
        );
        
        console.log(`✅ FUCKING SUCCESS! CLAIMED: ${VANITY}`);
        console.log(`🔗 https://discord.gg/${VANITY}`);
        
        // Keep running in case it gets stolen
        console.log(`👁️ Continuing to monitor...`);
        
    } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
        
        // If already taken, keep trying
        if (err.code === 30018 || err.message.includes('already')) {
            console.log(`🔄 Vanity taken, continuing monitor...`);
        }
    }
}

// MAIN LOOP
setInterval(async () => {
    checks++;
    
    // Log every 30 seconds
    if (Date.now() - lastLog > 30000) {
        console.log(`[${new Date().toLocaleTimeString()}] Still monitoring... (${checks} checks)`);
        lastLog = Date.now();
    }
    
    const available = await checkVanity();
    
    if (available) {
        console.log(`🚨 ${VANITY} IS FREE! CLAIMING NOW!`);
        await claimVanity();
    }
}, CHECK_EVERY);

// Keep alive
process.on('uncaughtException', (err) => {
    console.log(`Error: ${err.message}`);
    // Don't crash, keep running
});

console.log(`✅ Sniper running. Waiting for ${VANITY} to free up...`);
