import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { auth, db } from './firebase';

import { ChatComponent } from './components/Chat';
import { ImageStudio } from './components/ImageStudio';
import { VideoStudio } from './components/VideoStudio';
import { VoiceAssistant } from './components/VoiceAssistant';
import { Search } from './components/Search';
import { Sidebar } from './components/Sidebar';
import { Icon } from './components/Icon';
import { Auth } from './components/Auth';
import { Loader } from './components/Loader';
import { ModelDropdown } from './components/ModelDropdown';
import type { Tab, ChatMessage, ChatSummary, TranscriptTurn, VoiceChatSummary, Settings, Theme, AppFont, AccentColor, VoiceChoice, TextPart } from './types';

// Settings Context
const defaultSettings: Settings = {
  theme: 'dark',
  font: 'sans',
  accentColor: 'indigo',
  voice: 'Kore',
};

const SettingsContext = createContext<{
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}>({
  settings: defaultSettings,
  setSettings: () => {},
});

export const useSettings = () => useContext(SettingsContext);

const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const savedSettings = localStorage.getItem('nexa-ai-settings');
      return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('nexa-ai-settings', JSON.stringify(settings));
    // Fix: Added curly braces to the catch block to fix syntax error.
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }

    // Apply styles to document
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
    }
    
    const fontFamilies = {
      sans: 'Inter, sans-serif',
      serif: 'Lora, serif',
      mono: '"Roboto Mono", monospace',
    };
    document.body.style.fontFamily = fontFamilies[settings.font];

  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};


// MODAL COMPONENT
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-800 rounded-lg shadow-2xl w-full max-w-lg m-4 text-gray-900 dark:text-gray-100" onClick={(e) => e.stopPropagation()}>
                <header className="flex justify-between items-center p-4 border-b border-gray-700 dark:border-gray-800">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700 dark:hover:bg-gray-700">
                        <Icon icon="close" className="w-6 h-6" />
                    </button>
                </header>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

