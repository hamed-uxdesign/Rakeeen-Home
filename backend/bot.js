import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import express from 'express';
import { parseSMS } from './smsParser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SUBS_FILE = path.join(__dirname, 'subscriptions.json');

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHANNEL_ID = '1501292671753523371';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'PUT_YOUR_BOT_TOKEN_HERE';
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';

async function sendWebhookMessage(content) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('⚠️ No DISCORD_WEBHOOK_URL configured. Skipping Discord alert.');
    return;
  }
  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error('❌ Failed to send Discord webhook message:', e.message);
  }
}

// Mocking Calendar Data (This will be replaced by your actual database/calendar integration later)
// Assume we fetch this daily to know when to stop and start
const MOCK_CALENDAR_TODAY = {
  wakeUpTime: '11:00', // 24-hour format
  sleepTime: '05:00'   // 5:00 AM
};

/**
 * Helper to check if current time is within the "Do Not Disturb" window
 * DND Window: 3 hours before sleepTime UNTIL 2 hours after wakeUpTime
 */
function isDoNotDisturb(currentTime) {
  const [sleepHour, sleepMin] = MOCK_CALENDAR_TODAY.sleepTime.split(':').map(Number);
  const [wakeHour, wakeMin] = MOCK_CALENDAR_TODAY.wakeUpTime.split(':').map(Number);

  const currentHour = currentTime.getHours();
  
  // Calculate DND start (3 hours before sleep)
  let dndStartHour = sleepHour - 3;
  if (dndStartHour < 0) dndStartHour += 24;

  // Calculate DND end (2 hours after wake)
  let dndEndHour = wakeHour + 2;
  if (dndEndHour >= 24) dndEndHour -= 24;

  // Check if current hour falls inside DND window
  if (dndStartHour < dndEndHour) {
    // e.g. DND is 19:00 to 23:00 (not crossing midnight)
    return currentHour >= dndStartHour && currentHour < dndEndHour;
  } else {
    // e.g. DND is 19:00 to 07:00 (crossing midnight)
    return currentHour >= dndStartHour || currentHour < dndEndHour;
  }
}

