const axios = require('axios');

const TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = '1447204367089270874';
const VANITY = 'playmate';
const CHECK_EVERY = 1000; // 1 second

console.log('🚨 ULTIMATE SNIPER ACTIVATED');
console.log(`🎯 Target: ${VANITY}`);
console.log(`🏠 Server: ${GUILD_ID}`);

let checks = 0;
let isClaiming = false;

async function checkVanity() {
    try {
        await axios.get(`https://discord.com/api/v10/invites/${VANITY}`, {
            headers: { 'Authorization': `Bot ${TOKEN}` },
            timeout: 2000
        });
        return false; // 200 = taken
    } catch (err) {
        if (err.response?.status === 404) return true; // 404 = FREE
        return false;
    }
}

async function claimVanity() {
    if (isClaiming) return;
    isClaiming = true;
    
    console.log(`🚨🚨🚨 ${VANITY} IS FREE! CLAIMING NOW...`);
    
    try {
        const response = await axios.patch(
            `https://discord.com/api/v10/guilds/${GUILD_ID}/vanity-url`,
            { code: VANITY },
            {
                headers: {
                    'Authorization': `Bot ${TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`✅✅✅ SUCCESS! CLAIMED: ${VANITY}`);
        console.log(`🔗 https://discord.gg/${VANITY}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        // Don't exit - keep monitoring
        isClaiming = false;
        
    } catch (error) {
        console.log('❌ CLAIM FAILED!');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data || error.message);
        
        // SPECIFIC ERRORS:
        if (error.response?.data?.code === 50024) {
            console.log('❌❌❌ SERVER MUST BE LEVEL 3!');
            console.log('Need 500+ members and 7+ days old');
        }
        if (error.response?.data?.code === 30018) {
            console.log('⚠️ Vanity already taken (too slow)');
        }
        if (error.response?.data?.code === 50013) {
            console.log('⚠️ Bot needs MANAGE_GUILD permission');
        }
        
        isClaiming = false;
    }
}

// MAIN LOOP
setInterval(async () => {
    checks++;
    
    // Log every 10 seconds
    if (checks % 10 === 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Checks: ${checks}`);
    }
    
    const isFree = await checkVanity();
    
    if (isFree && !isClaiming) {
        console.log(`🎯 DETECTED FREE: ${VANITY}`);
        await claimVanity();
    }
}, CHECK_EVERY);

console.log('✅ Sniper active. Waiting for playmate...');

// Add express for Render health check
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: 'sniping',
        target: VANITY,
        checks: checks,
        isClaiming: isClaiming
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Health check on port ${PORT}`);
});
