import { useState, ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ArrowLeft, Headphones, Square, Save, CheckCircle, Download } from 'lucide-react';

// --- Web Audio API Generators ---

let sineAudioCtx: AudioContext | null = null;
let sineOscillator: OscillatorNode | null = null;
let sineGain: GainNode | null = null;

function playSineWave(freq: number) {
  if (!sineAudioCtx) sineAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (sineAudioCtx.state === 'suspended') sineAudioCtx.resume();
  
  if (sineOscillator) stopSineWave();
  
  sineOscillator = sineAudioCtx.createOscillator();
  sineOscillator.type = 'sine';
  sineOscillator.frequency.value = freq;
  
  sineGain = sineAudioCtx.createGain();
  sineGain.gain.value = 0.05; // Keep it very soft
  
  sineOscillator.connect(sineGain);
  sineGain.connect(sineAudioCtx.destination);
  sineOscillator.start();
}

function updateSineFreq(freq: number) {
  if (sineOscillator) {
    sineOscillator.frequency.value = freq;
  }
}

function stopSineWave() {
  if (sineOscillator) {
    try { sineOscillator.stop(); } catch(e) {}
    sineOscillator.disconnect();
    sineOscillator = null;
  }
  if (sineGain) {
    sineGain.disconnect();
    sineGain = null;
  }
}

let brownAudioCtx: AudioContext | null = null;
let brownBufferSource: AudioBufferSourceNode | null = null;
let brownNotchFilter: BiquadFilterNode | null = null;
let brownGain: GainNode | null = null;