client.once('ready', async () => {
  console.log(`🤖 Discord Water Bot is online as ${client.user.tag}`);
  
  // Seed subscriptions on startup
  await seedSubscriptions();

  // --- TEST MESSAGE (Runs immediately upon starting) ---
  try {
    console.log("⏳ Sending test message to verify connection...");
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) {
      await channel.send('✅ **Test Message:** Water Tracker Bot is successfully connected and the 2-hour timer has started!');
      console.log("✅ Test message sent successfully!");
    } else {
      await sendWebhookMessage('✅ **Test Message (Webhook Fallback):** Webhook is successfully connected!');
    }
  } catch (error) {
    console.log("Bot channel fetch failed, falling back to webhook for test message...");
    await sendWebhookMessage('✅ **Test Message (Webhook Fallback):** Webhook is successfully connected!');
  }
  // -----------------------------------------------------

  // Schedule a cron job to run at the top of every hour (first run at 1:00 PM)
  cron.schedule('0 * * * *', async () => {
    const now = new Date();
    
    // Check our smart Calendar logic before sending
    if (isDoNotDisturb(now)) {
      console.log(`[${now.toLocaleTimeString()}] DND Mode Active (Near sleep time). Skipping water notification.`);
      return;
    }

    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) {
        await channel.send('💧 **حان وقت شرب الماء!**\nحافظ على رطوبة جسمك ولا تنسَ إضافة الكوب في لوحة التحكم (Rakeeen Dashboard).');
        console.log(`[${now.toLocaleTimeString()}] Notification sent via Bot Client!`);
      } else {
        await sendWebhookMessage('💧 **حان وقت شرب الماء!**\nحافظ على رطوبة جسمك ولا تنسَ إضافة الكوب في لوحة التحكم (Rakeeen Dashboard).');
        console.log(`[${now.toLocaleTimeString()}] Notification sent via Webhook!`);
      }
    } catch (error) {
      await sendWebhookMessage('💧 **حان وقت شرب الماء!**\nحافظ على رطوبة جسمك ولا تنسَ إضافة الكوب في لوحة التحكم (Rakeeen Dashboard).');
      console.log(`[${now.toLocaleTimeString()}] Notification sent via Webhook!`);
    }
  });
  
  console.log('⏰ Water Reminder Cron Job Scheduled (Runs every hour)!');

  // Daily cleanup cron job at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) {
        console.log(`[${new Date().toLocaleTimeString()}] Running daily cleanup...`);
        let fetched;
        let totalDeleted = 0;
        do {
          fetched = await channel.messages.fetch({ limit: 100 });
          if (fetched.size === 0) break;

          try {
            // First try bulkDelete
            const deleted = await channel.bulkDelete(fetched, true);
            totalDeleted += deleted.size;
            
            // If some messages remain (older than 14 days), delete them manually
            if (deleted.size < fetched.size) {
              const remaining = fetched.filter(msg => !deleted.has(msg.id));
              for (const [id, msg] of remaining) {
                await msg.delete();
                totalDeleted++;
                await new Promise(r => setTimeout(r, 1000)); // Avoid rate limits
              }
            }
          } catch (error) {
            // If bulkDelete fails entirely, fallback to manual delete
            for (const [id, msg] of fetched) {
              await msg.delete();
              totalDeleted++;
              await new Promise(r => setTimeout(r, 1000));
            }
          }
        } while (fetched.size >= 100);
        console.log(`[${new Date().toLocaleTimeString()}] Channel cleaned up successfully! Total deleted: ${totalDeleted}`);
      }
    } catch (error) {
      console.error("Failed to clean up channel:", error);
    }
  });
  
  console.log('🧹 Channel Cleanup Cron Job Scheduled (Runs daily at 02:00 AM)!');

  // Subscription reminders — runs every minute, fires each sub at its own reminderTime (Egypt time UTC+3)
  cron.schedule('* * * * *', async () => {
    try {
      // Use Egypt timezone explicitly
      const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
      const currentDay = nowEgypt.getDate();
      const currentHH = String(nowEgypt.getHours()).padStart(2, '0');
      const currentMM = String(nowEgypt.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHH}:${currentMM}`;

      const due = localSubscriptions.filter(sub => {
        const subTime = sub.reminderTime || '09:00';
        return parseInt(sub.renewalDay) === currentDay && subTime === currentTime;
      });

      if (due.length > 0) {
        console.log(`[${currentTime} Cairo] 🔔 ${due.length} subscription(s) due`);
        for (const sub of due) {
          await sendSubscriptionAlert(sub);
        }
      }
    } catch (error) {
      console.error("Failed to run subscription reminder cron:", error);
    }
  });

  // Re-seed subscriptions from Firebase every 30 minutes to stay fresh
  cron.schedule('*/30 * * * *', async () => {
    await seedSubscriptions();
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Subscriptions re-synced from Firebase`);
  });

  console.log('⏰ Subscriptions Reminder Cron Scheduled (Cairo time, every minute)!');
});

client.login(BOT_TOKEN).catch(err => {
  console.error("❌ Failed to login. Please make sure you put a valid BOT_TOKEN in the .env file.");
});

// ============================================================
// EMBED ALERTS HELPERS
// ============================================================
async function sendDiscordEmbed(embed, alternativeText) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('⚠️ No DISCORD_WEBHOOK_URL configured. Skipping Discord embed alert.');
    return;
  }
  try {
    const payload = {
      embeds: [{
        ...embed,
        timestamp: new Date().toISOString()
      }]
    };
    
    // Attempt sending via client fetch channel first
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (channel) {
        await channel.send({ embeds: [payload.embeds[0]] });
        console.log(`[${new Date().toLocaleTimeString()}] Sent Discord Embed via Client!`);
        return;
      }
    } catch (err) {
      // Fallback
    }

    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(`[${new Date().toLocaleTimeString()}] Sent Discord Embed via Webhook!`);
  } catch (e) {
    console.error('❌ Failed to send Discord embed:', e.message);
    await sendWebhookMessage(alternativeText);
  }
}

