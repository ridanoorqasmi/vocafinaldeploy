'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  audioBase64?: string;
  className?: string;
  autoPlay?: boolean;
  showControls?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBase64,
  className = '',
  autoPlay = true,
  showControls = true
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Convert base64 to audio URL
  useEffect(() => {
    if (audioBase64) {
      try {
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (error) {
        console.error('Error converting base64 to audio:', error);
      }
    }
  }, [audioBase64]);

  // Auto-play when audio is ready
  useEffect(() => {
    if (audioUrl && autoPlay && !isMuted) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      
      audio.addEventListener('play', () => {
        setIsPlaying(true);
      });
      
      audio.addEventListener('pause', () => {
        setIsPlaying(false);
      });
      
      // Auto-play with a small delay for better UX
      const playTimeout = setTimeout(() => {
        audio.play().catch(error => {
          console.warn('Auto-play failed:', error);
        });
      }, 100);
      
      return () => {
        clearTimeout(playTimeout);
        audio.pause();
        audio.remove();
      };
    }
  }, [audioUrl, autoPlay, isMuted]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => {
          console.warn('Play failed:', error);
        });
      }
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  if (!audioBase64 || !audioUrl) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showControls && (
        <>
          <button
            onClick={togglePlay}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            title={isPlaying ? 'Pause audio' : 'Play audio'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-gray-600" />
            ) : (
              <Play className="w-4 h-4 text-gray-600" />
            )}
          </button>
          
          <button
            onClick={toggleMute}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-gray-600" />
            ) : (
              <Volume2 className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </>
      )}
      
      {/* Hidden audio element for playback */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="auto"
        muted={isMuted}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default AudioPlayer;

