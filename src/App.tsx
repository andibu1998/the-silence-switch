import { useState, ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ArrowLeft, Headphones, Square, Save, CheckCircle, Download } from 'lucide-react';

// --- JWT Utility ---

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT', e);
    return null;
  }
}

// --- Web Audio API Generators ---

let sineAudioCtx: AudioContext | null = null;
let sineOscillator: OscillatorNode | null = null;
let sineGain: GainNode | null = null;

async function playSineWave(freq: number) {
  if (!sineAudioCtx) sineAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (sineAudioCtx.state === 'suspended') {
    await sineAudioCtx.resume();
  }
  
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

async function playBrownNoise(notchFreq: number) {
  if (!brownAudioCtx) brownAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (brownAudioCtx.state === 'suspended') {
    await brownAudioCtx.resume();
  }
  
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

// --- Native Audio Player Component ---

function NativeAudioPlayer({ src, title, album, isSpike, loop }: { src: string, title: string, album: string, isSpike?: boolean, loop?: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && 'mediaSession' in navigator) {
      // Setup Media Session API so it continues to play when the screen is locked
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'The Silence Switch',
        album: album,
        artwork: [
          // Providing a generic fallback artwork from the assets list
          { src: 'https://assets.cdn.filesafe.space/WBcpbvnlBFrQ9DnHZPfH/media/6a0b3756c474827cc404f487.webp', sizes: '512x512', type: 'image/webp' }
        ]
      });

      // Hook up media session controls to the audio element
      navigator.mediaSession.setActionHandler('play', () => {
        audio.play().then(() => setIsPlaying(true)).catch(console.error);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        setIsPlaying(false);
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      }
    };
  }, [title, album]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
    }
  };

  return (
    <>
      <audio 
        ref={audioRef} 
        src={src} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)} 
        onEnded={() => setIsPlaying(false)} 
        loop={loop}
        preload="metadata"
        playsInline
        controls
        className="absolute opacity-0 pointer-events-none w-0 h-0 -z-10"
      />
      
      {isSpike ? (
        <div className="flex flex-col items-center w-full">
          <div onClick={togglePlay} className="orb-button orb-emergency mb-6">
            {isPlaying ? (
              <Square className="w-12 h-12 text-white" fill="currentColor" />
            ) : (
              <Play className="w-12 h-12 text-white ml-2" fill="currentColor" />
            )}
          </div>
          <p className="text-red-200/60 text-sm font-medium">Tap the sphere to play or pause.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full">
          <div onClick={togglePlay} className="orb-button orb-sleep mb-6">
            {isPlaying ? (
              <Square className="w-12 h-12 text-white" fill="currentColor" />
            ) : (
              <Play className="w-12 h-12 text-white ml-2" fill="currentColor" />
            )}
          </div>
          <p className="text-indigo-300/60 text-sm font-medium">Tap the sphere to play or pause.</p>
        </div>
      )}
    </>
  );
}

// --- React Application ---

