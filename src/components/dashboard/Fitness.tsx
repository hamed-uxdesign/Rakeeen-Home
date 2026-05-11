import React, { useState } from 'react';
import { useFirebaseSync } from '../../hooks/useFirebaseSync';
import { BackBtn } from '../layout/Common';
import { Button, Input, Label, PageHeader, ChartTooltip } from '../ui/UIComponents';
import { Tabs } from '../ui/Tabs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  AppleIcon, 
  Dumbbell01Icon, 
  Chart01Icon, 
  PlusSignIcon, 
  Delete02Icon,
  Database01Icon,
  Tick01Icon,
  ArrowTurnBackwardIcon,
  ZapIcon
} from '@hugeicons/core-free-icons';
import { useNavigate } from 'react-router-dom';
import { CustomSelect } from '../ui/Select';

interface MealItem {
  id: string;
  name: string;
  kcal: number;
  grams: number;
  time: string;
}

const CALORIE_GOAL = 2200;

export const Fitness: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'diet' | 'challenge' | 'database' | 'workout' | 'progress'>('diet');
  
  const [meals, setMeals] = useFirebaseSync<Record<string, MealItem[]>>('fitness_meals', { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [foodDb, setFoodDb] = useFirebaseSync<any[]>('fitness_food_db', []);
  const [workouts, setWorkouts] = useFirebaseSync<any[]>('fitness_workouts', []);
  const [sugarChallenge, setSugarChallenge] = useFirebaseSync<any>('fitness_sugar', { lastCheckIn: '', completedDays: 0 });
  const [history, setHistory] = useFirebaseSync<Record<string, number>>('fitness_history', {});
  const [lastDate, setLastDate] = useFirebaseSync<string>('fitness_last_date', new Date().toDateString());

  const [selMeal, setSelMeal] = useState('Breakfast');
  const [selFoodId, setSelFoodId] = useState('');
  const [grams, setGrams] = useState('');
  const [newFoodName, setNewFoodName] = useState('');
  const [newFoodKcal, setNewFoodKcal] = useState('');
  const [newFoodWeight, setNewFoodWeight] = useState('');
  const [wDuration, setWDuration] = useState('');

  const totalToday = Object.values(meals).flat().reduce((a, b) => a + b.kcal, 0);

  React.useEffect(() => {
    // Client-side reset logic removed. 
    // Handled by Firebase Cloud Function (midnightReset)
  }, []);

  const addMealItem = () => {
    const food = foodDb.find(f => f.id === selFoodId);
    if (!food || !grams) return;
    const kcal = Math.round((food.calories / food.baseWeight) * Number(grams));
    setMeals({ ...meals, [selMeal]: [...meals[selMeal], { id: Date.now().toString(), name: food.name, kcal, grams: Number(grams), time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) }] });
    setGrams('');
  };

  const deleteMealItem = (meal: string, id: string) => setMeals({ ...meals, [meal]: meals[meal].filter(i => i.id !== id) });
  const addToDb = () => {
    if (!newFoodName || !newFoodKcal) return;
    setFoodDb([...foodDb, { id: Date.now().toString(), name: newFoodName, calories: Number(newFoodKcal), baseWeight: Number(newFoodWeight) || 100 }]);
    setNewFoodName(''); setNewFoodKcal(''); setNewFoodWeight('');
  };
  const deleteFromDb = (id: string) => setFoodDb(foodDb.filter(f => f.id !== id));
  const addWorkout = () => {
    if (!wDuration) return;
    setWorkouts([{ id: Date.now().toString(), duration: Number(wDuration), date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() }, ...workouts]);
    setWDuration('');
  };
  const deleteWorkout = (id: string) => setWorkouts(workouts.filter(w => w.id !== id));

  const checkInSugar = () => {
    const today = new Date().toDateString();
    if (sugarChallenge.lastCheckIn === today) return;
    setSugarChallenge({ lastCheckIn: today, completedDays: sugarChallenge.completedDays + 1 });
  };
  const undoSugar = () => {
    if (sugarChallenge.completedDays <= 0) return;
    setSugarChallenge({ lastCheckIn: '', completedDays: sugarChallenge.completedDays - 1 });
  };

  const isTodayChecked = sugarChallenge.lastCheckIn === new Date().toDateString();
  const isChallengeDone = sugarChallenge.completedDays >= 21;

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekCalories = days.map((day, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (date.getDay() - i));
    const dateStr = date.toDateString();
    return { day, consumed: dateStr === new Date().toDateString() ? totalToday : (history[dateStr] || 0) };
  });

  const weekWorkouts = days.map((day, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (date.getDay() - i));
    const dateStr = date.toLocaleDateString();
    const dayMins = workouts
      .filter(w => w.date === dateStr)
      .reduce((acc, w) => acc + (Number(w.duration) || 0), 0);
    return { day, minutes: dayMins };
  });

  // --- Workout Logic ---
  const WORKOUT_DAYS = [0, 3]; // Sun, Wed
  const today = new Date();
  const todayIdx = today.getDay();
  const isWorkoutDay = WORKOUT_DAYS.includes(todayIdx);
  const workoutLoggedToday = workouts.some(w => w.date === today.toLocaleDateString());
  
  const getNextWorkout = () => {
    let next = new Date();
    for (let i = 1; i <= 7; i++) {
      let check = new Date();
      check.setDate(today.getDate() + i);
      if (WORKOUT_DAYS.includes(check.getDay())) return check;
    }
    return next;
  };
  
  const nextWorkout = getNextWorkout();
  const diffDays = Math.ceil((nextWorkout.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isLate = today.getHours() >= 20;
  const isMissed = isWorkoutDay && isLate && !workoutLoggedToday;



  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-12 px-4 sm:px-6 min-h-screen">
      <BackBtn onClick={() => navigate('home')} />
      <PageHeader 
        title="Fitness" 
        subtitle="Performance & Nutrition" 
      />

      <Tabs 
        tabs={[
          { id: 'diet', label: 'Diet' },
          { id: 'challenge', label: 'No Sugar' },
          { id: 'database', label: 'Foods' },
          { id: 'workout', label: 'Workouts' },
          { id: 'progress', label: 'Analytics' },
        ]}
        activeTab={tab}
        onChange={(v) => setTab(v as any)}
        className="flex-wrap mb-8 sm:mb-12 gap-2"
        size="md"
      />

      {tab === 'diet' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
          <div className="sys-card p-6 sm:p-12 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-2 bg-ink/5">
                <div className="h-full bg-forest transition-all duration-1000" style={{ width: `${Math.min(100, (totalToday / CALORIE_GOAL) * 100)}%` }} />
             </div>
             <Label className="text-[10px] sm:text-xs opacity-30 font-black tracking-[0.3em] mb-4 uppercase">Energy Consumed</Label>
             <div className="text-5xl sm:text-[80px] font-black text-ink tracking-tighter leading-none">
                {totalToday} <span className="text-lg sm:text-2xl text-ink/10 font-normal ml-2">/ {CALORIE_GOAL}</span>
             </div>
          </div>
          <div className="sys-card p-6 sm:p-10">
            <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-6 sm:mb-10 opacity-30">Log Meal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
              <CustomSelect label="Meal Category" value={selMeal} onChange={setSelMeal} options={[{ value: 'Breakfast', label: 'Breakfast' }, { value: 'Lunch', label: 'Lunch' }, { value: 'Dinner', label: 'Dinner' }, { value: 'Snacks', label: 'Snacks' }]} />
              <CustomSelect label="Food Item" value={selFoodId} onChange={setSelFoodId} placeholder="Select..." options={foodDb.map(f => ({ value: f.id, label: f.name }))} />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-end">
              <div className="flex-1">
                <Input label="Amount (Grams)" placeholder="100" type="number" value={grams} onChange={e => setGrams(e.target.value)} className="h-14 sm:h-16 text-lg sm:text-xl" />
              </div>
              <Button variant="premium" onClick={addMealItem} className="h-14 sm:h-16 px-10 w-full sm:w-auto"><HugeiconsIcon icon={PlusSignIcon} size={24} className="mx-auto" /></Button>
            </div>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {Object.entries(meals).map(([mealName, items]) => items.length > 0 && (
              <div key={mealName} className="sys-card p-6 sm:p-10">
                <div className="flex justify-between items-center mb-6 sm:mb-8">
                  <h4 className="text-base sm:text-lg font-black uppercase tracking-[0.2em] text-forest">{mealName}</h4>
                  <span className="text-[10px] sm:text-xs font-black text-ink/20 uppercase tracking-widest">{items.reduce((a, i) => a + i.kcal, 0)} kcal</span>
                </div>
                <div className="space-y-4 sm:space-y-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center group">
                      <div>
                        <div className="text-lg sm:text-xl font-black text-ink">{item.name}</div>
                        <div className="text-[10px] sm:text-xs font-black opacity-20 uppercase tracking-[0.1em] sm:tracking-[0.2em]">{item.grams}g · {item.time}</div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-6">
                        <span className="text-xl sm:text-2xl font-black text-ink/70">{item.kcal} <span className="text-[10px] sm:text-xs opacity-30 uppercase ml-1">kcal</span></span>
                        <button onClick={() => deleteMealItem(mealName, item.id)} className="text-rust p-2 hover:bg-rust/10 transition-all sm:opacity-0 sm:group-hover:opacity-100 rounded-md"><HugeiconsIcon icon={Delete02Icon} size={20} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'challenge' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
          <div className={`sys-card p-6 sm:p-12 text-center ${isChallengeDone ? 'bg-forest/5 border-2 border-forest' : ''}`}>
             <div className="mb-8 sm:mb-12">
                <h3 className="text-3xl sm:text-4xl font-black text-ink mb-2 tracking-tighter">
                  {isChallengeDone ? 'HABIT SECURED' : 'No Sugar'}
                </h3>
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] text-forest opacity-60">
                  {isChallengeDone ? 'LIFETIME MAINTENANCE' : 'Discipline Protocol'}
                </p>
             </div>

             {!isChallengeDone ? (
               <>
                 <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-8 sm:mb-12 max-w-md mx-auto px-2">
                    {Array.from({ length: 21 }).map((_, i) => (
                      <div 
                        key={i} 
                        className="aspect-square border-2 transition-all duration-700 flex items-center justify-center rounded-sm sm:rounded-md"
                        style={{ 
                          backgroundColor: i < sugarChallenge.completedDays ? 'var(--forest)' : 'rgba(26,26,26,0.08)',
                          borderColor: i < sugarChallenge.completedDays ? 'var(--forest)' : 'rgba(26,26,26,0.25)'
                        }}
                      >
                        {i < sugarChallenge.completedDays && (
                          <HugeiconsIcon icon={Tick01Icon} size={20} style={{ color: 'var(--paper)' }} />
                        )}
                      </div>
                    ))}
                 </div>
                 <div className="text-center mb-8 sm:mb-12">
                    <div className="text-6xl sm:text-[100px] font-black text-forest leading-none tracking-tighter">{sugarChallenge.completedDays}</div>
                    <div className="text-[10px] sm:text-xs font-black text-ink/20 uppercase tracking-[0.3em] mt-2 sm:mt-4">Days Completed / 21</div>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Button variant="premium" onClick={checkInSugar} disabled={isTodayChecked} className="flex-1 h-16 sm:h-20 !bg-forest !text-paper !border-forest text-sm sm:text-lg tracking-widest font-black uppercase">{isTodayChecked ? 'Day Secured' : 'Log Success'}</Button>
                    {isTodayChecked && <button onClick={undoSugar} className="h-16 sm:h-20 px-8 border-2 border-rust text-rust hover:bg-rust/10 transition-all font-black uppercase text-xs tracking-widest">Undo</button>}
                 </div>
               </>
             ) : (
               <div className="py-6 sm:py-10">
                 <div className="w-32 h-32 bg-forest rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(124,169,130,0.3)]">
                    <HugeiconsIcon icon={ZapIcon} size={64} style={{ color: 'var(--paper)' }} />
                 </div>
                 <p className="text-lg font-black text-ink mb-12 max-w-sm mx-auto leading-relaxed">The 21-day cycle is complete. You are now in the <span className="text-forest">Reward Protocol</span>.</p>
                 <div className="bg-paper p-8 border-2 border-dashed border-forest/30 inline-block">
                    <div className="text-[10px] font-black uppercase tracking-[0.4em] text-ink/30 mb-2">Next Friday Reward</div>
                    <div className="text-2xl font-black text-forest tracking-tighter">SUGAR REWARD UNLOCKED</div>
                 </div>
                 <div className="mt-12">
                    <button onClick={undoSugar} className="text-[10px] font-black uppercase tracking-widest text-ink/20 hover:text-rust transition-all italic">Reset Challenge (Not Recommended)</button>
                 </div>
               </div>
             )}
          </div>
        </div>
      )}

      {tab === 'database' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
          <div className="sys-card p-6 sm:p-10">
            <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-6 sm:mb-10 opacity-30">Define New Food</h3>
            <div className="space-y-4 sm:space-y-6">
              <Input label="Label" placeholder="e.g. Avocado" value={newFoodName} onChange={e => setNewFoodName(e.target.value)} className="h-14 sm:h-16 text-lg sm:text-xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <Input label="Base (Grams)" type="number" placeholder="100" value={newFoodWeight} onChange={e => setNewFoodWeight(e.target.value)} className="h-14 sm:h-16 text-lg sm:text-xl" />
                <Input label="Energy (Kcal)" type="number" placeholder="160" value={newFoodKcal} onChange={e => setNewFoodKcal(e.target.value)} className="h-14 sm:h-16 text-lg sm:text-xl" />
              </div>
              <Button variant="premium" onClick={addToDb} className="w-full h-14 sm:h-16 text-sm sm:text-lg uppercase tracking-widest">Register Food</Button>
            </div>
          </div>
          <div className="sys-card p-6 sm:p-10">
            <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] mb-6 sm:mb-10 opacity-30">Available Assets</h3>
            {foodDb.length === 0 ? <div className="py-24 text-center text-ink/10 text-sm font-black uppercase tracking-widest border-2 border-dashed border-ink/5">Registry Empty</div> : (
              <div className="space-y-3 sm:space-y-4">
                {foodDb.map(food => (
                  <div key={food.id} className="flex justify-between items-center p-4 sm:p-6 bg-paper border-2 border-transparent group hover:border-forest/30 transition-all rounded-lg">
                    <div><div className="text-lg sm:text-xl font-black text-ink">{food.name}</div><div className="text-[10px] sm:text-xs font-black opacity-20 uppercase tracking-[0.2em] mt-1">{food.calories} kcal / {food.baseWeight}g</div></div>
                    <button onClick={() => deleteFromDb(food.id)} className="text-rust p-3 hover:bg-rust/10 transition-all sm:opacity-0 sm:group-hover:opacity-100 rounded-md"><HugeiconsIcon icon={Delete02Icon} size={22} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

       {tab === 'workout' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
           <div className={`sys-card p-6 sm:p-12 text-center transition-all duration-500 ${isMissed ? 'bg-rust/10 border-rust border-l-8' : isWorkoutDay && workoutLoggedToday ? 'bg-forest/10 border-forest border-l-8' : 'bg-paper-dark border-ink/5'}`}>
              {isMissed ? (
                <HugeiconsIcon icon={ZapIcon} size={48} className="text-rust mx-auto mb-6 sm:mb-8 animate-bounce" />
              ) : (
                <HugeiconsIcon icon={Dumbbell01Icon} size={48} className={`mx-auto mb-6 sm:mb-8 ${isWorkoutDay && workoutLoggedToday ? 'text-forest' : 'text-ink/20'}`} />
              )}
              
              <h3 className="text-2xl sm:text-4xl font-black text-ink mb-4 tracking-tighter">
                {isMissed ? 'ACTION REQUIRED' : isWorkoutDay ? (workoutLoggedToday ? 'PROTOCOL SECURED' : 'TRAINING DAY') : 'RECOVERY PHASE'}
              </h3>
              
              <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
                 {days.map((d, i) => {
                   const isW = WORKOUT_DAYS.includes(i);
                   return (
                     <div key={d} className={`text-[10px] font-black px-2 sm:px-3 py-1 rounded-full ${isW ? (i === todayIdx ? 'bg-forest text-paper' : 'border-2 border-forest text-forest') : 'opacity-20'}`}>
                       {d.toUpperCase()}
                     </div>
                   );
                 })}
              </div>

              {isMissed ? (
                <p className="text-xs sm:text-sm text-rust font-black uppercase tracking-widest px-4">Excuses don't burn calories. Log it now.</p>
              ) : isWorkoutDay && workoutLoggedToday ? (
                <p className="text-xs sm:text-sm text-forest font-black uppercase tracking-widest px-4">Performance optimized for today.</p>
              ) : (
                <p className="text-xs sm:text-sm text-ink/40 font-bold max-w-xs mx-auto leading-relaxed px-4">
                  Next session in <span className="text-ink font-black">{diffDays} {diffDays === 1 ? 'day' : 'days'}</span> ({nextWorkout.toLocaleDateString('en-US', { weekday: 'long' })})
                </p>
              )}
           </div>
           <div className="sys-card p-6 sm:p-10">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-end">
                <div className="flex-1">
                  <Input label="Duration (Minutes)" type="number" placeholder="60" value={wDuration} onChange={e => setWDuration(e.target.value)} className="h-14 sm:h-16 text-lg sm:text-xl" />
                </div>
                <Button variant="premium" onClick={addWorkout} className="h-14 sm:h-16 px-12 text-sm sm:text-lg">Log</Button>
              </div>
           </div>
           <div className="space-y-4 sm:space-y-6">
              {workouts.map((w) => (
                <div key={w.id} className="sys-card p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 border-l-8 border-l-forest hover:translate-x-2 transition-all group">
                   <div>
                      <div className="text-[10px] sm:text-xs font-black opacity-20 uppercase tracking-widest mb-1 sm:mb-2">{w.date} · {w.time}</div>
                      <div className="text-xl sm:text-2xl font-black text-ink tracking-tighter">Session Complete</div>
                   </div>
                   <div className="flex items-center gap-4 sm:gap-8 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-3xl sm:text-4xl font-black text-forest tracking-tighter">{w.duration}<span className="text-[10px] sm:text-xs ml-1 sm:ml-2 opacity-30 uppercase font-black">min</span></div>
                      <button onClick={() => deleteWorkout(w.id)} className="text-rust p-3 hover:bg-rust/10 transition-all sm:opacity-0 sm:group-hover:opacity-100 rounded-md"><HugeiconsIcon icon={Delete02Icon} size={22} /></button>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {tab === 'progress' && (
        <div className="animate-scale-in space-y-6 sm:space-y-8">
           <div className="sys-card p-6 sm:p-12">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
                <h3 className="text-2xl sm:text-4xl font-black tracking-tighter whitespace-nowrap">Diet Reports</h3>
                <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-forest"><div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-forest rounded-full" />Goal: {CALORIE_GOAL}</div>
              </div>
              <div className="h-[250px] sm:h-[350px] w-full">
                <ResponsiveContainer>
                  <BarChart data={weekCalories} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.05)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--ink)', opacity: 0.3, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fill: 'var(--ink)', opacity: 0.3, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(124,169,130,0.05)' }} content={<ChartTooltip unit="kcal" getTipMessage={(val) => val > CALORIE_GOAL ? 'Limit Exceeded' : 'Under Control'} />} />
                    <ReferenceLine y={CALORIE_GOAL} stroke="var(--forest)" strokeDasharray="8 8" strokeOpacity={0.4} />
                    <Bar dataKey="consumed" fill="var(--forest)" radius={[0, 0, 0, 0]} maxBarSize={50}>{weekCalories.map((entry: any, i: number) => (<Cell key={i} fill={entry.consumed > CALORIE_GOAL ? 'var(--rust)' : 'var(--forest)'} opacity={0.8} />))}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="sys-card p-6 sm:p-12">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
                <h3 className="text-2xl sm:text-4xl font-black tracking-tighter whitespace-nowrap">Training Flow</h3>
                <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-black uppercase tracking-widest text-forest"><div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-forest rounded-full" />Daily Minutes</div>
              </div>
              <div className="h-[250px] sm:h-[350px] w-full">
                <ResponsiveContainer>
                  <BarChart data={weekWorkouts} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(232,224,208,0.05)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--ink)', opacity: 0.3, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fill: 'var(--ink)', opacity: 0.3, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(124,169,130,0.05)' }} content={<ChartTooltip unit="min" getTipMessage={(val) => val >= 45 ? 'Peak Performance' : 'Keep Pushing'} />} />
                    <Bar dataKey="minutes" fill="var(--sepia)" radius={[0, 0, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="sys-card p-6 sm:p-12">
              <h3 className="text-2xl sm:text-4xl font-black tracking-tighter mb-8 sm:mb-12">Calorie History</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {Object.entries(history).length > 0 ? (
                   Object.entries(history)
                     .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                     .slice(0, 7)
                     .map(([date, kcal]) => (
                       <div key={date} className="flex justify-between items-center p-6 bg-paper/20 border-l-4 border-forest">
                         <div>
                           <div className="text-[10px] uppercase font-black tracking-widest text-ink/30 mb-1">{date}</div>
                           <div className="text-xl font-black text-ink">{kcal} kcal</div>
                         </div>
                         <div className={`text-xs font-black uppercase tracking-widest ${kcal > CALORIE_GOAL ? 'text-rust' : 'text-forest'}`}>
                           {kcal > CALORIE_GOAL ? 'Over Goal' : 'Optimal'}
                         </div>
                       </div>
                     ))
                 ) : (
                   <p className="text-ink/20 text-sm font-black uppercase tracking-[0.3em]">No calorie history found.</p>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
