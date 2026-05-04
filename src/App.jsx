import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { Dumbbell, Calendar, Plus, Trash2, ArrowLeft, Activity, CheckCircle, ChevronUp, ChevronDown, Edit3, Loader2, User, ShieldCheck, Zap, UserCircle } from 'lucide-react';

// =========================================================================
// ВНИМАНИЕ! ЗАМЕНИТЕ СЛОВА "ВСТАВИТЬ_СЮДА" НА СВОИ ДАННЫЕ ИЗ FIREBASE
// (ВЫ ПОЛУЧИЛИ ИХ НА ЭТАПЕ 1)
// =========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBDVv6ofdaXp0AnexaeK7Cn5KmZePaSBnY",
  authDomain: "gym-bro-1e232.firebaseapp.com",
  projectId: "gym-bro-1e232",
  storageBucket: "gym-bro-1e232.firebasestorage.app",
  messagingSenderId: "350994209581",
  appId: "1:350994209581:web:22bcf3ff9ea87e287011a4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'workout-diary-personal'; // Это можно не трогать

// --- 6 Стандартных Шаблонов ---
const DEFAULT_TEMPLATES = [
  { id: 'def-1', keyword: 'грудь', exercises: ['Жим штанги лежа', 'Жим гантелей 30°', 'Бабочка'] },
  { id: 'def-2', keyword: 'бицепс', exercises: ['Подъем гантелей стоя', 'Скамья Скотта'] },
  { id: 'def-3', keyword: 'спина', exercises: ['Подтягивания', 'Тяга штанги в наклоне', 'Тяга верхнего блока'] },
  { id: 'def-4', keyword: 'ноги', exercises: ['Приседания со штангой', 'Жим ногами', 'Сгибания ног'] },
  { id: 'def-5', keyword: 'плечи', exercises: ['Армейский жим', 'Махи гантелями в стороны'] },
  { id: 'def-6', keyword: 'трицепс', exercises: ['Отжимания на брусьях', 'Французский жим'] }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [workouts, setWorkouts] = useState([]);
  const [userTemplates, setUserTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const [currentView, setCurrentView] = useState('dashboard');
  const [activeWorkoutId, setActiveWorkoutId] = useState(null);
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const isWelcomeSeen = localStorage.getItem('workout_welcome_seen_v2');
    if (!isWelcomeSeen) setShowWelcome(true);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u && isWelcomeSeen) {
        // Если был сбой токена, пробуем восстановить анонимный вход
        signInAnonymously(auth).catch(() => setShowWelcome(true));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const workoutsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'workouts');
    const templatesPath = collection(db, 'artifacts', appId, 'users', user.uid, 'templates');
    const profilePath = collection(db, 'artifacts', appId, 'users', user.uid, 'profile');

    const unsubWorkouts = onSnapshot(workoutsPath, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setWorkouts(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    });

    const unsubTemplates = onSnapshot(templatesPath, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setUserTemplates(data);
    });

    const unsubProfile = onSnapshot(profilePath, (snapshot) => {
      const pDoc = snapshot.docs.find(d => d.id === 'info');
      if (pDoc) setProfileName(pDoc.data().name || '');
    });

    return () => { unsubWorkouts(); unsubTemplates(); unsubProfile(); };
  }, [user]);

  const mergedTemplates = [
    ...DEFAULT_TEMPLATES.filter(dt => !userTemplates.some(ut => ut.keyword.toLowerCase() === dt.keyword.toLowerCase())),
    ...userTemplates
  ];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleStartApp = async () => {
    try {
      await signInAnonymously(auth);
      localStorage.setItem('workout_welcome_seen_v2', 'true');
      setShowWelcome(false);
    } catch (e) {
      alert("Ошибка подключения к базе. Проверьте правильность ключей Firebase.");
    }
  };

  const saveProfileName = async (newName) => {
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { name: newName });
    showToast("Имя сохранено");
  };

  const createWorkout = async () => {
    if (!user) return;
    const newWorkout = {
      name: '', date: new Date().toISOString().split('T')[0],
      exercises: [], appliedTemplates: [], createdAt: Date.now()
    };
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'workouts'), newWorkout);
    setActiveWorkoutId(docRef.id);
    setCurrentView('workout_edit');
  };

  const saveTemplate = async (data) => {
    if (!user) return;
    const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'templates');
    if (activeTemplateId && !activeTemplateId.startsWith('def-')) {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'templates', activeTemplateId), data);
    } else {
      await addDoc(colRef, data);
    }
    setCurrentView('template_list');
    showToast("Шаблон сохранен");
  };

  if (!user && !showWelcome) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">Загрузка...</p>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-blue-600 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-pulse"></div>
        <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl relative z-10 animate-in">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><Dumbbell className="w-12 h-12" /></div>
          <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight leading-none">Фитнес<br/>Дневник</h1>
          <p className="text-gray-500 text-sm font-medium mb-10 leading-relaxed">Отслеживайте прогресс, используйте шаблоны и храните данные в надежном облаке.</p>
          <button onClick={handleStartApp} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl flex items-center justify-center transition-all active:scale-95"><Zap className="w-5 h-5 mr-2" />Начать тренировки</button>
        </div>
      </div>
    );
  }

  const activeWorkout = workouts.find(w => w.id === activeWorkoutId);
  const activeTemplate = mergedTemplates.find(t => t.id === activeTemplateId);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-10 overflow-x-hidden selection:bg-blue-200">
      {toast && <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-2xl text-sm font-bold animate-in slide-in-from-bottom-5 w-[90%] max-w-xs text-center">{toast}</div>}
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-40 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <Dumbbell className="w-6 h-6 shrink-0" /><h1 className="text-xl font-black truncate">Фитнес Дневник</h1>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button onClick={() => setCurrentView('profile')} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 rounded-full flex items-center space-x-2 transition"><User className="w-4 h-4" /><span className="text-sm font-bold hidden sm:inline truncate max-w-[100px]">{profileName || 'Профиль'}</span></button>
            {currentView === 'dashboard' && <button onClick={createWorkout} className="bg-white text-blue-600 px-4 py-2 rounded-full font-bold text-sm flex items-center shadow-sm active:scale-95"><Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Новая</span></button>}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 w-full">
        {currentView === 'dashboard' && <DashboardView workouts={workouts} profileName={profileName} onOpen={(id) => { setActiveWorkoutId(id); setCurrentView('workout_edit'); }} onDelete={(id) => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'workouts', id))} onTemplates={() => setCurrentView('template_list')} loading={loading} />}
        {currentView === 'workout_edit' && <WorkoutEditor workout={activeWorkout} templates={mergedTemplates} onUpdate={(data) => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'workouts', activeWorkoutId), data)} onClose={() => setCurrentView('dashboard')} />}
        {currentView === 'template_list' && <TemplateList templates={mergedTemplates} onEdit={(id) => { setActiveTemplateId(id); setCurrentView('template_edit'); }} onCreate={() => { setActiveTemplateId(null); setCurrentView('template_edit'); }} onDelete={(id) => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'templates', id))} onClose={() => setCurrentView('dashboard')} />}
        {currentView === 'template_edit' && <TemplateEditor template={activeTemplate} onSave={saveTemplate} onClose={() => setCurrentView('template_list')} />}
        {currentView === 'profile' && <ProfileView user={user} profileName={profileName} onSaveName={saveProfileName} onClose={() => setCurrentView('dashboard')} />}
      </main>
    </div>
  );
}