async function sendDepositAlert(item) {
  const embed = {
    title: '📥 Income Deposit Received',
    color: 3066993, // Green
    fields: [
      { name: 'Amount', value: `**${item.amount.toLocaleString('en-EG')} EGP**`, inline: true },
      { name: 'Bank', value: item.bank, inline: true },
      { name: 'Source', value: item.source, inline: true },
      { name: 'Status', value: '⏳ Pending Classification in Dashboard', inline: false }
    ]
  };
  const altText = `📥 **Deposit Alert**\n**${item.amount.toLocaleString('en-EG')} EGP** — ${item.bank} (${item.source})`;
  await sendDiscordEmbed(embed, altText);
}

async function sendDebitAlert(parsed) {
  const embed = {
    title: '💸 Account Debited',
    color: 15158332, // Red
    fields: [
      { name: 'Amount', value: `**${parsed.amount.toLocaleString('en-EG')} EGP**`, inline: true },
      { name: 'Bank', value: parsed.bank, inline: true }
    ]
  };
  if (parsed.recipient) {
    embed.fields.push({ name: 'Recipient', value: parsed.recipient, inline: true });
  }
  const altText = `💸 **Debit Alert**\n**${parsed.amount.toLocaleString('en-EG')} EGP** — ${parsed.bank}`;
  await sendDiscordEmbed(embed, altText);
}

async function sendSubscriptionAlert(sub) {
  const nowEgypt = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const dateStr = nowEgypt.toLocaleDateString('en-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const embed = {
    title: '🔁  Subscription Renewal Due',
    color: 0xF0C040, // Gold/amber
    description: `**${sub.name}** is renewing today — make sure it's covered.`,
    fields: [
      { name: '💳  Amount', value: `\`${sub.cost.toLocaleString('en-EG')} EGP\``, inline: true },
      { name: '🏦  Bank', value: sub.bank || '—', inline: true },
      { name: '📅  Date', value: dateStr, inline: false },
    ],
    footer: { text: 'Rakeeen · Finance · Subscriptions' },
    thumbnail: { url: 'https://cdn-icons-png.flaticon.com/512/2088/2088617.png' }
  };

  const altText = `🔁 **Subscription Due: ${sub.name}**\n💳 ${sub.cost.toLocaleString('en-EG')} EGP · 🏦 ${sub.bank || 'Unknown'}\n📅 ${dateStr}`;
  await sendDiscordEmbed(embed, altText);
}

// ============================================================
// GOLD PRICE SCRAPER & CACHE
// ============================================================
let cachedGoldPrices = {
  price24: 3800,
  price21: 3325,
  lastUpdated: null
};

function parsePrice(html, carat) {
  const regexDetails = new RegExp(`&quot;label&quot;\\s*:\\s*&quot;عيار\\s*${carat}&quot;\\s*,\\s*&quot;value&quot;\\s*:\\s*&quot;([\\d,]+)\\s*جنيه&quot;`);
  const matchDetails = html.match(regexDetails);
  if (matchDetails) {
    return parseFloat(matchDetails[1].replace(/,/g, ''));
  }

  const regexTable = new RegExp(`عيار\\s*${carat}[^<]*<\\/td>\\s*<td>\\s*([\\d,]+)\\s*جنيه`, 'i');
  const matchTable = html.match(regexTable);
  if (matchTable) {
    return parseFloat(matchTable[1].replace(/,/g, ''));
  }

  const regexNear = new RegExp(`عيار\\s*${carat}[^]{1,100}?([\\d,]{4,6})\\s*(?:جنيه|EGP)`, 'i');
  const matchNear = html.match(regexNear);
  if (matchNear) {
    return parseFloat(matchNear[1].replace(/,/g, ''));
  }

  return null;
}

