import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { FOOD_DB, CALORIE_GOAL, WEEKLY_CALORIES_MOCK } from '../../constants/mockData';
import { getTodayIdx } from '../../utils/timeHelpers';
import { BackBtn } from '../layout/Common';
import { Card, Button, Label, Input } from '../ui/UIComponents';

interface FitnessProps {
  navigate: (to: string) => void;
}

export const Fitness: React.FC<FitnessProps> = ({ navigate }) => {
  const [tab, setTab] = useState<'diet' | 'workout' | 'progress'>('diet');
  const [meals, setMeals] = useFirebaseSync<Record<string, any[]>>('meals', { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [workouts, setWorkouts] = useFirebaseSync<any[]>('workouts', []);
  const [weekCalories, setWeekCalories] = useFirebaseSync('week_calories', WEEKLY_CALORIES_MOCK);

  const [selMeal, setSelMeal] = useState('Breakfast');
  const [selFood, setSelFood] = useState(Object.keys(FOOD_DB)[0]);
  const [grams, setGrams] = useState('');
  
  const [wType, setWType] = useState('');
  const [wDuration, setWDuration] = useState('');

  const addFoodItem = () => {
    if (!grams || isNaN(Number(grams)) || Number(grams) <= 0) return;
    const g = Number(grams);
    const food = FOOD_DB[selFood];
    const item = {
      food: selFood, grams: g,
      kcal: Math.round(food.kcal_per_g * g),
      protein: Number((food.protein * g).toFixed(1)),
      carbs: Number((food.carbs * g).toFixed(1)),
      fat: Number((food.fat * g).toFixed(1)),
    };
    const updated = { ...meals, [selMeal]: [...meals[selMeal], item] };
    setMeals(updated);
    const todayIdx = getTodayIdx();
    const newWeek = weekCalories.map((d: any, i: number) => i === todayIdx ? { ...d, consumed: d.consumed + item.kcal } : d);
    setWeekCalories(newWeek);
    setGrams('');
  };

  const addWorkout = () => {
    if (!wType || !wDuration) return;
    const newWorkout = {
      type: wType,
      duration: wDuration,
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };
    setWorkouts([newWorkout, ...workouts]);
    setWType('');
    setWDuration('');
  };

  const totalToday = Object.values(meals).flat().reduce((a, i) => a + i.kcal, 0);
  const macroTotals = Object.values(meals).flat().reduce((a, i) => ({
    protein: a.protein + i.protein, carbs: a.carbs + i.carbs, fat: a.fat + i.fat
  }), { protein: 0, carbs: 0, fat: 0 });

  return (
    <div className="max-w-3xl mx-auto py-10 px-5">
      <BackBtn onClick={()=>navigate('home')} />
      
      <header className="mb-10">
        <h2 className="text-4xl font-black text-ink mb-1">Fitness & nutrition</h2>
        <p className="text-[10px] text-ink/30 tracking-[0.2em] font-black">Workout log · Diet tracker · Progress</p>
      </header>

      <div className="flex gap-2 sm:gap-6 mb-10 border-b-2 border-ink/10 pb-4 overflow-x-auto no-scrollbar">
        {[['diet','🥗 Diet'],['workout','🏋️ Workout'],['progress','📊 Progress']].map(([id, label])=>(
          <button key={id} onClick={()=>setTab(id as any)}
            className={`whitespace-nowrap px-4 py-2 font-black tracking-widest text-xs transition-all ${tab===id ? 'text-sepia border-b-4 border-sepia -mb-[20px]' : 'text-ink/40 hover:text-ink/60'}`}
          >{label}</button>
        ))}
      </div>

      {tab === 'diet' && (
        <div className="animate-scale-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              {l:'Calories', v:totalToday, sub:`/ ${CALORIE_GOAL}`, c:'text-sepia'},
              {l:'Protein', v:`${macroTotals.protein.toFixed(0)}g`, sub:'', c:'text-forest'},
              {l:'Carbs', v:`${macroTotals.carbs.toFixed(0)}g`, sub:'', c:'text-rust'},
              {l:'Fat', v:`${macroTotals.fat.toFixed(0)}g`, sub:'', c:'text-[#8B7FB8]'},
            ].map((item)=>(
              <Card key={item.l} variant="sketchy" className="p-4 bg-paper/50 flex flex-col items-center justify-center text-center">
                <Label className="text-[9px] mb-2 font-black opacity-60">{item.l}</Label>
                <div className={`text-3xl font-black ${item.c}`}>{item.v}</div>
                {item.sub && <div className="text-[10px] font-bold text-ink/40 tracking-widest mt-1">{item.sub}</div>}
              </Card>
            ))}
          </div>

          <Card variant="sketchy" title="Log Food" className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2 group">
                <label className="text-[10px] tracking-[0.2em] text-ink font-black opacity-40 group-focus-within:opacity-100 ml-1">Meal</label>
                <select className="w-full bg-paper-dark/50 border-b-2 border-ink/10 outline-none px-4 py-4 text-ink font-sans transition-all focus:border-sepia rounded-t-lg" value={selMeal} onChange={e=>setSelMeal(e.target.value)}>
                  {['Breakfast','Lunch','Dinner','Snacks'].map(m=><option key={m} className="bg-paper">{m}</option>)}
                </select>
              </div>
              <div className="space-y-2 group">
                <label className="text-[10px] tracking-[0.2em] text-ink font-black opacity-40 group-focus-within:opacity-100 ml-1">Food item</label>
                <select className="w-full bg-paper-dark/50 border-b-2 border-ink/10 outline-none px-4 py-4 text-ink font-sans transition-all focus:border-sepia rounded-t-lg" value={selFood} onChange={e=>setSelFood(e.target.value)}>
                  {Object.keys(FOOD_DB).map(f=><option key={f} className="bg-paper">{f}</option>)}
                </select>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-6 items-end">
              <div className="w-full sm:flex-1">
                 <Input variant="sketchy" label="Weight (grams)" type="number" placeholder="e.g. 150" value={grams} onChange={e=>setGrams(e.target.value)} />
              </div>
              <Button variant="sketchy" filled onClick={addFoodItem} className="w-full sm:w-auto sm:mb-6">Add Food</Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'workout' && (
        <div className="animate-scale-in">
          <Card variant="sketchy" title="Log Workout" className="mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <Input variant="sketchy" label="Activity Type" placeholder="e.g. Strength Training" value={wType} onChange={e=>setWType(e.target.value)} />
              <Input variant="sketchy" label="Duration (mins)" type="number" placeholder="e.g. 45" value={wDuration} onChange={e=>setWDuration(e.target.value)} />
            </div>
            <Button variant="sketchy" filled onClick={addWorkout}>Add Workout</Button>
          </Card>

          {workouts.length > 0 && (
            <Card variant="sketchy" title="Recent Sessions">
              <div className="flex flex-col gap-4">
                {workouts.map((w: any, i: number)=>(
                  <div key={i} className={`flex justify-between items-center pb-4 ${i < workouts.length - 1 ? 'border-b-2 border-ink/5' : ''}`}>
                    <div>
                      <div className="text-lg font-bold text-ink mb-1">{w.type}</div>
                      <div className="text-xs font-bold text-ink/30 tracking-widest">{w.time}</div>
                    </div>
                    <div className="text-forest font-black text-xl">{w.duration} <span className="text-xs">min</span></div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'progress' && (
        <div className="animate-scale-in">
          <Card variant="sketchy" title="Weekly Calories" subtitle={`Goal: ${CALORIE_GOAL} kcal`} className="bg-[var(--paper)]">
            <div className="h-[250px] w-full mt-8">
              <ResponsiveContainer>
                <AreaChart data={weekCalories}>
                  <defs>
                    <linearGradient id="calGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--forest)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--forest)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.05)" />
                  <XAxis dataKey="day" tick={{fill:'var(--ink)',opacity:0.4,fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{fill:'var(--ink)',opacity:0.4,fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} domain={[0,3000]} dx={-10} />
                  <Tooltip contentStyle={{background:'var(--paper)',border:'2px solid var(--border)',color:'var(--ink)',borderRadius:'12px',fontFamily:'var(--font-sans)',fontSize:'12px',fontWeight:700}} cursor={{stroke: 'var(--ink)', strokeOpacity: 0.1, strokeWidth: 2}} />
                  <ReferenceLine y={CALORIE_GOAL} stroke="var(--sepia)" strokeDasharray="5 5" strokeOpacity={0.8} strokeWidth={2} />
                  <Area type="monotone" dataKey="consumed" stroke="var(--forest)" strokeWidth={3} fill="url(#calGrad)" dot={{fill:'var(--paper)', stroke: 'var(--forest)', strokeWidth: 2, r: 4}} activeDot={{r: 6}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
