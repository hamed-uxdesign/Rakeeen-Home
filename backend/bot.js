import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const CHANNEL_ID = '1501292671753523371';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || 'PUT_YOUR_BOT_TOKEN_HERE';

// Mocking Calendar Data (This will be replaced by your actual database/calendar integration later)
// Assume we fetch this daily to know when to stop and start
const MOCK_CALENDAR_TODAY = {
  wakeUpTime: '06:00', // 24-hour format
  sleepTime: '22:00'   // 10:00 PM
};

/**
 * Helper to check if current time is within the "Do Not Disturb" window
 * DND Window: 3 hours before sleepTime UNTIL 1 hour after wakeUpTime
 */
function isDoNotDisturb(currentTime) {
  const [sleepHour, sleepMin] = MOCK_CALENDAR_TODAY.sleepTime.split(':').map(Number);
  const [wakeHour, wakeMin] = MOCK_CALENDAR_TODAY.wakeUpTime.split(':').map(Number);

  const currentHour = currentTime.getHours();
  
  // Calculate DND start (3 hours before sleep)
  let dndStartHour = sleepHour - 3;
  if (dndStartHour < 0) dndStartHour += 24;

  // Calculate DND end (1 hour after wake)
  let dndEndHour = wakeHour + 1;
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
  
  // --- TEST MESSAGE (Runs immediately upon starting) ---
  try {
    console.log("⏳ Sending test message to verify connection...");
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) {
      await channel.send('✅ **Test Message:** Water Tracker Bot is successfully connected and the 2-hour timer has started!');
      console.log("✅ Test message sent successfully!");
    }
  } catch (error) {
    console.error("❌ Failed to send test message. Check Channel ID and Permissions:", error);
  }
  // -----------------------------------------------------

  // Schedule a cron job to run at the top of every 2 hours
  cron.schedule('0 */2 * * *', async () => {
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
        console.log(`[${now.toLocaleTimeString()}] Notification sent!`);
      }
    } catch (error) {
      console.error("Failed to send Discord message:", error);
    }
  });
  
  console.log('⏰ Water Reminder Cron Job Scheduled (Runs every 2 hours)!');

  // Daily cleanup cron job at 12:00 AM
  cron.schedule('0 0 * * *', async () => {
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
  
  console.log('🧹 Channel Cleanup Cron Job Scheduled (Runs daily at 12:00 AM)!');
});

client.login(BOT_TOKEN).catch(err => {
  console.error("❌ Failed to login. Please make sure you put a valid BOT_TOKEN in the .env file.");
});
