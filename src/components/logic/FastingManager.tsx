import React, { useEffect, useState } from 'react';

// @ts-ignore
const FASTING_WEBHOOK = import.meta.env.VITE_DISCORD_FASTING_WEBHOOK || import.meta.env.VITE_DISCORD_POMODORO_WEBHOOK;

export const FastingManager: React.FC = () => {
  const [timings, setTimings] = useState<any>(null);

  useEffect(() => {
    const fetchTimings = async () => {
      try {
        const res = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Mansoura&country=Egypt&method=5');
        const data = await res.json();
        if (data.code === 200) {
          setTimings(data.data.timings);
        }
      } catch (e) {
        console.error('FastingManager: Failed to fetch prayer timings', e);
      }
    };

    fetchTimings();
    // Refresh timings every 6 hours
    const interval = setInterval(fetchTimings, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!timings || !FASTING_WEBHOOK) return;

    const checkTime = () => {
      const now = new Date();
      const today = now.toDateString();
      
      const parseTime = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        const d = new Date(now);
        d.setHours(h, m, 0, 0);
        return d;
      };

      const dhuhr = parseTime(timings.Dhuhr);
      const maghrib = parseTime(timings.Maghrib);

      const startEatingTime = new Date(dhuhr.getTime() + 15 * 60 * 1000);
      const stopEatingTime = new Date(maghrib.getTime() - 30 * 60 * 1000);

      const sendDiscord = async (msg: string, title: string, color: number) => {
        try {
          await fetch(FASTING_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: title,
                description: msg,
                color: color,
                footer: { text: 'Rakeeen Smart Fasting System' },
                timestamp: new Date().toISOString()
              }]
            })
          });
        } catch (e) {
          console.error('FastingManager: Webhook failed', e);
        }
      };

      // Eating Window logic moved to Discord Bot scheduler.
      // Removed Arabic notifications as per user request.



      // --- Phase 5: Friday Sugar Reward ---
      const isFriday = now.getDay() === 5;
      if (isFriday) {
        const lastReward = localStorage.getItem('sugar_last_reward');
        if (lastReward !== today) {
          try {
            const sugarStr = localStorage.getItem('fitness_sugar');
            const sugar = sugarStr ? JSON.parse(sugarStr) : { completedDays: 0 };
            
            if (sugar.completedDays >= 21) {
              sendDiscord("Weekly Sugar Reward Unlocked! 🎉 You've stayed disciplined all week, enjoy a moderate sweet treat today as part of your balanced routine.", '🍬 WEEKLY SUGAR REWARD UNLOCKED', 0xffb703);
              localStorage.setItem('sugar_last_reward', today);
            }
          } catch (e) {
            console.error('Sugar Reward Check Failed', e);
          }
        }
      }
    };

    const interval = setInterval(checkTime, 60000); // Check every minute
    checkTime(); // Initial check
    return () => clearInterval(interval);
  }, [timings]);

  return null; // Logic-only component
};