// SETTINGS PANEL COMPONENT
const SettingsPanel: React.FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const { settings, setSettings } = useSettings();

    const handleSettingChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const accentColors: AccentColor[] = ['indigo', 'sky', 'emerald', 'rose', 'amber'];
    const fonts: { id: AppFont, name: string }[] = [{id: 'sans', name: 'Inter'}, {id: 'serif', name: 'Lora'}, {id: 'mono', name: 'Roboto Mono'}];
    const voices: { id: VoiceChoice, name: string }[] = [{id: 'Kore', name: 'Female'}, {id: 'Zephyr', name: 'Male'}];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Settings">
            <div className="space-y-6">
                {/* Theme Selection */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Theme</h3>
                    <div className="flex gap-2 p-1 bg-gray-700 dark:bg-gray-800 rounded-lg">
                        <button onClick={() => handleSettingChange('theme', 'light')} className={`w-full p-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 ${settings.theme === 'light' ? 'bg-white text-black' : ''}`}>
                           <Icon icon="light_mode" className="w-5 h-5"/> Light
                        </button>
                        <button onClick={() => handleSettingChange('theme', 'dark')} className={`w-full p-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 ${settings.theme === 'dark' ? 'bg-black text-white' : ''}`}>
                           <Icon icon="dark_mode" className="w-5 h-5"/> Dark
                        </button>
                    </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Accent Color</h3>
                    <div className="flex justify-around items-center">
                        {accentColors.map(color => (
                            <button key={color} onClick={() => handleSettingChange('accentColor', color)} className={`w-8 h-8 rounded-full bg-${color}-500 transition-transform transform hover:scale-110 ${settings.accentColor === color ? 'ring-2 ring-offset-2 ring-offset-gray-800 dark:ring-offset-gray-900 ring-white' : ''}`}></button>
                        ))}
                    </div>
                </div>
                
                 {/* Font Choice */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Font</h3>
                     <div className="flex gap-2 p-1 bg-gray-700 dark:bg-gray-800 rounded-lg">
                        {fonts.map(font => (
                             <button key={font.id} onClick={() => handleSettingChange('font', font.id)} className={`w-full p-2 rounded-md text-sm ${settings.font === font.id ? `bg-${settings.accentColor}-600 text-white` : ''}`} style={{fontFamily: `var(--font-${font.id})`}}>
                               {font.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Voice Assistant Choice */}
                <div className="space-y-2">
                    <h3 className="font-semibold">Assistant Voice</h3>
                     <div className="flex gap-2 p-1 bg-gray-700 dark:bg-gray-800 rounded-lg">
                        {voices.map(voice => (
                             <button key={voice.id} onClick={() => handleSettingChange('voice', voice.id)} className={`w-full p-2 rounded-md text-sm ${settings.voice === voice.id ? `bg-${settings.accentColor}-600 text-white` : ''}`}>
                               {voice.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const AboutModalContent: React.FC = () => (
    <div className="space-y-4 prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-white prose-li:text-gray-300">
        <h4>About Nexa AI</h4>
        <p>This application is an all-in-one AI powerhouse demonstrating the versatile capabilities of the Google Gemini API.</p>
        
        <h4>Key Features</h4>
        <ul>
            <li><strong>Dynamic Chat:</strong> Engage in contextual conversations with Gemini Flash, now with image understanding.</li>
            <li><strong>Image Studio:</strong> Generate novel images with Imagen 4.0 and edit them using Gemini Flash Image.</li>
            <li><strong>Video Studio:</strong> Animate still images into short videos with Veo.</li>
            <li><strong>Voice Assistant:</strong> Experience real-time, low-latency voice conversations.</li>
            <li><strong>Grounded Search:</strong> Get up-to-date answers from the web and maps.</li>
        </ul>

        <h4>What's New (Build Date: {new Date().toLocaleDateString()})</h4>
        <ul>
            <li>Added UI Customization: Light/Dark themes, accent colors, and font choices.</li>
            <li>Enhanced Chat: Messages can now be edited, deleted, copied, and read aloud. Image uploads and speech-to-text are now supported.</li>
            <li>Improved Voice Assistant: Choose between male and female voices in Settings.</li>
        </ul>
        <hr className="border-gray-700"/>
        <p className="text-sm text-center">This application is created by Atal Shah.</p>
    </div>
);


const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [isMenuOpen, setMenuOpen] = useState(false);
  
  const [isAboutModalOpen, setAboutModalOpen] = useState(false);
  const [isSettingsPanelOpen, setSettingsPanelOpen] = useState(false);
  
  // Text Chat State
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatMessages, setActiveChatMessages] = useState<ChatMessage[]>([]);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Voice Chat State
  const [voiceChats, setVoiceChats] = useState<VoiceChatSummary[]>([]);
  const [activeVoiceChatId, setActiveVoiceChatId] = useState<string | null>(null);
  const [activeVoiceChatTranscripts, setActiveVoiceChatTranscripts] = useState<TranscriptTurn[]>([]);
  const [isVoiceChatLoading, setIsVoiceChatLoading] = useState(false);

  const { settings } = useSettings();
  const accentColor = settings.accentColor;


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleNewChat = useCallback(async () => {
    if (!user) return;
    const newChat = {
        title: 'New Chat',
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        messages: [],
    };
    const docRef = await addDoc(collection(db, `users/${user.uid}/chats`), newChat);
    setActiveChatId(docRef.id);
    setActiveVoiceChatId(null);
    setActiveTab('chat');
    setMenuOpen(false);
  }, [user]);

  // Fetch Chat Summaries (Text & Voice)
  useEffect(() => {
    if (user) {
      // Text Chats
      const textChatsQuery = query(collection(db, `users/${user.uid}/chats`), orderBy('lastUpdated', 'desc'));
      const unsubscribeTextChats = onSnapshot(textChatsQuery, (querySnapshot) => {
        const chatsData: ChatSummary[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          chatsData.push({ id: doc.id, title: data.title, lastUpdated: data.lastUpdated ? data.lastUpdated.toDate() : new Date() });
        });
        setChats(chatsData);
        if (!activeChatId && chatsData.length > 0) {
          setActiveChatId(chatsData[0].id);
        } else if (chatsData.length === 0) {
            handleNewChat();
        }
      });

      // Voice Chats
      const voiceChatsQuery = query(collection(db, `users/${user.uid}/voiceChats`), orderBy('lastUpdated', 'desc'));
      const unsubscribeVoiceChats = onSnapshot(voiceChatsQuery, (querySnapshot) => {
          const chatsData: VoiceChatSummary[] = [];
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              chatsData.push({ id: doc.id, title: data.title, lastUpdated: data.lastUpdated ? data.lastUpdated.toDate() : new Date() });
          });
          setVoiceChats(chatsData);
      });

      return () => {
        unsubscribeTextChats();
        unsubscribeVoiceChats();
      }
    }
  }, [user, activeChatId, handleNewChat]);

  // Fetch Active Text Chat Messages
  useEffect(() => {
    if (activeChatId && user) {
      setIsChatLoading(true);
      const chatDocRef = doc(db, `users/${user.uid}/chats`, activeChatId);
      const unsubscribe = onSnapshot(chatDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const messages = (docSnap.data().messages || []).map((msg: ChatMessage, index: number) => ({ ...msg, id: `${activeChatId}-${index}` }));
            setActiveChatMessages(messages);
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const chatInstance = ai.chats.create({
              model: 'gemini-2.5-flash',
              history: messages.map(({role, parts}) => ({role, parts})),
            });
            setChatSession(chatInstance);
          }
          setIsChatLoading(false);
      });
      return () => unsubscribe();
    }
  }, [activeChatId, user]);

  // Fetch Active Voice Chat Transcripts
  useEffect(() => {
      if(activeVoiceChatId && user) {
          setIsVoiceChatLoading(true);
          const voiceChatDocRef = doc(db, `users/${user.uid}/voiceChats`, activeVoiceChatId);
          const unsubscribe = onSnapshot(voiceChatDocRef, (docSnap) => {
              if(docSnap.exists()) {
                  const transcripts = docSnap.data().transcripts || [];
                  setActiveVoiceChatTranscripts(transcripts);
              }
              setIsVoiceChatLoading(false);
          });
          return () => unsubscribe();
      }
  }, [activeVoiceChatId, user]);
  
  const handleUpdateChat = async (chatId: string, newMessages: ChatMessage[]) => {
      if (!user) return;
      const chatDocRef = doc(db, `users/${user.uid}/chats`, chatId);
      const messagesToSave = newMessages.map(({id, ...rest}) => rest); // remove id
      const updateData: { messages: Omit<ChatMessage, 'id'>[], lastUpdated: any, title?: string } = {
          messages: messagesToSave,
          lastUpdated: serverTimestamp(),
      };

      const userMessageForTitle = newMessages[newMessages.length - 2];
      if (newMessages.length > 0 && newMessages.filter(m => m.role === 'user').length === 1 && userMessageForTitle?.role === 'user') {
        const textPart = userMessageForTitle.parts.find(p => 'text' in p) as TextPart | undefined;
        updateData.title = textPart?.text.substring(0, 40) || 'Image Chat';
      }

      await updateDoc(chatDocRef, updateData);
  };
  
  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!user || !activeChatId) return;
    const messageIndex = activeChatMessages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const updatedMessages = [...activeChatMessages];
    const messageToUpdate = { ...updatedMessages[messageIndex] };
    const textPartIndex = messageToUpdate.parts.findIndex(p => 'text' in p);

    if (textPartIndex !== -1) {
        // Create a new parts array to avoid direct mutation
        const newParts = [...messageToUpdate.parts];
        newParts[textPartIndex] = { text: newText };
        messageToUpdate.parts = newParts;
    } else {
        // This case shouldn't happen if editing is only possible for text messages, but as a fallback:
        messageToUpdate.parts.push({ text: newText });
    }
    
    updatedMessages[messageIndex] = messageToUpdate;
    setActiveChatMessages(updatedMessages); // Optimistic update
    await handleUpdateChat(activeChatId, updatedMessages);
  };

  const handleDeleteMessage = async (messageId: string) => {
      if (!user || !activeChatId) return;
      const messageIndex = activeChatMessages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return;

      const updatedMessages = activeChatMessages.filter(m => m.id !== messageId);
      setActiveChatMessages(updatedMessages); // Optimistic update
      await handleUpdateChat(activeChatId, updatedMessages);
  };

  const handleNewVoiceChat = useCallback(async () => {
      if (!user) return;
      const newChat = {
          title: 'New Voice Session',
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          transcripts: [],
      };
      const docRef = await addDoc(collection(db, `users/${user.uid}/voiceChats`), newChat);
      setActiveVoiceChatId(docRef.id);
      setActiveChatId(null);
      setActiveTab('voice');
      setMenuOpen(false);
  }, [user]);
  
  const handleUpdateVoiceChat = async (chatId: string, newTranscripts: TranscriptTurn[]) => {
      if (!user) return;
      const chatDocRef = doc(db, `users/${user.uid}/voiceChats`, chatId);
      const updateData: { transcripts: TranscriptTurn[], lastUpdated: any, title?: string } = {
          transcripts: newTranscripts,
          lastUpdated: serverTimestamp(),
      };
      
      if (newTranscripts.length === 1 && newTranscripts[0].user) {
          updateData.title = newTranscripts[0].user.substring(0, 40);
      }
      await updateDoc(chatDocRef, updateData);
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'chat', label: 'Chat', icon: 'voice_chat' },
    { id: 'image', label: 'Image Studio', icon: 'image' },
    { id: 'video', label: 'Video Studio', icon: 'movie' },
    { id: 'voice', label: 'Voice Assistant', icon: 'audio_spark' },
    { id: 'search', label: 'Search', icon: 'google' },
  ];
  
  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setActiveVoiceChatId(null);
    setActiveTab('chat');
    setMenuOpen(false);
  }
  
  const handleSelectVoiceChat = (chatId: string) => {
    setActiveVoiceChatId(chatId);
    setActiveChatId(null);
    setActiveTab('voice');
    setMenuOpen(false);
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'chat':
        return isChatLoading ? <div className="flex justify-center items-center h-full"><Loader text="Loading chat..." /></div> : 
          <ChatComponent 
            key={activeChatId} 
            chatSession={chatSession}
            history={activeChatMessages}
            onHistoryUpdate={(newMessages) => activeChatId && handleUpdateChat(activeChatId, newMessages)}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />;
      case 'image':
        return <ImageStudio />;
      case 'video':
        return <VideoStudio />;
      case 'voice':
        return isVoiceChatLoading ? <div className="flex justify-center items-center h-full"><Loader text="Loading voice session..." /></div> :
        <VoiceAssistant
            key={activeVoiceChatId}
            onHistoryUpdate={(newTranscripts) => activeVoiceChatId && handleUpdateVoiceChat(activeVoiceChatId, newTranscripts)}
            history={activeVoiceChatTranscripts}
          />;
      case 'search':
        return <Search />;
      default:
        return null;
    }
  };

  const ActiveComponent = useMemo(renderActiveTab, [activeTab, activeChatId, activeChatMessages, chatSession, isChatLoading, activeVoiceChatId, activeVoiceChatTranscripts, isVoiceChatLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex justify-center items-center">
        <Loader text="Initializing Nexa AI..." />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }
  
  return (
    <div className={`min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 flex transition-colors duration-300`}>
       <Sidebar 
        isOpen={isMenuOpen} 
        setIsOpen={setMenuOpen} 
        onNewChat={handleNewChat}
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewVoiceChat={handleNewVoiceChat}
        voiceChats={voiceChats}
        activeVoiceChatId={activeVoiceChatId}
        onSelectVoiceChat={handleSelectVoiceChat}
        user={user}
        onSignOut={handleSignOut}
        onAbout={() => setAboutModalOpen(true)}
        />
        <div className="flex-1 flex flex-col min-w-0">
            <header className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm shadow-lg sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <button onClick={() => setMenuOpen(true)} className={`p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 md:hidden`}>
                    <Icon icon="menu" className="w-6 h-6" />
                    </button>
                    <div className="hidden md:flex items-center space-x-3">
                    <Icon icon="spark" className={`w-8 h-8 text-${accentColor}-500`} />
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Nexa AI</h1>
                    </div>
                </div>
                <nav className="hidden md:flex items-center space-x-2">
                    {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                        activeTab === tab.id
                            ? `bg-${accentColor}-600 text-white shadow-md`
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Icon icon={tab.icon} className="w-5 h-5" />
                        <span>{tab.label}</span>
                    </button>
                    ))}
                </nav>
                <div className="hidden md:flex items-center space-x-1 text-gray-600 dark:text-gray-300">
                     <button
                        onClick={() => setSettingsPanelOpen(true)}
                        className={`p-2 rounded-full transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white`}
                        title="Settings"
                    >
                        <Icon icon="settings" className="w-5 h-5" />
                    </button>
                    <ModelDropdown />
                    <a
                        href="mailto:creator12120@gmail.com?subject=Nexa%20AI%20Issue%20Report&body=Hi%20Creator!%0D%0A%0D%0A"
                        className={`p-2 rounded-full transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white inline-block`}
                        title="Report an issue"
                    >
                        <Icon icon="flag" className="w-5 h-5" />
                    </a>
                    <button
                        onClick={handleSignOut}
                        className={`p-2 rounded-full transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white`}
                        title="Log Out"
                    >
                        <Icon icon="logout" className="w-5 h-5" />
                    </button>
                </div>
                </div>
            </header>
            
            <main className="flex-grow p-4 md:p-6">
                {ActiveComponent}
            </main>

            {/* Mobile navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 flex justify-around p-1">
                {tabs.map((tab) => (
                    <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center w-full p-2 rounded-lg transition-colors duration-200 ${
                        activeTab === tab.id ? `bg-${accentColor}-600 text-white` : 'text-gray-500 dark:text-gray-400'
                    }`}
                    >
                    <Icon icon={tab.icon} className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">{tab.label}</span>
                    </button>
                ))}
            </nav>
            <div className="md:hidden h-20" /> {/* Spacer for mobile nav */}
        </div>
        
        <Modal isOpen={isAboutModalOpen} onClose={() => setAboutModalOpen(false)} title="About Nexa AI">
            <AboutModalContent />
        </Modal>
        <SettingsPanel isOpen={isSettingsPanelOpen} onClose={() => setSettingsPanelOpen(false)} />
    </div>
  );
};

const AppWrapper: React.FC = () => (
    <SettingsProvider>
        <App/>
    </SettingsProvider>
);

export default AppWrapper;