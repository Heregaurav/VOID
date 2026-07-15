import { useEffect, useRef, useState, useCallback } from 'react';

export function useAudio() {
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Oscillators and Nodes
  const droneOscRef = useRef<OscillatorNode | null>(null);
  const droneGainRef = useRef<GainNode | null>(null);
  
  const heartbeatTimerRef = useRef<any>(null);

  const initAudio = () => {
    if (audioCtxRef.current) return;
    
    // Create Audio Context
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    // 1. Setup deep ambient drone hum (Limbo / Backrooms style)
    const droneOsc = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 55; // deep A1 note
    
    filter.type = 'lowpass';
    filter.frequency.value = 80; // filter high frequencies for a muffled rumble

    droneGain.gain.value = 0.05; // low volume background rumble

    droneOsc.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(ctx.destination);
    
    droneOsc.start();
    
    droneOscRef.current = droneOsc;
    droneGainRef.current = droneGain;

    // 2. Setup periodic low thud heartbeat (Little Nightmares style)
    let beatToggle = true;
    const playHeartbeat = () => {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
      
      const now = ctx.currentTime;
      // Play a double thud: "lub-dub"
      const playThud = (time: number, freq: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.35);
        
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.35);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(time);
        osc.stop(time + 0.4);
      };

      // "Lub-dub" thuds
      playThud(now, 60, 0.25);
      playThud(now + 0.22, 50, 0.2);

      // Determine next heartbeat interval based on state (random variance)
      const nextInterval = beatToggle ? 1200 : 1400;
      beatToggle = !beatToggle;
      heartbeatTimerRef.current = setTimeout(playHeartbeat, nextInterval);
    };

    playHeartbeat();
  };

  const toggleAudio = useCallback(() => {
    if (!isEnabled) {
      // Initialize or resume
      if (!audioCtxRef.current) {
        initAudio();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setIsEnabled(true);
    } else {
      // Suspend
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend();
      }
      setIsEnabled(false);
    }
  }, [isEnabled]);

  // Audio Static trigger for alerts/matching
  const playRadioStatic = useCallback((duration: number = 0.5) => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
    
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    
    // Create White Noise Buffer
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1.0;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start(now);
    noise.stop(now + duration);
  }, []);

  // Creepy sound cue for new messages
  const playWhisperCue = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'suspended') return;
    
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.4);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }, []);

  useEffect(() => {
    return () => {
      if (heartbeatTimerRef.current) {
        clearTimeout(heartbeatTimerRef.current);
      }
      if (droneOscRef.current) {
        try {
          droneOscRef.current.stop();
        } catch {}
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return {
    isEnabled,
    toggleAudio,
    playRadioStatic,
    playWhisperCue
  };
}