type View = 'home' | 'daily' | 'spikes' | 'night';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<View>('home');
  const [userName, setUserName] = useState<string>('User');

  useEffect(() => {
    // Check for token in URL using URLSearchParams
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl) {
      // Save token to localStorage
      localStorage.setItem('silence_switch_token', tokenFromUrl);
      
      const payload = parseJwt(tokenFromUrl);
      if (payload) {
        if (payload.contact_id) {
          localStorage.setItem('silence_switch_contact_id', payload.contact_id);
        }
        if (payload.full_name) {
          localStorage.setItem('silence_switch_user_name', payload.full_name);
          setUserName(payload.full_name);
        }
      }
      
      // Clean up the URL by replacing history state to root, hiding token
      window.history.replaceState({}, document.title, window.location.pathname);
      setIsAuthenticated(true);
    } else {
      // Check for existing token
      const existingToken = localStorage.getItem('silence_switch_token');
      if (existingToken) {
        setIsAuthenticated(true);
      }
      const existingName = localStorage.getItem('silence_switch_user_name');
      if (existingName) {
        setUserName(existingName);
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
                  <span className="text-[10px] sm:text-xs font-bold text-zinc-500 tracking-widest uppercase">{userName}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col px-4 gap-4 pb-8 flex-1">
              <Tile
                onClick={() => setCurrentView('daily')}
                className="bg-emerald-50 border-emerald-100 hover:border-emerald-500 text-emerald-900"
                subtitle={<span className="text-emerald-600 text-sm sm:text-lg font-extrabold uppercase tracking-widest mb-1 sm:mb-2 text-center">PROTOCOL</span>}
                title="DAILY ROUTINE"
                description={<span className="text-emerald-800 opacity-80">Your 15-minute reset. Do this every morning.</span>}
                centerText={true}
              />
              <Tile
                onClick={() => setCurrentView('night')}
                className="bg-slate-900 border-slate-700 hover:border-indigo-400 text-white"
                subtitle={<span className="text-indigo-400 text-sm sm:text-lg font-extrabold uppercase tracking-widest mb-1 sm:mb-2 text-center">8-HOUR AUDIO</span>}
                title="SLEEP SUPPORT"
                description={<span className="text-slate-400">Let your brain rewire while you rest.</span>}
                centerText={true}
              />
              <Tile
                onClick={() => setCurrentView('spikes')}
                className="bg-red-600 border-red-400 hover:border-white text-white items-center text-center justify-center p-8 sm:p-10"
                subtitle={<span className="text-red-200 text-sm sm:text-lg font-extrabold uppercase tracking-widest mb-1 sm:mb-2 text-center">EMERGENCY</span>}
                title="WHEN IT SPIKES"
                description={<span className="text-red-100">If the noise gets louder and the panic sets in… press this.</span>}
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
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(
    localStorage.getItem('medical_disclaimer_accepted') === 'true'
  );
  
  useEffect(() => {
    return () => { stopBrownNoise(); };
  }, []);

  const handleBrownPlayPause = async () => {
    if (isPlayingBrown) {
      stopBrownNoise();
      setIsPlayingBrown(false);
    } else {
      const storedFreq = Number(localStorage.getItem('tinnitus_frequency')) || 4000;
      await playBrownNoise(storedFreq);
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
      
      if (!isDisclaimerAccepted) {
        content = (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-32">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none text-emerald-900">
                SAFETY FIRST
              </h1>
              <p className="text-xl md:text-2xl text-emerald-700/80 font-medium leading-relaxed mb-6">
                Before you start your daily routine, watch this quick safety video.
              </p>
              
              <div className="mb-10">
                <video 
                  controls 
                  playsInline
                  poster="https://assets.cdn.filesafe.space/WBcpbvnlBFrQ9DnHZPfH/media/6a0b37564ec36477493e2a97.webp" 
                  className="w-full aspect-video rounded-3xl border-4 border-emerald-100 shadow-sm bg-black object-cover"
                >
                  <source src="https://the-silence-institute.b-cdn.net/Final%20-%20Safety%20Intro.mp4" type="video/mp4" />
                </video>
              </div>

              <button 
                onClick={() => {
                  localStorage.setItem('medical_disclaimer_accepted', 'true');
                  setIsDisclaimerAccepted(true);
                }}
                className="w-full bg-emerald-900 text-white font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest px-4 leading-snug"
              >
                I CONFIRM I'VE WATCHED THIS & I'M CLEARED TO START
              </button>
            </div>
          </div>
        );
      } else {
        content = (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-32">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none text-emerald-900">
                YOUR DAILY RESET
              </h1>
              <p className="text-xl md:text-2xl text-emerald-700/80 font-medium leading-relaxed mb-6">
                Do these three things. In this order. Every day. That's how your nervous system learns to let go.
              </p>
              
              <div className="space-y-6 mb-10">
                <div>
                  <span className="text-emerald-800 font-bold tracking-widest uppercase text-[10px] sm:text-xs mb-2 block">1. THE SOMATIC RELEASE (5 MIN) - Release the physical tension amplifying the sound.</span>
                  <video 
                    controls 
                    playsInline
                    poster="https://assets.cdn.filesafe.space/WBcpbvnlBFrQ9DnHZPfH/media/6a0b37568d08689eb2c8b9d7.webp" 
                    className="w-full aspect-video rounded-3xl border-4 border-emerald-100 shadow-sm bg-black object-cover"
                  >
                    <source src="https://the-silence-institute.b-cdn.net/Final%20-%20Somatic%20Release-1.mp4" type="video/mp4" />
                  </video>
                </div>

                <div>
                  <span className="text-emerald-800 font-bold tracking-widest uppercase text-[10px] sm:text-xs mb-2 block">2. THE NERVOUS SYSTEM RESET (5 MIN) - Teach your brain the ringing isn't a threat.</span>
                  <video 
                    controls 
                    playsInline
                    poster="https://assets.cdn.filesafe.space/WBcpbvnlBFrQ9DnHZPfH/media/6a0b3756c474827cc404f487.webp" 
                    className="w-full aspect-video rounded-3xl border-4 border-emerald-100 shadow-sm bg-black object-cover"
                  >
                    <source src="https://the-silence-institute.b-cdn.net/Final%20-%20Vagus%20Reset.mp4" type="video/mp4" />
                  </video>
                </div>
              </div>

              <span className="text-emerald-800 font-bold tracking-widest uppercase text-xs mb-2 block">3. MY CUSTOM SILENCE AUDIO</span>
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
                  <p className="font-extrabold text-xl sm:text-2xl mb-1 uppercase tracking-widest">MY CUSTOM SILENCE AUDIO</p>
                  <p className="text-emerald-300 text-base sm:text-lg font-medium">{isPlayingBrown ? 'Playing...' : 'Press to play your personalized audio.'}</p>
                </div>
              </button>
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-center text-emerald-800 text-sm font-medium">
                  <strong>What this does:</strong> Every time you listen, your auditory cortex learns to turn the volume down.
                </p>
                <p className="text-center text-emerald-800 text-sm font-medium">
                  ⚠️ No sound? If you're on iPhone, make sure the mute switch isn't on.
                  <br className="my-2" />
                  Note: You can listen to this audio as often as you want throughout the day. Just close your eyes and let it work. We recommend at least one full hour daily for maximum neuroplastic effect.
                </p>
              </div>
            </div>
          </div>
        );
      }
      break;

    case 'spikes':
      bgClass = "bg-red-600 text-white";
      gradientClass = "from-red-600 via-red-600/90 to-transparent";
      buttonClass = "bg-white text-red-700";
      content = (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-32 flex flex-col justify-center">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter uppercase mb-6 leading-none text-white mb-8">
              WHEN IT SPIKES
            </h1>
            <p className="text-2xl md:text-3xl text-red-100 font-medium leading-relaxed mb-12 border-l-4 border-white/50 pl-6">
              The sound just got louder. Your heart's racing. Your brain thinks you're in danger. You're not. This is your emergency brake. Stop what you're doing. Sit down. Press play.
            </p>
            
            <NativeAudioPlayer 
              src="https://the-silence-institute.b-cdn.net/Emergency%20Spike%20Protocol.MP3" 
              title="Emergency Spike Protocol" 
              album="Emergency Audio" 
              isSpike={true} 
            />
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
              NIGHT SUPPORT:<br />DEEP REST
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 font-medium leading-relaxed mb-auto">
              Your brain does its deepest rewiring while you sleep. This audio masks the intrusion. And tells your nervous system it's safe to let go. Set your volume. Let it run all night.
            </p>
            
            <div className="mt-12 bg-slate-800 p-8 rounded-[40px] border-4 border-slate-700 flex flex-col items-center text-center shadow-lg">
              <div className="w-24 h-24 bg-indigo-900/40 rounded-full border-2 border-indigo-500/20 flex items-center justify-center mb-6">
                <Headphones className="w-12 h-12 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-2 uppercase tracking-widest">8-Hour Silent Sleep Audio</h3>
              <p className="text-indigo-300/80 text-lg mb-8 font-medium">Continuous playback. Set it and forget it.</p>
              
              <NativeAudioPlayer 
                src="https://the-silence-institute.b-cdn.net/Silent%20Sleep%20Audio%20(8h).MP3" 
                title="Silent Sleep Audio (8h)" 
                album="Night Support" 
                loop={true} 
              />
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
          <span>BACK TO OVERVIEW</span>
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
  
  const handlePlayPause = async () => {
    if (isPlayingSine) {
      stopSineWave();
      setIsPlayingSine(false);
    } else {
      await playSineWave(frequency);
      setIsPlayingSine(true);
    }
  };
  
  const handleSave = async () => {
    localStorage.setItem('tinnitus_frequency', frequency.toString());
    setIsSaved(true);
    
    // POST Request simulated
    const webhookUrl = import.meta.env.VITE_GHL_WEBHOOK_FREQUENCY_URL;
    if (webhookUrl) {
      const contact_id = localStorage.getItem('silence_switch_contact_id') || 'unknown'; // In a real app we would extract this from JWT
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
  
  const openPdf = () => {
    // Open PDF in a new tab without blocking execution
    window.open("https://assets.cdn.filesafe.space/WBcpbvnlBFrQ9DnHZPfH/media/6a0b338860b3f1e04a9d3d3e.pdf", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-lg mx-auto bg-zinc-950 text-white overflow-y-auto">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6 md:p-10 pb-16">
            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-sm mb-4 block mt-8">Step 1 of 3</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none">
              HERE'S HOW THIS WORKS
            </h1>
            <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-6">
              Watch this short video first. It'll explain everything you need to know before you start.
            </p>
            
            <div className="space-y-6 mb-10">
              <div>
                <span className="text-zinc-500 font-bold tracking-widest uppercase text-xs mb-2 block">Start Here</span>
                <video 
                  controls 
                  playsInline
                  poster="https://assets.cdn.filesafe.space/WBcpbvnlBFrQ9DnHZPfH/media/6a0b3a792e98e28fa1a13b32.webp" 
                  className="w-full aspect-video rounded-3xl border-4 border-zinc-800 bg-black object-cover"
                >
                  <source src="https://the-silence-institute.b-cdn.net/TSI%20-%20Start%20Here.mp4" type="video/mp4" />
                </video>
              </div>
            </div>

            <button onClick={() => setStep(2)} className="mt-auto w-full bg-white text-zinc-900 font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest">
              NEXT: SET UP MY AUDIO
            </button>
          </motion.div>
        )}
        
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6 md:p-10 pb-16">
            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-sm mb-4 block mt-8">Step 2 of 3</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none">
              FIND YOUR FREQUENCY
            </h1>
            <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-6">
              Use the slider below to match the pitch of your tinnitus. Find the tone that sounds closest to what you hear.
            </p>
            
            <div className="bg-zinc-900 p-8 rounded-[40px] border-4 border-zinc-800 mb-6 mt-auto">
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

            <p className="mt-0 mb-6 text-center text-zinc-500 text-sm font-medium px-4">
              ⚠️ No sound? If you're on an iPhone, make sure the mute switch on the side isn't on.
            </p>
            
            {!isSaved ? (
              <button onClick={handleSave} className="w-full bg-indigo-600 text-white font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest flex items-center justify-center gap-3">
                <Save className="w-6 h-6" />
                SAVE MY FREQUENCY
              </button>
            ) : (
              <button onClick={() => { stopSineWave(); setStep(3); }} className="w-full bg-emerald-500 text-white font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest flex items-center justify-center gap-3">
                <CheckCircle className="w-6 h-6" />
                CONTINUE TO STEP 3
              </button>
            )}
          </motion.div>
        )}
        
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6 md:p-10 pb-16">
            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-sm mb-4 block mt-8">Step 3 of 3</span>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter uppercase mb-6 leading-none">
              TRACK YOUR PROGRESS
            </h1>
            <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-6">
              Download the tracker below. Check off each day you complete the protocol.
            </p>
            <p className="text-lg text-zinc-500 font-medium leading-relaxed mb-10 border-l-2 border-zinc-700 pl-4">
              <strong>Why it matters:</strong> This isn't just a checklist. It's proof you're showing up for yourself.
            </p>
            
            <button onClick={openPdf} className="w-full bg-zinc-900 text-white p-8 rounded-[40px] active:scale-[0.98] transition-transform flex flex-col items-center justify-center text-center gap-6 mb-10 border-4 border-zinc-800 mt-auto">
              <div className="bg-zinc-800 w-24 h-24 rounded-full flex items-center justify-center">
                <Download className="w-12 h-12 text-zinc-400" />
              </div>
              <div>
                <span className="block font-extrabold text-xl sm:text-2xl mb-2 tracking-tight uppercase">Download Progress Tracker 2.0</span>
                <span className="block font-bold tracking-widest uppercase text-zinc-500 text-sm">(PDF Document)</span>
              </div>
            </button>
            
            <button onClick={finalizeOnboarding} className="w-full bg-white text-zinc-900 font-extrabold text-xl py-6 rounded-[32px] active:scale-[0.98] transition-transform uppercase tracking-widest">
              FINISH SETUP & START
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