function playBrownNoise(notchFreq: number) {
  if (!brownAudioCtx) brownAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (brownAudioCtx.state === 'suspended') brownAudioCtx.resume();
  
  if (brownBufferSource) stopBrownNoise();
  
  // Create 5 seconds of brown noise buffer
  const bufferSize = brownAudioCtx.sampleRate * 5;
  const noiseBuffer = brownAudioCtx.createBuffer(1, bufferSize, brownAudioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Simple brown noise integration
    output[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5; // Gain compensation
  }
  
  brownBufferSource = brownAudioCtx.createBufferSource();
  brownBufferSource.buffer = noiseBuffer;
  brownBufferSource.loop = true;
  
  brownNotchFilter = brownAudioCtx.createBiquadFilter();
  brownNotchFilter.type = 'notch';
  brownNotchFilter.frequency.value = notchFreq;
  brownNotchFilter.Q.value = 2; // Medium width for the notch
  
  brownGain = brownAudioCtx.createGain();
  brownGain.gain.value = 1.0;
  
  brownBufferSource.connect(brownNotchFilter);
  brownNotchFilter.connect(brownGain);
  brownGain.connect(brownAudioCtx.destination);
  
  brownBufferSource.start();
}

function stopBrownNoise() {
  if (brownBufferSource) {
    try { brownBufferSource.stop(); } catch(e) {}
    brownBufferSource.disconnect();
    brownBufferSource = null;
  }
  if (brownNotchFilter) {
    brownNotchFilter.disconnect();
    brownNotchFilter = null;
  }
  if (brownGain) {
    brownGain.disconnect();
    brownGain = null;
  }
}

// --- React Application ---

type View = 'home' | 'daily' | 'spikes' | 'night';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<View>('home');

  useEffect(() => {
    // Check for token in URL using URLSearchParams
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl) {
      // Save token to localStorage
      localStorage.setItem('silence_switch_token', tokenFromUrl);
      
      // Clean up the URL by replacing history state to root, hiding token
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticated(true);
    } else {
      // Check for existing token
      const existingToken = localStorage.getItem('silence_switch_token');
      if (existingToken) {
        setIsAuthenticated(true);
      }
    }
    
    // Check Onboarding State
    if (localStorage.getItem('onboarding_completed') === 'true') {
      setIsOnboardingCompleted(true);
    }
    
    setIsInitializing(false);
  }, []);

  if (isInitializing) {
    return <div className="min-h-screen bg-black" />; // Black background to prevent flashing
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <p className="text-white font-medium text-lg leading-relaxed max-w-sm">
          Access Denied. Please use the secure link sent to your phone.
        </p>
      </div>
    );
  }

  if (!isOnboardingCompleted) {
    return <OnboardingView onComplete={() => setIsOnboardingCompleted(true)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 font-sans antialiased touch-manipulation overflow-hidden">
      <AnimatePresence mode="popLayout">
        {currentView === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-zinc-100 overflow-y-auto"
          >
            <div className="flex justify-between items-center px-4 py-6 shrink-0 mb-2">
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tighter text-zinc-900 uppercase">The Silence Switch</h1>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-500 tracking-widest uppercase">Portal Active</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col px-4 gap-4 pb-8 flex-1">
              <Tile
                onClick={() => setCurrentView('daily')}
                className="bg-emerald-50 border-emerald-100 hover:border-emerald-500 text-emerald-900"
                subtitle={<span className="text-emerald-600 text-sm sm:text-lg font-extrabold uppercase tracking-widest mb-1 sm:mb-2 text-center">Protocol</span>}
                title="DAILY ROUTINE"
                description={<span className="text-emerald-800 opacity-80">Rewire your nervous system.</span>}
                centerText={true}
              />
              <Tile
                onClick={() => setCurrentView('night')}
                className="bg-slate-900 border-slate-700 hover:border-indigo-400 text-white"
                subtitle={<span className="text-indigo-400 text-sm sm:text-lg font-extrabold uppercase tracking-widest mb-1 sm:mb-2 text-center">8-Hour Audio</span>}
                title="SLEEP SUPPORT"
                description={<span className="text-slate-400">Engineered audio for deep rest.</span>}
                centerText={true}
              />
              <Tile
                onClick={() => setCurrentView('spikes')}
                className="bg-red-600 border-red-400 hover:border-white text-white items-center text-center justify-center p-8 sm:p-10"
                subtitle={<span className="text-red-200 text-sm sm:text-lg font-extrabold uppercase tracking-widest mb-1 sm:mb-2 text-center">Emergency</span>}
                title="WHEN IT SPIKES"
                description={<span className="text-red-100">Press immediately for the emergency brake.</span>}
                centerText={true}
              />
            </div>
          </motion.div>
        ) : (
          <DetailView
            key="detail"
            view={currentView}
            onBack={() => setCurrentView('home')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Tile Component ---

function Tile({ title, subtitle, description, className, onClick, centerText }: { title: string; subtitle: ReactNode; description: ReactNode; className: string; onClick: () => void; centerText?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[180px] sm:min-h-[200px] w-full rounded-[32px] sm:rounded-[40px] shadow-sm flex flex-col justify-end p-6 sm:p-8 border-4 transition-transform duration-100 ease-in-out active:scale-[0.98] ${centerText ? 'text-center items-center justify-center' : 'text-left'} ${className}`}
    >
      {subtitle}
      <h2 className={`text-4xl sm:text-5xl font-extrabold uppercase leading-none mb-2 ${centerText ? 'mb-4' : 'mb-2'}`}>
        {title}
      </h2>
      <p className="text-base sm:text-xl font-medium">
        {description}
      </p>
    </button>
  );
}

// --- Detail View Component ---

function DetailView({ view, onBack }: { view: Exclude<View, 'home'>; onBack: () => void }) {
  const [isPlayingBrown, setIsPlayingBrown] = useState(false);
  
  useEffect(() => {
    return () => { stopBrownNoise(); };
  }, []);

  const handleBrownPlayPause = () => {
    if (isPlayingBrown) {
      stopBrownNoise();
      setIsPlayingBrown(false);
    } else {
      const storedFreq = Number(localStorage.getItem('tinnitus_frequency')) || 4000;
      playBrownNoise(storedFreq);
      setIsPlayingBrown(true);
    }
  };

  let content = null;
  let bgClass = "bg-white text-zinc-900";
  let gradientClass = "from-white via-white/90 to-transparent";
  let buttonClass = "bg-zinc-900 text-white hover:bg-zinc-800";

  switch (view) {
    case 'daily':
      bgClass = "bg-emerald-50 text-emerald-900";
      gradientClass = "from-emerald-50 via-emerald-50/90 to-transparent";
      buttonClass = "bg-emerald-900 text-emerald-50 hover:bg-emerald-800";
      content = (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-32">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none text-emerald-900">
              Your Daily Reset Protocol
            </h1>
            <p className="text-xl md:text-2xl text-emerald-700/80 font-medium leading-relaxed mb-10">
              Consistency is how we rewire your nervous system. These daily tools lower your baseline stress.
            </p>
            
            <div className="space-y-6 mb-10">
              <div className="bg-white aspect-video rounded-3xl border-4 border-emerald-100 shadow-sm flex items-center justify-center relative">
                <Play className="w-16 h-16 text-emerald-300" />
                <span className="absolute bottom-4 left-6 text-emerald-600 font-extrabold tracking-widest uppercase text-xs">Somatic Release</span>
              </div>
              <div className="bg-white aspect-video rounded-3xl border-4 border-emerald-100 shadow-sm flex items-center justify-center relative">
                <Play className="w-16 h-16 text-emerald-300" />
                <span className="absolute bottom-4 left-6 text-emerald-600 font-extrabold tracking-widest uppercase text-xs">Nervous System Reset</span>
              </div>
            </div>

            <button 
              onClick={handleBrownPlayPause}
              className="w-full bg-emerald-900 text-white p-6 sm:p-8 rounded-[32px] border-4 border-emerald-700 shadow-lg flex flex-col items-center gap-6 active:scale-[0.98] transition-transform"
            >
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shrink-0 border-4 border-emerald-700 ${isPlayingBrown ? 'bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]' : 'bg-emerald-800'}`}>
                {isPlayingBrown ? (
                    <Square className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white" />
                ) : (
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white ml-2" />
                )}
              </div>
              <div className="text-center">
                <p className="font-extrabold text-xl sm:text-2xl mb-1 uppercase tracking-widest">My Custom Silence Audio</p>
                <p className="text-emerald-300 text-base sm:text-lg font-medium">{isPlayingBrown ? 'Playing...' : 'Press to play customized audio'}</p>
              </div>
            </button>
          </div>
        </div>
      );
      break;

    case 'spikes':
      bgClass = "bg-red-600 text-white";
      gradientClass = "from-red-600 via-red-600/90 to-transparent";
      buttonClass = "bg-white text-red-700";
      content = (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-32 flex flex-col justify-center">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter uppercase mb-6 leading-none text-white mb-8">
              Emergency Protocol:<br />When It Spikes
            </h1>
            <p className="text-2xl md:text-3xl text-red-100 font-medium leading-relaxed mb-12 border-l-4 border-white/50 pl-6">
              Spikes happen. When the noise suddenly gets louder, your brain's natural reaction is panic. This is your emergency brake. Stop what you are doing, sit down, and press play immediately.
            </p>
            
            <button className="w-full aspect-square md:aspect-auto md:h-80 bg-red-700 rounded-[40px] border-4 border-red-500 flex flex-col items-center justify-center active:scale-[0.98] transition-transform shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-red-600 to-red-800" />
              <Play className="w-32 h-32 text-white relative z-10 mb-4 ml-4" />
              <span className="text-white relative z-10 font-extrabold tracking-widest uppercase text-xl">Press Play Now</span>
            </button>
          </div>
        </div>
      );
      break;

    case 'night':
      bgClass = "bg-slate-900 text-white";
      gradientClass = "from-slate-900 via-slate-900/90 to-transparent";
      buttonClass = "bg-indigo-500 text-white";
      content = (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-32 flex flex-col">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none text-white">
              Night Support:<br />Deep Rest
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 font-medium leading-relaxed mb-auto">
              Sleep is when your body heals. This audio track is engineered to mask the intrusion and signal to your brain that it is safe to sleep. Set your volume and let it run all night.
            </p>
            
            <div className="mt-12 bg-slate-800 p-8 rounded-[40px] border-4 border-slate-700 flex flex-col items-center text-center shadow-lg">
              <div className="w-24 h-24 bg-indigo-900/40 rounded-full border-2 border-indigo-500/20 flex items-center justify-center mb-6">
                <Headphones className="w-12 h-12 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-2 uppercase tracking-widest">8-Hour Silent Sleep Audio</h3>
              <p className="text-indigo-300/80 text-lg mb-8 font-medium">Continuous playback</p>
              
              <button className="w-full bg-indigo-600 text-white font-extrabold text-2xl py-6 rounded-[32px] active:scale-[0.98] transition-transform shadow-[0_0_40px_rgba(79,70,229,0.2)] uppercase tracking-widest">
                Start Audio
              </button>
            </div>
          </div>
        </div>
      );
      break;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`fixed inset-0 w-full h-[100dvh] flex flex-col max-w-lg mx-auto ${bgClass} shadow-2xl`}
    >
      {content}
      
      {/* Massive Fixed Back Button */}
      <div className={`absolute bottom-0 w-full p-4 bg-gradient-to-t ${gradientClass} pb-8`}>
        <button 
          onClick={onBack}
          className={`w-full font-extrabold text-xl py-6 rounded-[32px] flex items-center justify-center gap-4 active:scale-[0.98] transition-transform shadow-xl uppercase tracking-widest border-4 border-transparent ${buttonClass}`}
        >
          <ArrowLeft className="w-8 h-8" />
          <span>Zurück zur Übersicht</span>
        </button>
      </div>
    </motion.div>
  );
}

// --- Onboarding Component ---

function OnboardingView({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [frequency, setFrequency] = useState(4000);
  const [isPlayingSine, setIsPlayingSine] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  useEffect(() => {
    return () => { stopSineWave(); }; // cleanup
  }, []);
  
  useEffect(() => {
    if (isPlayingSine) {
      updateSineFreq(frequency);
    }
  }, [frequency, isPlayingSine]);
  
  const handlePlayPause = () => {
    if (isPlayingSine) {
      stopSineWave();
      setIsPlayingSine(false);
    } else {
      playSineWave(frequency);
      setIsPlayingSine(true);
    }
  };
  
  const handleSave = async () => {
    localStorage.setItem('tinnitus_frequency', frequency.toString());
    setIsSaved(true);
    
    // POST Request simulated
    const webhookUrl = import.meta.env.VITE_GHL_WEBHOOK_FREQUENCY_URL;
    if (webhookUrl) {
      const contact_id = 'placeholder_id'; // In a real app we would extract this from JWT
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frequency, contact_id })
        });
      } catch(e) {
        console.error("Webhook Error: ", e);
      }
    }
  };

  const finalizeOnboarding = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onComplete();
  };
  
  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-zinc-950 text-white overflow-y-auto">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6 md:p-10 pb-16">
            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-sm mb-4 block mt-8">Schritt 1 von 3</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none">
              Wie dieser Prozess funktioniert
            </h1>
            <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-10">
              Bitte sehen Sie sich dieses Video vollständig an, bevor Sie fortfahren.
            </p>
            <div className="bg-black aspect-video rounded-3xl border-4 border-zinc-800 flex items-center justify-center mb-10 shrink-0">
              <Play className="w-16 h-16 text-zinc-600" />
            </div>
            <button onClick={() => setStep(2)} className="mt-auto w-full bg-white text-zinc-900 font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest">
              Weiter zu Schritt 2: Mein Audio einstellen
            </button>
          </motion.div>
        )}
        
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6 md:p-10 pb-16">
            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-sm mb-4 block mt-8">Schritt 2 von 3</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none">
              Finden Sie Ihre Frequenz
            </h1>
            <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-10">
              Verwenden Sie den Schieberegler, um den Ton an Ihren Tinnitus anzupassen. Suchen Sie die Frequenz, die ihm am nächsten kommt.
            </p>
            
            <div className="bg-zinc-900 p-8 rounded-[40px] border-4 border-zinc-800 mb-10 mt-auto">
              <div className="flex justify-between items-center mb-10">
                <span className="text-3xl font-mono font-bold text-white">{frequency} Hz</span>
                <button onClick={handlePlayPause} className={`w-20 h-20 rounded-full flex items-center justify-center border-4 border-transparent transition-colors ${isPlayingSine ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                  {isPlayingSine ? <Square className="w-8 h-8 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white ml-2" />}
                </button>
              </div>
              
              <input 
                type="range" 
                min="1000" 
                max="10000" 
                step="10" 
                value={frequency} 
                onChange={(e) => setFrequency(Number(e.target.value))} 
                className="w-full h-4 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
            
            {!isSaved ? (
              <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest flex items-center justify-center gap-3">
                <Save className="w-6 h-6" />
                Das ist meine Frequenz speichern
              </button>
            ) : (
              <button onClick={() => { stopSineWave(); setStep(3); }} className="w-full bg-emerald-500 text-white font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest flex items-center justify-center gap-3">
                <CheckCircle className="w-6 h-6" />
                Weiter zu Schritt 3
              </button>
            )}
          </motion.div>
        )}
        
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6 md:p-10 pb-16">
            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-sm mb-4 block mt-8">Schritt 3 von 3</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none">
              Messen Sie Ihren Erfolg
            </h1>
            <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-10">
              Laden Sie sich den Progress Tracker herunter, um Ihre Fortschritte wöchentlich zu messen.
            </p>
            
            <button className="w-full bg-zinc-900 text-white p-8 rounded-[40px] active:scale-[0.98] transition-transform flex flex-col items-center justify-center text-center gap-6 mb-10 border-4 border-zinc-800 mt-auto">
              <div className="bg-zinc-800 w-24 h-24 rounded-full flex items-center justify-center">
                <Download className="w-12 h-12 text-zinc-400" />
              </div>
              <div>
                <span className="block font-extrabold text-xl sm:text-2xl mb-2 tracking-tight uppercase">Download Progress Tracker 2.0</span>
                <span className="block font-bold tracking-widest uppercase text-zinc-500 text-sm">(PDF Document)</span>
              </div>
            </button>
            
            <button onClick={finalizeOnboarding} className="w-full bg-white text-zinc-900 font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest">
              Onboarding abschließen & App starten
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
