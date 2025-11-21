import React from 'react';
import { User } from 'firebase/auth';
import { Icon } from './Icon';
import type { ChatSummary, VoiceChatSummary } from '../types';
import { useSettings } from '../App';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onNewChat: () => void;
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewVoiceChat: () => void;
  voiceChats: VoiceChatSummary[];
  activeVoiceChatId: string | null;
  onSelectVoiceChat: (id: string) => void;
  user: User | null;
  onSignOut: () => void;
  onAbout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    isOpen, setIsOpen, 
    onNewChat, chats, activeChatId, onSelectChat, 
    onNewVoiceChat, voiceChats, activeVoiceChatId, onSelectVoiceChat,
    user,
    onSignOut,
    onAbout
}) => {
  const { settings, setSettings } = useSettings();
  const accentColor = settings.accentColor;

  const toggleTheme = () => {
    setSettings(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  };

  const menuItems = [
    {
        name: `Theme: ${settings.theme === 'dark' ? 'Dark' : 'Light'}`,
        icon: settings.theme === 'dark' ? 'dark_mode' : 'light_mode',
        action: toggleTheme
    },
    {
        name: 'About',
        icon: 'info',
        action: onAbout
    },
    {
        name: 'Report an issue',
        icon: 'flag',
        action: () => window.location.href = 'mailto:creator12120@gmail.com?subject=Nexa%20AI%20Issue%20Report&body=Hi%20Creator!%0D%0A%0D%0A'
    },
    {
        name: 'Sign Out',
        icon: 'logout',
        action: onSignOut
    }
];

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-20 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      ></div>
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 shadow-xl z-30 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } md:relative md:w-72 md:flex-shrink-0 md:flex border-r border-gray-200 dark:border-gray-700/50`}
      >
        <div className="flex flex-col h-full w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                    <Icon icon="spark" className={`w-7 h-7 text-${accentColor}-500`} />
                    <h2 className="text-xl font-bold">Nexa AI</h2>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 md:hidden">
                    <Icon icon="close" className="w-6 h-6" />
                </button>
            </div>
            
            <nav className="flex-grow p-2 space-y-4 overflow-y-auto">
                <div className="space-y-2">
                     <button 
                        onClick={onNewChat}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700/50 text-gray-800 dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors`}
                    >
                        <Icon icon="add" className="w-5 h-5"/>
                        New Chat
                    </button>
                    {chats.map(chat => (
                        <button 
                            key={chat.id}
                            onClick={() => onSelectChat(chat.id)}
                            className={`w-full text-left text-sm flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200 truncate ${
                                activeChatId === chat.id ? `bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold` : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            <Icon icon="voice_chat" className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{chat.title}</span>
                        </button>
                    ))}
                </div>
                
                <div className="space-y-2">
                     <button 
                        onClick={onNewVoiceChat}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700/50 text-gray-800 dark:text-white font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors`}
                    >
                        <Icon icon="add" className="w-5 h-5"/>
                        New Voice Session
                    </button>
                    {voiceChats.map(chat => (
                        <button 
                            key={chat.id}
                            onClick={() => onSelectVoiceChat(chat.id)}
                            className={`w-full text-left text-sm flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200 truncate ${
                                activeVoiceChatId === chat.id ? `bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold` : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            <Icon icon="audio_spark" className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{chat.title}</span>
                        </button>
                    ))}
                </div>
            </nav>

            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                <div className="space-y-1">
                    {menuItems.map(item => (
                         <button 
                            key={item.name}
                            onClick={item.action}
                            className={`w-full text-left text-sm flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50`}
                        >
                            <Icon icon={item.icon} className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{item.name}</span>
                        </button>
                    ))}
                </div>
                 {user && (
                    <div className="mt-2 p-3 border-t border-gray-200 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
                        <p className="truncate">Signed in as</p>
                        <p className="font-semibold truncate text-gray-700 dark:text-gray-200">{user.displayName || user.email}</p>
                    </div>
                )}
            </div>

        </div>
      </div>
    </>
  );
};