async function getGoldPrices() {
  const now = Date.now();
  if (cachedGoldPrices.lastUpdated && (now - cachedGoldPrices.lastUpdated < 30000)) {
    return cachedGoldPrices;
  }
  try {
    const res = await fetch('https://egypt.gold-price-today.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      let p24 = null;
      let p21 = null;

      // Primary strategy: parse today's prices from the data-is-today attribute
      const match = html.match(/data-details="([^"]+)"[^>]*data-is-today="1"/);
      if (match) {
        try {
          const jsonStr = match[1].replace(/&quot;/g, '"');
          const data = JSON.parse(jsonStr);
          if (data && data.items) {
            for (const item of data.items) {
              if (item.label.includes('24')) {
                p24 = parseFloat(item.value.replace(/,/g, '').replace(/[^0-9.]/g, ''));
              } else if (item.label.includes('21')) {
                p21 = parseFloat(item.value.replace(/,/g, '').replace(/[^0-9.]/g, ''));
              }
            }
          }
        } catch (err) {
          console.error('⚠️ Failed to parse data-is-today JSON:', err.message);
        }
      }

      // Fallback to old regex parsing if today's price extraction failed
      if (!p24) p24 = parsePrice(html, 24);
      if (!p21) p21 = parsePrice(html, 21);

      if (p24 && p21) {
        cachedGoldPrices = {
          price24: p24,
          price21: p21,
          lastUpdated: now
        };
        console.log(`✨ Gold prices updated: 24K=${p24} EGP, 21K=${p21} EGP`);
      }
    }
  } catch (e) {
    console.error('⚠️ Failed to scrape gold prices, using default/cached values:', e.message);
  }
  return cachedGoldPrices;
}

// ============================================================
// FIREBASE SUBSCRIPTION SYNC & SEEDING
// ============================================================

// Load subscriptions from local file (persisted across restarts)
function loadSubscriptionsFromFile() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const raw = fs.readFileSync(SUBS_FILE, 'utf8');
      const subs = JSON.parse(raw);
      if (Array.isArray(subs) && subs.length > 0) {
        console.log(`📂 Loaded ${subs.length} subscriptions from local file`);
        return subs;
      }
    }
  } catch (err) {
    console.error('⚠️ Failed to load subscriptions from file:', err.message);
  }
  return [];
}

function saveSubscriptionsToFile(subs) {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ Failed to save subscriptions to file:', err.message);
  }
}

let localSubscriptions = loadSubscriptionsFromFile();

async function seedSubscriptions() {
  // Subscriptions are kept in memory and persisted to file via /api/subscriptions/sync
  // Firebase REST seeding is skipped (requires auth not available in backend)
  console.log(`📋 Current subscriptions in memory: ${localSubscriptions.length}`);
}

// ============================================================
// FINANCE WEBHOOK SERVER
// ============================================================
const app = express();
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT || '3001');
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

app.use(express.json());
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');
  if (_req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let pendingItems = [];

app.post('/webhook/sms', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { text, sender } = req.body;
  console.log(`📥 Received SMS Webhook: Sender="${sender}", Text="${text}"`);
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const parsed = parseSMS(text, sender || '');
  console.log('🔍 Parsed SMS Result:', parsed);

  if (parsed.type === 'internal' || parsed.type === 'unknown') {
    return res.json({ status: 'ignored', type: parsed.type });
  }

  if (parsed.type === 'deposit') {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bank: parsed.bank,
      amount: parsed.amount,
      source: parsed.source || 'Unknown',
      raw: text,
      receivedAt: new Date().toISOString(),
    };
    pendingItems.push(item);

    await sendDepositAlert(item);

    return res.json({ status: 'pending', item });
  }

  if (parsed.type === 'debit') {
    await sendDebitAlert(parsed);

    return res.json({ status: 'debit_noted', parsed });
  }

  return res.json({ status: 'ok', parsed });
});

app.get('/api/pending', (_req, res) => {
  res.json(pendingItems);
});

app.delete('/api/pending/:id', (req, res) => {
  pendingItems = pendingItems.filter(p => p.id !== req.params.id);
  res.json({ status: 'deleted' });
});

app.get('/api/gold-prices', async (_req, res) => {
  const prices = await getGoldPrices();
  res.json(prices);
});

app.post('/api/subscriptions/sync', (req, res) => {
  if (Array.isArray(req.body)) {
    localSubscriptions = req.body;
    saveSubscriptionsToFile(localSubscriptions);
    console.log(`🔄 Synced & saved ${localSubscriptions.length} subscriptions from client`);
  }
  res.json({ status: 'ok', count: localSubscriptions.length });
});

app.listen(WEBHOOK_PORT, () => {
  console.log(`🌐 Finance webhook server running on port ${WEBHOOK_PORT}`);
});
