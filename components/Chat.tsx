import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Chat } from '@google/genai';
import type { ChatMessage, TextPart, ChatPart } from '../types';
import { Icon } from './Icon';
import { MarkdownRenderer } from './MarkdownRenderer';
import { CodeRunner } from './CodeRunner';
import { useSettings } from '../App';

// Fix for SpeechRecognition API not being in standard TS DOM types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface MessageProps {
  message: ChatMessage;
  onRunCode: (code: string, lang: string) => void;
  onEdit: (messageId: string, newText: string) => void;
  onDelete: (messageId: string) => void;
}

const Message: React.FC<MessageProps> = ({ message, onRunCode, onEdit, onDelete }) => {
  const { settings } = useSettings();
  const accentColor = settings.accentColor;
  const isModel = message.role === 'model';
  
  const textPart = message.parts.find(p => 'text' in p) as TextPart | undefined;
  const textContent = message.parts.reduce((acc, part) => ('text' in part ? acc + part.text : acc), '');


  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(textPart?.text || '');

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(textContent.replace(/```[\s\S]*?```/g, 'Code block.'));
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in your browser.');
    }
  };
  
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(textPart?.text || '');
  };
  
  const handleSaveEdit = () => {
    if (editText.trim()) {
        onEdit(message.id, editText);
        setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      onDelete(message.id);
    }
  };

  return (
    <div className={`group flex items-start gap-3 my-4 ${isModel ? '' : 'flex-row-reverse'}`}>
      <div className={`p-2 rounded-full ${isModel ? `bg-${accentColor}-600` : 'bg-gray-500 dark:bg-gray-600'}`}>
        <Icon icon={isModel ? 'spark' : 'voice_chat'} className="w-5 h-5 text-white" />
      </div>
      <div className={`p-4 rounded-xl max-w-full space-y-2 ${isModel ? 'bg-gray-200 dark:bg-gray-800' : `bg-${accentColor}-600 text-white`}`}>
        {!isEditing ? (
            message.parts.map((part, index) => {
                if ('inlineData' in part) {
                    return (
                        <img 
                            key={index} 
                            src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                            alt="User upload" 
                            className="max-w-xs rounded-lg shadow-md"
                        />
                    );
                }
                if ('text' in part) {
                    return <MarkdownRenderer key={index} content={part.text} onRunCode={onRunCode} />;
                }
                return null;
            })
        ) : (
          <div className="w-full">
            <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-white/50 focus:outline-none"
                rows={Math.max(3, editText.split('\n').length)}
            />
            <div className="flex justify-end gap-2 mt-2">
                <button onClick={handleCancelEdit} className="px-3 py-1 text-xs rounded-md bg-gray-500 hover:bg-gray-400 text-white">Cancel</button>
                <button onClick={handleSaveEdit} className="px-3 py-1 text-xs rounded-md bg-green-500 hover:bg-green-400 text-white">Save</button>
            </div>
          </div>
        )}
      </div>
       <div className={`flex items-center gap-1 self-center transition-opacity duration-200 opacity-0 group-hover:opacity-100 ${isModel ? 'flex-row-reverse' : ''}`}>
           <button onClick={handleCopy} title="Copy" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Icon icon="copy" className="w-4 h-4" /></button>
           <button onClick={handleSpeak} title="Speak" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Icon icon="volume_up" className="w-4 h-4" /></button>
           {!isModel && textPart && <button onClick={handleEdit} title="Edit" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Icon icon="edit" className="w-4 h-4" /></button>}
           <button onClick={handleDelete} title="Delete" className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><Icon icon="delete" className="w-4 h-4" /></button>
       </div>
    </div>
  );
};

interface ChatComponentProps {
    chatSession: Chat | null;
    history: ChatMessage[];
    onHistoryUpdate: (newHistory: ChatMessage[]) => void;
    onEditMessage: (messageId: string, newText: string) => void;
    onDeleteMessage: (messageId: string) => void;
}

