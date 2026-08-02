import { useState, useRef, useEffect } from 'react';
import { Headphones, Play, Pause, Volume2, VolumeX, SkipForward, SkipBack, Music, Disc, Sparkles } from 'lucide-react';

export interface AudioTrack {
  id: string;
  title: string;
  subtitle: string;
  fileName: string;
  url: string;
  category: string;
}

const DEFAULT_TRACKS: AudioTrack[] = [
  {
    id: 'tape-8',
    title: 'Tape #8: Problem Solving',
    subtitle: 'Wave II: Threshold',
    fileName: 'GATEWAY TAPE #8 PROBLEM SOLVING ｜ WAVE II： THRESHOLD ｜ #gatewayexperience #gatewaytapes #hemisync.mp3',
    url: '/audio/GATEWAY TAPE #8 PROBLEM SOLVING ｜ WAVE II： THRESHOLD ｜ #gatewayexperience #gatewaytapes #hemisync.mp3',
    category: 'Wave II'
  },
  {
    id: 'tape-9',
    title: 'Tape #9: One-Month Patterning',
    subtitle: 'Wave II: Threshold',
    fileName: 'GATEWAY TAPE #9 ONE-MONTH PATTERNING _ WAVE II_ THRESHOLD _ #gatewayexperience #hemisync.mp3',
    url: '/audio/GATEWAY TAPE #9 ONE-MONTH PATTERNING _ WAVE II_ THRESHOLD _ #gatewayexperience #hemisync.mp3',
    category: 'Wave II'
  },
  {
    id: 'tape-11',
    title: 'Tape #11: Energy Bar Tool (EBT)',
    subtitle: 'Wave II: Threshold',
    fileName: 'GATEWAY TAPE #11 ENERGY BAR TOOL (EBT) ｜ WAVE II： THRESHOLD ｜ #gatewayexperience #hemisync.mp3',
    url: '/audio/GATEWAY TAPE #11 ENERGY BAR TOOL (EBT) ｜ WAVE II： THRESHOLD ｜ #gatewayexperience #hemisync.mp3',
    category: 'Wave II'
  },
  {
    id: 'tape-13',
    title: 'Tape #13: Liftoff',
    subtitle: 'Wave III: Freedom',
    fileName: 'GATEWAY TAPE #13 LIFTOFF ｜ WAVE III： FREEDOM ｜ #gatewayexperience #gatewaytapes #hemisync.mp3',
    url: '/audio/GATEWAY TAPE #13 LIFTOFF ｜ WAVE III： FREEDOM ｜ #gatewayexperience #gatewaytapes #hemisync.mp3',
    category: 'Wave III'
  },
  {
    id: 'tape-19',
    title: 'Tape #19: One-Year Patterning',
    subtitle: 'Wave IV: Adventure',
    fileName: 'GATEWAY TAPE #19 ONE-YEAR PATTERNING ｜ WAVE IV： ADVENTURE ｜ #gatewayexperience #hemisync.mp3',
    url: '/audio/GATEWAY TAPE #19 ONE-YEAR PATTERNING ｜ WAVE IV： ADVENTURE ｜ #gatewayexperience #hemisync.mp3',
    category: 'Wave IV'
  }
];