function DashboardView({ workouts, profileName, onOpen, onDelete, onTemplates, loading }) {
  if (loading) return <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8 px-1">
        <div className="flex-1 min-w-0 pr-4">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight truncate">{profileName ? `Привет, ${profileName}!` : 'Ваш прогресс'}</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1 truncate">Тренировок: {workouts.length}</p>
        </div>
        <button onClick={onTemplates} className="shrink-0 text-[10px] font-black bg-white text-blue-600 px-5 py-3 rounded-xl border border-gray-100 shadow-sm uppercase tracking-widest hover:bg-blue-50 transition active:scale-95">Шаблоны</button>
      </div>

      {workouts.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 text-center border border-gray-100 shadow-sm mt-4"><div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6"><Activity className="w-10 h-10" /></div><h3 className="text-lg font-black text-gray-800 mb-2">Журнал пуст</h3><p className="text-gray-400 font-medium text-sm">Нажмите «Новая» в правом верхнем углу, чтобы начать.</p></div>
      ) : (
        <div className="space-y-4">
          {workouts.map(w => (
            <div key={w.id} className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-gray-100 flex items-center justify-between group active:scale-95 transition-transform cursor-pointer" onClick={() => onOpen(w.id)}>
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-black text-lg text-gray-800 truncate">{w.name || 'Тренировка'}</h3>
                <div className="flex items-center flex-wrap gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                  <span className="bg-gray-100 px-2 py-1 rounded-md flex items-center text-gray-500 whitespace-nowrap"><Calendar className="w-3 h-3 mr-1 shrink-0" /> {new Date(w.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                  <span className="flex items-center whitespace-nowrap"><Dumbbell className="w-3 h-3 mr-1 shrink-0" /> {w.exercises?.length || 0} упр.</span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(w.id); }} className="p-3 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0"><Trash2 className="w-5 h-5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutEditor({ workout, templates, onUpdate, onClose }) {
  useEffect(() => {
    if (!workout) return;
    const name = workout.name.toLowerCase();
    const applied = workout.appliedTemplates || [];
    let changed = false; let newExs = [...workout.exercises]; let newApplied = [...applied];
    templates.forEach(t => {
      if (t.keyword && name.includes(t.keyword.toLowerCase()) && !applied.includes(t.keyword)) {
        const tplExs = t.exercises.map(exName => ({ id: `tpl-${Math.random()}`, name: exName, sets: [{ id: `s-${Math.random()}`, weight: 0, reps: 0 }] }));
        newExs = [...newExs, ...tplExs]; newApplied.push(t.keyword); changed = true;
      }
    });
    if (changed) onUpdate({ exercises: newExs, appliedTemplates: newApplied });
  }, [workout?.name]);

  if (!workout) return null;

  const updateEx = (exId, field, val) => onUpdate({ exercises: workout.exercises.map(e => e.id === exId ? { ...e, [field]: val } : e) });
  const moveEx = (idx, dir) => {
    const newExs = [...workout.exercises]; const target = idx + dir;
    if (target < 0 || target >= newExs.length) return;
    [newExs[idx], newExs[target]] = [newExs[target], newExs[idx]];
    onUpdate({ exercises: newExs });
  };
  const addSet = (id) => onUpdate({ exercises: workout.exercises.map(e => e.id === id ? { ...e, sets: [...e.sets, {id:'s-'+Date.now(), weight: e.sets[e.sets.length-1]?.weight || 0, reps: e.sets[e.sets.length-1]?.reps || 0}] } : e) });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onClose} className="flex items-center text-gray-400 font-bold text-sm bg-white px-4 py-2 rounded-full shadow-sm"><ArrowLeft className="w-4 h-4 mr-1" /> Назад</button>
        <button onClick={onClose} className="bg-green-500 text-white px-6 py-2 rounded-full font-black shadow-lg flex items-center active:scale-95 transition-transform"><CheckCircle className="w-4 h-4 mr-2" /> Готово</button>
      </div>

      <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-gray-100 mb-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
        <input className="w-full text-2xl sm:text-3xl font-black border-none focus:ring-0 p-0 mb-4 placeholder-gray-200 min-w-0" value={workout.name} onChange={e => onUpdate({ name: e.target.value })} placeholder="Название..." />
        <input type="date" className="w-full bg-gray-50 border-none rounded-xl p-3 font-bold text-gray-500 min-w-0" value={workout.date} onChange={e => onUpdate({ date: e.target.value })} />
        {workout.appliedTemplates?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {workout.appliedTemplates.map(tag => (
              <span key={tag} className="text-[10px] uppercase font-black bg-green-50 text-green-600 px-3 py-1.5 rounded-full border border-green-100 flex items-center whitespace-nowrap"><CheckCircle className="w-3 h-3 mr-1"/> Шаблон: {tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {workout.exercises.map((ex, idx) => (
          <div key={ex.id} className="bg-white rounded-[1.5rem] overflow-hidden border border-gray-100 shadow-sm w-full">
            <div className="bg-gray-50/50 p-4 flex items-center border-b border-gray-50 flex-wrap sm:flex-nowrap gap-2">
              <div className="flex items-center flex-1 min-w-0 w-full">
                <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-black mr-3 shrink-0">{idx+1}</span>
                <input className="font-black text-gray-800 bg-transparent border-none focus:ring-0 p-0 w-full min-w-0" value={ex.name} onChange={e => updateEx(ex.id, 'name', e.target.value)} placeholder="Упражнение..." />
              </div>
              <div className="flex items-center justify-end space-x-1 sm:ml-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                <button type="button" onClick={() => moveEx(idx, -1)} disabled={idx === 0} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronUp className="w-5 h-5"/></button>
                <button type="button" onClick={() => moveEx(idx, 1)} disabled={idx === workout.exercises.length - 1} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronDown className="w-5 h-5"/></button>
                <button type="button" onClick={() => onUpdate({ exercises: workout.exercises.filter(e => e.id !== ex.id) })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg ml-2"><Trash2 className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex text-[9px] font-black uppercase text-gray-400 mb-2 px-1 text-center w-full">
                <div className="w-1/5 sm:w-2/12">Сет</div><div className="w-2/5 sm:w-4/12 px-1">Вес</div><div className="w-2/5 sm:w-4/12 px-1">Повторы</div><div className="w-1/5 sm:w-2/12"></div>
              </div>
              {ex.sets.map((s, si) => (
                <div key={s.id} className="flex mb-2 items-center px-1 w-full">
                  <div className="w-1/5 sm:w-2/12 text-center font-black text-gray-300 text-xs shrink-0">{si+1}</div>
                  <div className="w-2/5 sm:w-4/12 px-1"><input type="number" className="w-full min-w-0 bg-gray-50 border-none rounded-lg py-2.5 sm:p-3 text-center font-black focus:ring-2 focus:ring-blue-100" value={s.weight || ''} onChange={e => onUpdate({ exercises: workout.exercises.map(exItem => exItem.id === ex.id ? { ...exItem, sets: exItem.sets.map(st => st.id === s.id ? { ...st, weight: Number(e.target.value) } : st) } : exItem) })} placeholder="0" /></div>
                  <div className="w-2/5 sm:w-4/12 px-1"><input type="number" className="w-full min-w-0 bg-gray-50 border-none rounded-lg py-2.5 sm:p-3 text-center font-black focus:ring-2 focus:ring-blue-100" value={s.reps || ''} onChange={e => onUpdate({ exercises: workout.exercises.map(exItem => exItem.id === ex.id ? { ...exItem, sets: exItem.sets.map(st => st.id === s.id ? { ...st, reps: Number(e.target.value) } : st) } : exItem) })} placeholder="0" /></div>
                  <div className="w-1/5 sm:w-2/12 flex justify-center shrink-0"><button type="button" onClick={() => onUpdate({ exercises: workout.exercises.map(exItem => exItem.id === ex.id ? { ...exItem, sets: exItem.sets.filter(st => st.id !== s.id) } : exItem) })} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"><Trash2 className="w-4 h-4" /></button></div>
                </div>
              ))}
              <button type="button" onClick={() => addSet(ex.id)} className="w-full mt-3 py-3 border-2 border-dashed border-gray-200 rounded-xl text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition">+ Добавить подход</button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onUpdate({ exercises: [...workout.exercises, { id: 'm-'+Date.now(), name: '', sets: [{id:'s-'+Date.now(), weight:0, reps:0}] }] })} className="w-full mt-8 bg-blue-600 text-white font-black py-4 rounded-[1.5rem] shadow-xl shadow-blue-200 flex items-center justify-center active:scale-95 transition-all"><Plus className="mr-2 w-5 h-5" /> Добавить упражнение</button>
    </div>
  );
}

function TemplateList({ templates, onEdit, onCreate, onDelete, onClose }) {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onClose} className="flex items-center text-gray-400 font-bold bg-white px-4 py-2 rounded-full shadow-sm"><ArrowLeft className="w-4 h-4 mr-1" /> Назад</button>
        <button onClick={onCreate} className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold shadow-lg text-sm flex items-center active:scale-95 transition-transform"><Plus className="w-4 h-4 mr-1" /> Новый</button>
      </div>
      <h2 className="text-2xl font-black mb-6 text-gray-900">Ваши шаблоны</h2>
      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id || t.keyword} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between w-full">
            <div className="flex-1 min-w-0 pr-4">
              <div className="font-black text-blue-600 text-lg truncate">«{t.keyword}»</div>
              <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest mt-1 truncate">{t.exercises.length} упр.</div>
            </div>
            <div className="flex space-x-2 shrink-0">
              <button onClick={() => onEdit(t.id)} className="p-2.5 bg-gray-50 rounded-xl text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition"><Edit3 className="w-5 h-5" /></button>
              {t.id && !t.id.startsWith('def-') && <button onClick={() => onDelete(t.id)} className="p-2.5 bg-gray-50 rounded-xl text-gray-500 hover:bg-red-50 hover:text-red-500 transition"><Trash2 className="w-5 h-5" /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({ template, onSave, onClose }) {
  const [keyword, setKeyword] = useState(template?.keyword || '');
  const [exs, setExs] = useState(() => {
    const initialExs = template?.exercises || [''];
    return initialExs.map(name => ({ id: Math.random().toString(), name }));
  });

  const handleSave = () => {
    const cleanExercises = exs.map(e => e.name.trim()).filter(Boolean);
    if (!keyword.trim() || cleanExercises.length === 0) { alert("Укажите слово-триггер и добавьте хотя бы 1 упражнение."); return; }
    onSave({ keyword: keyword.trim(), exercises: cleanExercises });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onClose} className="text-gray-400 font-bold bg-white px-4 py-2 rounded-full shadow-sm">Отмена</button>
        <button onClick={handleSave} className="bg-green-500 text-white px-6 py-2.5 rounded-full font-black shadow-lg active:scale-95 transition-transform">Сохранить</button>
      </div>
      <div className="bg-white p-5 sm:p-6 rounded-[2rem] border border-gray-100 mb-6 shadow-sm">
        <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 block">Слово-триггер</label>
        <input className="w-full text-xl sm:text-2xl font-black border-none focus:ring-0 p-0 text-blue-600 placeholder-blue-200 min-w-0" value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Напр: Спина" />
      </div>
      <div className="space-y-3">
        {exs.map((e, i) => (
          <div key={e.id} className="flex items-center space-x-2">
            <input className="flex-1 min-w-0 bg-white border border-gray-100 rounded-xl p-4 shadow-sm text-sm font-bold" value={e.name} onChange={val => { const newExs = [...exs]; newExs[i].name = val.target.value; setExs(newExs); }} placeholder="Упражнение..." />
            <button type="button" onClick={() => setExs(exs.filter(x => x.id !== e.id))} className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition shrink-0"><Trash2 className="w-5 h-5" /></button>
          </div>
        ))}
        <button type="button" onClick={() => setExs([...exs, { id: Math.random().toString(), name: '' }])} className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-black text-[9px] uppercase tracking-widest hover:bg-gray-50 transition">+ Добавить еще</button>
      </div>
    </div>
  );
}

function ProfileView({ user, profileName, onSaveName, onClose }) {
  const [nameInput, setNameInput] = useState(profileName);

  return (
    <div className="animate-in fade-in duration-300 w-full">
      <button onClick={onClose} className="flex items-center text-gray-500 font-bold mb-6 bg-white px-4 py-2 rounded-full shadow-sm w-fit"><ArrowLeft className="w-4 h-4 mr-1" /> Назад</button>
      <div className="bg-white rounded-[2.5rem] p-5 sm:p-8 shadow-sm border border-gray-100 text-center mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-20 sm:h-24 bg-blue-600"></div>
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white border-4 border-white text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10 shadow-lg"><UserCircle className="w-12 h-12 sm:w-16 sm:h-16" /></div>
        <div className="inline-flex items-center space-x-2 bg-green-50 text-green-600 px-4 py-1.5 rounded-full mb-6 sm:mb-8 border border-green-100"><ShieldCheck className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest">Облако Активно</span></div>
        <div className="text-left bg-gray-50 p-4 sm:p-5 rounded-[1.5rem] mb-6">
          <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest block mb-3">Ваше имя</label>
          <div className="flex flex-col gap-3">
            <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Как к вам обращаться?" className="w-full bg-white border-none rounded-xl px-4 py-4 font-bold focus:ring-2 focus:ring-blue-100 text-gray-800" />
            <button type="button" onClick={() => onSaveName(nameInput)} className="w-full bg-blue-600 text-white px-6 py-4 rounded-xl font-black hover:bg-blue-700 transition active:scale-95">Сохранить</button>
          </div>
        </div>
        <div className="text-left bg-gray-50 p-4 sm:p-5 rounded-[1.5rem]">
          <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest block mb-2">Ваш Секретный ID</label>
          <div className="bg-white px-3 sm:px-4 py-3 rounded-xl border border-gray-200 overflow-hidden"><code className="text-[10px] sm:text-xs text-gray-600 font-bold break-all select-all block w-full">{user?.uid}</code></div>
        </div>
      </div>
    </div>
  );
  }