export const ChatComponent: React.FC<ChatComponentProps> = ({ chatSession, history: initialHistory, onHistoryUpdate, onEditMessage, onDeleteMessage }) => {
  const [history, setHistory] = useState<ChatMessage[]>(initialHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningCode, setRunningCode] = useState<{code: string, lang: string} | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const { settings } = useSettings();
  const accentColor = settings.accentColor;
  
  useEffect(() => {
    setHistory(initialHistory);
    setRunningCode(null); // Close runner when switching chats
  }, [initialHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
             setInput(prev => prev.trim() ? `${prev.trim()} ${finalTranscript.trim()}` : finalTranscript.trim());
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
    };
    
    recognition.onend = () => {
        setIsListening(false);
    }

    recognitionRef.current = recognition;

    return () => {
        recognition.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
        recognitionRef.current?.stop();
    } else {
        recognitionRef.current?.start();
    }
    setIsListening(!isListening);
  };


  const handleRunCode = (code: string, lang: string) => {
      setRunningCode({ code, lang });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const removeImage = () => {
      setImageFile(null);
      setImagePreview(null);
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || !chatSession || (!input.trim() && !imageFile)) return;
    
    const userParts: ChatPart[] = [];
    if (imageFile && imagePreview) {
        userParts.push({
            inlineData: {
                mimeType: imageFile.type,
                data: imagePreview.substring(imagePreview.indexOf(',') + 1),
            }
        });
    }
    if (input.trim()) {
        userParts.push({ text: input });
    }

    const nextId = `${chatSession.model}-${Date.now()}`;
    const userMessage: ChatMessage = { id: nextId, role: 'user', parts: userParts };
    const newHistory = [...history, userMessage];
    setHistory(newHistory);
    setInput('');
    removeImage();
    setLoading(true);
    setError(null);
    
    onHistoryUpdate(newHistory);

    try {
      const result = await chatSession.sendMessageStream({ message: userParts });
      let currentModelMessage = '';
      
      const modelMessage: ChatMessage = { id: `${nextId}-model`, role: 'model', parts: [{ text: '' }]};
      let finalHistory = [...newHistory, modelMessage];
      setHistory(finalHistory);

      for await (const chunk of result) {
        currentModelMessage += chunk.text;
        finalHistory[finalHistory.length - 1] = {
            ...modelMessage,
            parts: [{ text: currentModelMessage }],
        };
        setHistory([...finalHistory]);
      }
      onHistoryUpdate(finalHistory);
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = 'Sorry, something went wrong. Please check your network or try again later.';
      setError(errorMessage);
      const errorHistory = [...newHistory, { id: 'error-msg', role: 'model', parts: [{ text: errorMessage }] }];
      setHistory(errorHistory);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <div className="flex flex-col h-[calc(100vh-180px)] md:h-[calc(100vh-140px)] w-full max-w-4xl mx-auto bg-white dark:bg-gray-800/50 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex-1 p-6 overflow-y-auto">
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon icon="spark" className={`w-16 h-16 text-${accentColor}-500 mb-4`} />
              <h2 className="text-2xl font-bold">Nexa AI Chat</h2>
              <p className="text-gray-500 dark:text-gray-400">Start a conversation by typing your message below.</p>
            </div>
          )}
          {history.map((msg) => (
            <Message key={msg.id} message={msg} onRunCode={handleRunCode} onEdit={onEditMessage} onDelete={onDeleteMessage} />
          ))}
          {loading && history[history.length - 1]?.role === 'user' && (
            <div className="flex items-start gap-3 my-4">
               <div className={`p-2 rounded-full bg-${accentColor}-600`}>
                  <Icon icon='spark' className="w-5 h-5 text-white" />
               </div>
               <div className="p-4 rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center space-x-2">
                 <div className="w-2 h-2 bg-gray-600 dark:bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 <div className="w-2 h-2 bg-gray-600 dark:bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                 <div className="w-2 h-2 bg-gray-600 dark:bg-white rounded-full animate-bounce"></div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mb-2">{error}</p>}
          
          {imagePreview && (
            <div className="relative inline-block mb-2">
                <img src={imagePreview} alt="upload preview" className="h-20 w-auto rounded-lg" />
                <button onClick={removeImage} className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1 leading-none">
                    <Icon icon="close" className="w-4 h-4" />
                </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden"/>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`p-3 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors`}
              title="Attach Image"
            >
                <Icon icon="attachment" className="w-6 h-6" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nexa AI anything..."
              className={`flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-${accentColor}-500 focus:outline-none`}
              disabled={loading}
            />
            <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-lg transition-colors ${isListening ? `bg-red-500 text-white` : `bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500`}`}
                title="Speech to Text"
            >
                <Icon icon="mic" className="w-6 h-6" />
            </button>
            <button
              type="submit"
              disabled={loading || (!input.trim() && !imageFile)}
              className={`p-3 bg-${accentColor}-600 rounded-lg disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-${accentColor}-500 transition-colors`}
            >
              <Icon icon="send" className="w-6 h-6 text-white" />
            </button>
          </form>
        </div>
      </div>
      {runningCode && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center backdrop-blur-sm" onClick={() => setRunningCode(null)}>
            <div 
                className="absolute top-[25%] bottom-[25%] left-[15%] right-[15%]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gray-900 rounded-lg shadow-2xl w-full h-full overflow-hidden border border-gray-700">
                    <CodeRunner 
                        code={runningCode.code}
                        lang={runningCode.lang}
                        onClose={() => setRunningCode(null)}
                    />
                </div>
            </div>
        </div>
      )}
    </>
  );
};