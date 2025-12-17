'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onError?: (error: string) => void;
  onTranscriptionComplete?: (userText: string, botReply: string, audioBase64?: string) => void;
  disabled?: boolean;
  className?: string;
  businessId?: string;
  sessionId?: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingStart,
  onRecordingStop,
  onError,
  onTranscriptionComplete,
  disabled = false,
  className = '',
  businessId,
  sessionId
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Helper function to send audio to server
  const sendAudioToServer = async (audioBlob: Blob): Promise<void> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'user_input.webm');
    
    // Add businessId and sessionId if provided
    if (businessId) {
      formData.append('businessId', businessId);
    }
    if (sessionId) {
      formData.append('sessionId', sessionId);
    }
    
    try {
      const response = await fetch('/api/voice-to-text', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Voice-to-text response:', result);
      
      if (result.success) {
        // Call the transcription complete callback with user text, bot reply, and audio
        onTranscriptionComplete?.(result.userText, result.botReply, result.audio);
        console.log('Transcription completed successfully');
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
      
    } catch (error) {
      console.error('Error processing voice input:', error);
      onError?.(`Failed to process voice input: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      setIsProcessing(true);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      setHasPermission(true);
      streamRef.current = stream;
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Validate file size (max 1MB)
          if (audioBlob.size > 1024 * 1024) {
            onError?.('Recording too long. Please keep it under 5 seconds.');
            return;
          }
          
          // Send to server
          await sendAudioToServer(audioBlob);
          
        } catch (error) {
          console.error('Error processing audio:', error);
          onError?.(`Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsProcessing(false);
          onRecordingStop?.();
        }
      };
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      onRecordingStart?.();
      
      console.log('MediaRecorder started, state:', mediaRecorder.state);
      
      // Auto-stop after 5 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        console.log('Auto-stop timeout triggered');
        stopRecording();
      }, 5000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setHasPermission(false);
      onError?.(`Microphone access denied or not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsProcessing(false);
    }
  };

  // Stop recording
  const stopRecording = () => {
    console.log('Stop recording called. MediaRecorder exists:', !!mediaRecorderRef.current, 'Is recording:', isRecording);
    
    // Immediately update UI state for instant response
    setIsRecording(false);
    
    if (mediaRecorderRef.current) {
      console.log('Stopping MediaRecorder...');
      try {
        // Check if MediaRecorder is actually recording
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        } else {
          console.log('MediaRecorder not in recording state:', mediaRecorderRef.current.state);
        }
      } catch (error) {
        console.error('Error stopping MediaRecorder:', error);
      }
      
      if (recordingTimeoutRef.current) {
        console.log('Clearing timeout...');
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
    } else {
      console.log('No MediaRecorder to stop');
    }
  };

  // Toggle recording
  const toggleRecording = () => {
    console.log('Toggle recording called. Current state:', { isRecording, isProcessing, disabled });
    
    if (disabled || isProcessing) {
      console.log('Recording disabled or processing');
      return;
    }
    
    // Force stop if MediaRecorder exists and is recording, regardless of state
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('Force stopping recording...');
      stopRecording();
    } else if (isRecording) {
      console.log('Stopping recording...');
      stopRecording();
    } else {
      console.log('Starting recording...');
      startRecording();
    }
  };

  // Handle permission state
  const getButtonState = () => {
    if (disabled) return 'disabled';
    if (isProcessing) return 'processing';
    if (hasPermission === false) return 'denied';
    if (isRecording) return 'recording';
    return 'ready';
  };

  const buttonState = getButtonState();

  return (
    <button
      onClick={toggleRecording}
      disabled={disabled || isProcessing}
      className={`
        p-2 rounded-full transition-all duration-200 flex items-center justify-center
        ${className}
        ${
          buttonState === 'recording'
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            : buttonState === 'processing'
            ? 'bg-yellow-500 text-white cursor-not-allowed'
            : buttonState === 'denied'
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : buttonState === 'disabled'
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-700'
        }
      `}
      title={
        buttonState === 'recording'
          ? 'Click to stop recording'
          : buttonState === 'processing'
          ? 'Processing audio...'
          : buttonState === 'denied'
          ? 'Microphone access denied'
          : buttonState === 'disabled'
          ? 'Voice recording disabled'
          : 'Click to start recording'
      }
    >
      {buttonState === 'recording' ? (
        <MicOff className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
};

export default VoiceRecorder;