export function AudioDashboard() {
  const [tracks] = useState<AudioTrack[]>(DEFAULT_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = tracks[currentTrackIndex] || tracks[0];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(err => console.warn('Audio play error:', err));
    }
  };

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(err => console.warn('Play error:', err));
      }
    }, 100);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handlePrev = () => {
    const nextIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    handleTrackSelect(nextIndex);
  };

  const handleNext = () => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    handleTrackSelect(nextIndex);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '24px 28px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(18, 18, 22, 0.9) 100%)',
        border: '1px solid rgba(124, 58, 237, 0.3)',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--heroui-violet) 0%, #4c1d95 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)'
          }}>
            <Headphones size={26} style={{ color: '#fff' }} />
          </div>
          <div>
            <h2 className="gradient-text" style={{ fontSize: '1.6rem', margin: 0, fontWeight: 700 }}>
              Audio & Fokus Player
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
              Entspannung, Binaurale Beats & Konzentrationstracks
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge-pill" style={{ background: 'rgba(124, 58, 237, 0.2)', border: '1px solid rgba(124, 58, 237, 0.4)', color: '#c4b5fd' }}>
            <Disc size={14} style={{ marginRight: '6px' }} /> {tracks.length} Audiospuren
          </span>
        </div>
      </div>

      {/* Hidden HTML5 Audio Element */}
      <audio
        ref={audioRef}
        src={currentTrack ? encodeURI(currentTrack.url) : ''}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleNext}
        onLoadedMetadata={handleTimeUpdate}
      />

      {/* Now Playing Main Card */}
      {currentTrack && (
        <div className="glass-panel" style={{
          padding: '32px 28px',
          marginBottom: '28px',
          background: 'linear-gradient(180deg, rgba(24, 24, 32, 0.95) 0%, rgba(15, 15, 20, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle Ambient Glow */}
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '20px' }}>
            {/* Spinning Disc Visualizer Icon */}
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(30, 27, 75, 0.8) 100%)',
              border: '2px solid rgba(167, 139, 250, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isPlaying ? '0 0 30px rgba(124, 58, 237, 0.5)' : 'none',
              transition: 'all 0.3s ease',
              animation: isPlaying ? 'spin 12s linear infinite' : 'none'
            }}>
              <Music size={40} style={{ color: 'var(--heroui-violet-light)' }} />
            </div>

            <div>
              <span className="badge-pill" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--heroui-violet-light)', marginBottom: '8px', display: 'inline-block', fontSize: '0.75rem' }}>
                {currentTrack.category}
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0', color: '#fff' }}>
                {currentTrack.title}
              </h3>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
                {currentTrack.subtitle}
              </p>
            </div>

            {/* Scrubber / Timeline Slider */}
            <div style={{ width: '100%', maxWidth: '600px', margin: '8px 0' }}>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                style={{
                  width: '100%',
                  height: '6px',
                  accentColor: 'var(--heroui-violet)',
                  cursor: 'pointer',
                  borderRadius: '4px'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                type="button"
                onClick={handlePrev}
                className="action-btn"
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                title="Vorheriger Track"
              >
                <SkipBack size={20} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--heroui-violet) 0%, #6d28d9 100%)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 6px 24px rgba(124, 58, 237, 0.5)',
                  transition: 'transform 0.15s ease'
                }}
                title={isPlaying ? 'Pause' : 'Abspielen'}
              >
                {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '4px' }} />}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="action-btn"
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                title="Nächster Track"
              >
                <SkipForward size={20} />
              </button>
            </div>

            {/* Volume Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                style={{
                  width: '100px',
                  height: '4px',
                  accentColor: 'var(--heroui-violet)',
                  cursor: 'pointer'
                }}
              />
            </div>

          </div>
        </div>
      )}

      {/* Playlist Section */}
      <div className="glass-panel" style={{
        padding: '24px',
        background: 'rgba(24, 24, 27, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px'
      }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 16px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--heroui-violet-light)' }} /> Audio Playlist ({tracks.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tracks.map((t, idx) => {
            const isSelected = idx === currentTrackIndex;
            return (
              <div
                key={t.id}
                onClick={() => handleTrackSelect(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid rgba(124, 58, 237, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: isSelected ? 'var(--heroui-violet)' : 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? '#fff' : 'var(--text-muted)'
                  }}>
                    {isSelected && isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: isSelected ? 0 : '2px' }} />}
                  </div>

                  <div>
                    <div style={{ fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? '#fff' : 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t.subtitle}
                    </div>
                  </div>
                </div>

                <span className="badge-pill" style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                  {t.category}
                </span>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
