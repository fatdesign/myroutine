import { useState, useEffect, useRef } from 'react';

export const useAudioDrone = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    return () => {
      stopDrone(); // Cleanup on unmount
    };
  }, []);

  const startDrone = () => {
    if (audioCtxRef.current) return; // Already playing

    // Initialize AudioContext
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 4); // Fade in
    masterGain.connect(ctx.destination);
    gainNodeRef.current = masterGain;

    // Create 432Hz base frequency + slight detunes for a mystic drone effect
    const frequencies = [108, 216, 432, 436]; // Sub-octaves and slightly detuned for binaural beating
    
    frequencies.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = freq > 300 ? 'sine' : 'triangle'; // Deep base, smooth high
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      const panner = ctx.createStereoPanner();
      panner.pan.value = (Math.random() * 0.4) - 0.2; // Slight stereo spread

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.1 + Math.random() * 0.2; // Slow modulation
      
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.02; // Modulate pitch slightly

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(panner);
      panner.connect(masterGain);

      osc.start();
      lfo.start();
      oscillatorsRef.current.push(osc, lfo);
    });

    setIsPlaying(true);
  };

  const stopDrone = () => {
    if (!audioCtxRef.current || !gainNodeRef.current) return;

    // Fade out
    const ctx = audioCtxRef.current;
    gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, ctx.currentTime);
    gainNodeRef.current.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);

    setTimeout(() => {
      oscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      oscillatorsRef.current = [];
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      setIsPlaying(false);
    }, 2000);
  };

  const toggleDrone = () => {
    if (isPlaying) stopDrone();
    else startDrone();
  };

  return { isPlaying, toggleDrone };
};
