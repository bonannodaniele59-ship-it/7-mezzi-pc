
import React, { useState, useEffect, useCallback } from 'react';
// Corrected casing to match PascalCase component filenames
import Layout from './components/Layout';
import TripForm from './components/TripForm';
import { analyzeMaintenanceTrends, suggestNoteOptimization } from './services/geminiService';
import { syncTripToGoogleSheets, generateTripsCSV, uploadCSVToCloud } from './services/syncService';
import { Trip, TripStatus, Vehicle, Volunteer, INITIAL_VEHICLES, INITIAL_VOLUNTEERS, AppSettings } from './types';

type View = 'DASHBOARD' | 'NEW_TRIP' | 'END_TRIP' | 'ADMIN' | 'ANALYSIS';

const ADMIN_PASSWORD_DEFAULT = 'leini';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // States for database management
  const [newVolunteer, setNewVolunteer] = useState({ name: '', surname: '' });
  const [newVehicle, setNewVehicle] = useState({ plate: '', model: '' });

  const [trips, setTrips] = useState<Trip[]>(() => {
    const saved = localStorage.getItem('prociv_trips');
    return saved ? JSON.parse(saved) : [];
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('prociv_vehicles');
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });

  const [volunteers, setVolunteers] = useState<Volunteer[]>(() => {
    const saved = localStorage.getItem('prociv_volunteers');
    return saved ? JSON.parse(saved) : INITIAL_VOLUNTEERS;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('prociv_settings');
    const defaultSettings: AppSettings = { 
      googleScriptUrl: '', 
      adminPassword: ADMIN_PASSWORD_DEFAULT,
      notificationsEnabled: false, 
      maxTripDurationHours: 4, 
      standardEndTime: '20:00' 
    };
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => {
    const saved = localStorage.getItem('prociv_trips');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.find((t: Trip) => t.status === TripStatus.ACTIVE) || null;
    }
    return null;
  });

  useEffect(() => localStorage.setItem('prociv_trips', JSON.stringify(trips)), [trips]);
  useEffect(() => localStorage.setItem('prociv_vehicles', JSON.stringify(vehicles)), [vehicles]);
  useEffect(() => localStorage.setItem('prociv_volunteers', JSON.stringify(volunteers)), [volunteers]);
  useEffect(() => localStorage.setItem('prociv_settings', JSON.stringify(settings)), [settings]);

  const getTitle = () => {
    switch (currentView) {
      case 'DASHBOARD': return 'Logbook Mezzi';
      case 'NEW_TRIP': return 'Nuova Uscita';
      case 'END_TRIP': return 'Registra Rientro';
      case 'ADMIN': return 'Banca Dati & Admin';
      case 'ANALYSIS': return 'Analisi Logistica IA';
      default: return 'Protezione Civile';
    }
  };

  const handleAddVolunteer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVolunteer.name || !newVolunteer.surname) return;
    const v: Volunteer = {
      id: 'v' + Date.now(),
      name: newVolunteer.name.trim(),
      surname: newVolunteer.surname.trim()
    };
    setVolunteers(prev => [...prev, v]);
    setNewVolunteer({ name: '', surname: '' });
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicle.plate || !newVehicle.model) return;
    const v: Vehicle = {
      id: 'm' + Date.now(),
      plate: newVehicle.plate.trim().toUpperCase(),
      model: newVehicle.model.trim()
    };
    setVehicles(prev => [...prev, v]);
    setNewVehicle({ plate: '', model: '' });
  };

  const checkAdminPassword = (action: () => void) => {
    if (isAdminAuth) {
      action();
      return;
    }
    const pwd = window.prompt("Password Amministratore:");
    const requiredPwd = settings.adminPassword || ADMIN_PASSWORD_DEFAULT;
    if (pwd === requiredPwd) {
      setIsAdminAuth(true);
      action();
    } else if (pwd !== null) {
      alert("Password errata!");
    }
  };

  const handleSaveTrip = async (tripData: Partial<Trip>) => {
    if (tripData.status === TripStatus.COMPLETED) {
      const completedTrip = tripData as Trip;
      let optimizedNotes = completedTrip.notes;
      if (completedTrip.notes && completedTrip.notes.length > 5) {
        optimizedNotes = await suggestNoteOptimization(completedTrip.notes);
      }
      const finalTrip = { ...completedTrip, notes: optimizedNotes };
      setTrips(prev => prev.map(t => t.id === finalTrip.id ? finalTrip : t));
      setActiveTrip(null);
      if (settings.googleScriptUrl) {
        const vehicle = vehicles.find(v => v.id === finalTrip.vehicleId);
        await syncTripToGoogleSheets(finalTrip, vehicle, settings.googleScriptUrl);
      }
    } else {
      const newTrip = tripData as Trip;
      setTrips(prev => [newTrip, ...prev]);
      setActiveTrip(newTrip);
    }
    setCurrentView('DASHBOARD');
  };

  // Triggers the AI analysis of all recorded trips
  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    try {
      const summary = await analyzeMaintenanceTrends(trips);
      setAiSummary(summary);
      setCurrentView('ANALYSIS');
    } catch (error) {
      console.error("Analysis error:", error);
      alert("Errore durante l'analisi IA");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <Layout 
      title={getTitle()}
      onBack={currentView !== 'DASHBOARD' ? () => setCurrentView('DASHBOARD') : undefined}
      actions={currentView === 'DASHBOARD' && (
        <button onClick={() => checkAdminPassword(() => setCurrentView('ADMIN'))} className="p-3 text-white bg-blue-700/80 rounded-full shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      )}
    >
      {currentView === 'DASHBOARD' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-8 flex flex-col items-center text-center">
            {activeTrip ? (
              <div className="w-full bg-blue-600 rounded-3xl p-6 text-white text-left relative overflow-hidden shadow-2xl">
                <div className="absolute right-[-20px] bottom-[-20px] text-8xl opacity-10 rotate-12">{activeTrip.icon}</div>
                <div className="relative z-10">
                  <span className="px-3 py-1 bg-white text-blue-600 text-[10px] font-black rounded-full uppercase mb-4 inline-block tracking-widest animate-pulse">In Servizio</span>
                  <p className="text-sm font-black mb-1">{vehicles.find(v => v.id === activeTrip.vehicleId)?.plate}</p>
                  <p className="text-xl font-black mb-6">{activeTrip.destination}</p>
                  <button onClick={() => setCurrentView('END_TRIP')} className="w-full bg-yellow-400 text-blue-900 py-4 rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-all">Registra Rientro</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCurrentView('NEW_TRIP')} className="w-full bg-blue-600 text-white py-7 rounded-[2.5rem] font-black text-xl shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all">AVVIA NUOVA MISSIONE</button>
            )}
          </div>

          <div className="space-y-3 px-2">
            <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-widest px-2">Ultimi Servizi</h3>
            {trips.filter(t => t.status === TripStatus.COMPLETED).slice(0, 5).map(trip => (
              <div key={trip.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-xl">{trip.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-blue-900 text-sm">{vehicles.find(v => v.id === trip.vehicleId)?.plate}</p>
                  <p className="text-[10px] text-gray-400 font-bold truncate uppercase">{trip.reason} - {trip.driverName}</p>
                </div>
                <p className="text-sm font-black text-gray-700">{(trip.endKm || 0) - trip.startKm} KM</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {currentView === 'NEW_TRIP' && <TripForm onSave={handleSaveTrip} vehicles={vehicles} volunteers={volunteers} />}
      {currentView === 'END_TRIP' && activeTrip && <TripForm onSave={handleSaveTrip} activeTrip={activeTrip} vehicles={vehicles} volunteers={volunteers} />}
      
      {currentView === 'ADMIN' && (
        <div className="space-y-6 pb-10 animate-in slide-in-from-right">
          
          {/* Banca Dati Mezzi */}
          <section className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-lg space-y-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Database Mezzi</h3>
             </div>
             
             <form onSubmit={handleAddVehicle} className="flex gap-2">
                <input 
                  type="text" placeholder="Targa" 
                  className="flex-1 text-xs p-3 rounded-xl border-2 border-gray-50 font-bold outline-none focus:border-blue-500"
                  value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})}
                />
                <input 
                  type="text" placeholder="Modello" 
                  className="flex-[2] text-xs p-3 rounded-xl border-2 border-gray-50 font-bold outline-none focus:border-blue-500"
                  value={newVehicle.model} onChange={e => setNewVehicle({...newVehicle, model: e.target.value})}
                />
                <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl font-black">+</button>
             </form>

             <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                {vehicles.map(v => (
                  <div key={v.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-[10px] font-bold text-gray-700"><span className="text-blue-600">{v.plate}</span> - {v.model}</div>
                    <button onClick={() => setVehicles(prev => prev.filter(item => item.id !== v.id))} className="text-red-400 font-black">×</button>
                  </div>
                ))}
             </div>
          </section>

          {/* Banca Dati Autisti */}
          <section className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-lg space-y-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-2xl flex items-center justify-center text-yellow-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Database Autisti</h3>
             </div>
             
             <form onSubmit={handleAddVolunteer} className="flex gap-2">
                <input 
                  type="text" placeholder="Nome" 
                  className="flex-1 text-xs p-3 rounded-xl border-2 border-gray-50 font-bold outline-none focus:border-blue-500"
                  value={newVolunteer.name} onChange={e => setNewVolunteer({...newVolunteer, name: e.target.value})}
                />
                <input 
                  type="text" placeholder="Cognome" 
                  className="flex-1 text-xs p-3 rounded-xl border-2 border-gray-50 font-bold outline-none focus:border-blue-500"
                  value={newVolunteer.surname} onChange={e => setNewVolunteer({...newVolunteer, surname: e.target.value})}
                />
                <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl font-black">+</button>
             </form>

             <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                {volunteers.map(v => (
                  <div key={v.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-[10px] font-bold text-gray-700">{v.name} {v.surname}</div>
                    <button onClick={() => setVolunteers(prev => prev.filter(item => item.id !== v.id))} className="text-red-400 font-black">×</button>
                  </div>
                ))}
             </div>
          </section>

          {/* Cloud & Backup */}
          <section className="bg-blue-900 p-6 rounded-[2.5rem] text-white shadow-2xl space-y-4">
             <h3 className="text-xs font-black uppercase tracking-widest text-blue-200">Export & Cloud</h3>
             <div className="grid grid-cols-2 gap-2">
                <button onClick={() => {
                  const csv = generateTripsCSV(trips, vehicles);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `logbook_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                }} className="bg-blue-800 p-4 rounded-2xl text-[10px] font-black uppercase">Scarica CSV</button>
                
                <button onClick={async () => {
                   if (!settings.googleScriptUrl) return alert("URL Cloud mancante!");
                   setIsExporting(true);
                   const csv = generateTripsCSV(trips, vehicles);
                   await uploadCSVToCloud(csv, settings.googleScriptUrl);
                   setIsExporting(false);
                   alert("Backup inviato!");
                }} className="bg-yellow-500 text-blue-900 p-4 rounded-2xl text-[10px] font-black uppercase" disabled={isExporting}>
                  {isExporting ? 'Invio...' : 'Backup Cloud'}
                </button>
             </div>

             {/* AI Logistic Analysis Trigger */}
             <button 
                onClick={handleAiAnalysis} 
                className="w-full bg-blue-600/50 hover:bg-blue-600 border border-blue-400 p-4 rounded-2xl text-[10px] font-black uppercase transition-colors"
                disabled={isAiLoading}
             >
                {isAiLoading ? 'Analisi in corso...' : '✨ Analisi Logistica IA'}
             </button>

             <input 
                type="text" placeholder="URL Google Apps Script" 
                className="w-full text-[10px] p-4 rounded-xl border-none text-blue-900 font-bold outline-none"
                value={settings.googleScriptUrl} onChange={e => setSettings({...settings, googleScriptUrl: e.target.value})}
             />
          </section>

          <button 
            onClick={() => { if(window.confirm("Resettare tutti i dati locali?")) { localStorage.clear(); window.location.reload(); } }}
            className="w-full bg-red-50 text-red-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-100"
          >
            Svuota Database Locale
          </button>
        </div>
      )}

      {currentView === 'ANALYSIS' && aiSummary && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4 animate-in fade-in">
          <h2 className="font-black uppercase tracking-widest text-sm text-blue-600">✨ Analisi Logistica IA</h2>
          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <p className="text-sm text-gray-700 leading-relaxed italic">{aiSummary}</p>
          </div>
          <button onClick={() => setCurrentView('DASHBOARD')} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl uppercase">Torna alla Dashboard</button>
        </div>
      )}
    </Layout>
  );
};

export default App;
