import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import { Icon } from './Icon';
import { decode, decodeAudioData, createBlob } from '../utils/audio';
import { Loader } from './Loader';
import type { TranscriptTurn } from '../types';
import { useSettings } from '../App';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';
type VoiceStatus = 'Idle' | 'Listening' | 'Speaking' | 'Connecting...';

interface VoiceAssistantProps {
    history: TranscriptTurn[];
    onHistoryUpdate: (newHistory: TranscriptTurn[]) => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ history, onHistoryUpdate }) => {
    const { settings } = useSettings();
    const accentColor = settings.accentColor;
    const voice = settings.voice;

    const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
    const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('Idle');
    const [error, setError] = useState<string | null>(null);
    
    const [currentInputTranscription, setCurrentInputTranscription] = useState('');
    const [currentOutputTranscription, setCurrentOutputTranscription] = useState('');

    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const nextStartTimeRef = useRef(0);
    const sourcesRef = useRef(new Set<AudioBufferSourceNode>());

    const stopConversation = useCallback(() => {
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => {
                session.close();
            });
            sessionPromiseRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        
        if(mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }

        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }

        setConnectionState('idle');
        setVoiceStatus('Idle');
    }, []);

    const startConversation = async () => {
        if (connectionState !== 'idle' && connectionState !== 'error' && connectionState !== 'closed') return;

        setConnectionState('connecting');
        setVoiceStatus('Connecting...');
        setError(null);
        setCurrentInputTranscription('');
        setCurrentOutputTranscription('');
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: async () => {
                        setConnectionState('connected');
                        
                        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(streamRef.current!);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            setVoiceStatus('Speaking');
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            source.addEventListener('ended', () => sourcesRef.current.delete(source));
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            sourcesRef.current.add(source);
                        }
                        
                        let tempInput = '';
                        let tempOutput = '';
                        
                        if (message.serverContent?.inputTranscription) {
                            setVoiceStatus('Listening');
                            tempInput = message.serverContent.inputTranscription.text;
                            setCurrentInputTranscription(prev => prev + tempInput);
                        }
                        if (message.serverContent?.outputTranscription) {
                             setVoiceStatus('Speaking');
                             tempOutput = message.serverContent.outputTranscription.text;
                            setCurrentOutputTranscription(prev => prev + tempOutput);
                        }

                        if (message.serverContent?.turnComplete) {
                            setVoiceStatus('Listening');
                            const fullInput = currentInputTranscription + tempInput;
                            const fullOutput = currentOutputTranscription + tempOutput;
                            
                            if (fullInput.trim() || fullOutput.trim()) {
                                onHistoryUpdate([...history, { user: fullInput, model: fullOutput }]);
                            }
                            setCurrentInputTranscription('');
                            setCurrentOutputTranscription('');
                        }

                        if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(source => source.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError('A connection error occurred. Please check your network and try starting the conversation again.');
                        setConnectionState('error');
                        setVoiceStatus('Idle');
                        stopConversation();
                    },
                    onclose: (e: CloseEvent) => {
                        setConnectionState('closed');
                        setVoiceStatus('Idle');
                        stopConversation();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                    },
                }
            });
            sessionPromiseRef.current = sessionPromise;

        } catch (err: unknown) {
            console.error('Failed to start conversation:', err);
            let errorMessage = 'An unexpected error occurred.';
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.includes('Permission denied')) {
                    errorMessage = 'Microphone access was denied. Please allow microphone permissions in your browser settings and try again.';
                } else {
                    errorMessage = err.message;
                }
            }
            setError(errorMessage);
            setConnectionState('error');
            setVoiceStatus('Idle');
        }
    };
    
    useEffect(() => {
        return () => {
          stopConversation();
        };
      }, [stopConversation]);

    const getButtonContent = () => {
        switch (connectionState) {
            case 'idle':
            case 'closed':
            case 'error':
                return <><Icon icon="mic" className="w-6 h-6 mr-2" /> Start Conversation</>;
            case 'connecting':
                return <><Loader text='' /> Connecting...</>;
            case 'connected':
                return <><Icon icon="stop" className="w-6 h-6 mr-2" /> Stop Conversation</>;
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
                <div className="relative inline-block">
                     <Icon icon="audio_spark" className={`w-16 h-16 mx-auto text-${accentColor}-500 mb-4`} />
                     {connectionState === 'connected' && voiceStatus === 'Listening' && (
                        <div className={`absolute inset-0 w-16 h-16 mx-auto rounded-full border-2 border-${accentColor}-400 animate-ping`}></div>
                     )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Live Voice Assistant</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-2">Have a real-time conversation with Gemini. Press start to begin.</p>
                <p className={`text-${accentColor}-500 dark:text-${accentColor}-300 font-semibold h-6 mb-4`}>{voiceStatus}</p>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Assistant voice can be changed in the main Settings panel.</p>

                <button 
                    onClick={connectionState === 'connected' ? stopConversation : startConversation}
                    className={`px-6 py-3 bg-${accentColor}-600 text-white rounded-lg font-semibold hover:bg-${accentColor}-500 transition-colors flex items-center justify-center mx-auto`}
                >
                    {getButtonContent()}
                </button>
                {error && <div className="mt-4 p-3 bg-red-200 dark:bg-red-900/50 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}
            </div>
            <div className="bg-white dark:bg-gray-800/50 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 min-h-[300px]">
                <h3 className="text-lg font-semibold mb-4">Conversation Transcript</h3>
                <div className="space-y-4">
                    {history.map((turn, index) => (
                        <div key={index} className="space-y-1">
                            {turn.user && <p className="p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg"><strong className={`text-${accentColor}-600 dark:text-${accentColor}-400`}>You:</strong> {turn.user}</p>}
                            {turn.model && <p className="p-3 bg-gray-200/60 dark:bg-gray-700/50 rounded-lg"><strong className="text-teal-600 dark:text-teal-400">AI:</strong> {turn.model}</p>}
                        </div>
                    ))}
                     {currentInputTranscription && <p className="p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg"><strong className={`text-${accentColor}-600 dark:text-${accentColor}-400`}>You:</strong> <span className="text-gray-500 dark:text-gray-400 italic">{currentInputTranscription}</span></p>}
                    {currentOutputTranscription && <p className="p-3 bg-gray-200/60 dark:bg-gray-700/50 rounded-lg"><strong className="text-teal-600 dark:text-teal-400">AI:</strong> <span className="text-gray-500 dark:text-gray-400 italic">{currentOutputTranscription}</span></p>}
                    {connectionState === 'connected' && history.length === 0 && !currentInputTranscription &&
                     <p className="text-gray-500 dark:text-gray-500">Listening... Say "hello" to start!</p>
                    }
                     {connectionState !== 'connected' && history.length === 0 &&
                     <p className="text-gray-500 dark:text-gray-500 text-center">Transcript will appear here when you start a conversation.</p>
                    }
                </div>
            </div>
        </div>
    );
};
