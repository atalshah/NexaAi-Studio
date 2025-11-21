import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { GroundingChunk, SearchHistoryItem } from '../types';
import { Icon } from './Icon';
import { Loader } from './Loader';
import { MarkdownRenderer } from './MarkdownRenderer';

type SearchMode = 'web' | 'maps';
type ModelType = 'fast' | 'complex';

const SEARCH_HISTORY_KEY = 'nexa-ai-search-history';

export const Search: React.FC = () => {
    const [query, setQuery] = useState('');
    const [searchMode, setSearchMode] = useState<SearchMode>('web');
    const [modelType, setModelType] = useState<ModelType>('fast');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [sources, setSources] = useState<GroundingChunk[]>([]);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [history, setHistory] = useState<SearchHistoryItem[]>([]);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);

    useEffect(() => {
        try {
            const storedHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
            if (storedHistory) {
                setHistory(JSON.parse(storedHistory));
            }
        } catch (e) {
            console.error("Failed to load search history:", e);
        }
    }, []);

     const addToHistory = (newQuery: string) => {
        const newItem: SearchHistoryItem = {
            id: Date.now().toString(),
            query: newQuery,
            timestamp: Date.now(),
        };
        setHistory(prev => {
            const updatedHistory = [newItem, ...prev].slice(0, 20); // Keep last 20 searches
            try {
                localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updatedHistory));
            } catch (e) {
                console.error("Failed to save search history:", e);
            }
            return updatedHistory;
        });
    };

    const handleHistoryClick = (pastQuery: string) => {
        setQuery(pastQuery);
        setIsHistoryVisible(false);
    };

    useEffect(() => {
        if (searchMode === 'maps' && modelType === 'fast') {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (err) => {
                    console.warn(`Could not get location: ${err.message}`);
                    setError("Could not get your location. Maps search may be less accurate.");
                }
            );
        }
    }, [searchMode, modelType]);

    const handleSearch = async (e?: React.FormEvent<HTMLFormElement>) => {
        e?.preventDefault();
        if (!query.trim() || loading) return;
        
        addToHistory(query);
        setLoading(true);
        setError(null);
        setResult(null);
        setSources([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            let modelName = 'gemini-2.5-flash';
            let config: any = {};
            let isGroundedSearch = false;

            if (modelType === 'complex') {
                modelName = 'gemini-2.5-pro';
            } else {
                isGroundedSearch = true;
                modelName = 'gemini-2.5-flash';
                config.tools = searchMode === 'web' ? [{ googleSearch: {} }] : [{ googleMaps: {} }];
                if (searchMode === 'maps' && location) {
                    config.toolConfig = {
                        retrievalConfig: { latLng: location }
                    };
                }
            }
            
            const response = await ai.models.generateContent({
                model: modelName,
                contents: query,
                config: config,
            });
            
            setResult(response.text);

            if (isGroundedSearch) {
                const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (groundingChunks) {
                    setSources(groundingChunks as GroundingChunk[]);
                }
            }

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 p-6 space-y-4">
                <h2 className="text-2xl font-bold text-white">AI Grounded Search</h2>
                <form onSubmit={handleSearch}>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-grow">
                            <input 
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Ask a question..."
                                className="w-full p-3 pr-12 bg-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => setIsHistoryVisible(!isHistoryVisible)}
                                title="Show history"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-600"
                            >
                                <Icon icon="history" className="w-5 h-5"/>
                            </button>
                        </div>
                         <button
                            type="submit"
                            disabled={loading || !query.trim()}
                            className="p-3 bg-indigo-600 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors font-semibold flex items-center justify-center gap-2"
                        >
                            <Icon icon="search" className="w-5 h-5"/>
                            <span>Search</span>
                        </button>
                    </div>
                </form>
                 {isHistoryVisible && (
                    <div className="bg-gray-900/50 p-4 rounded-lg max-h-48 overflow-y-auto">
                        <h4 className="font-semibold text-sm mb-2 text-gray-300">Recent Searches</h4>
                        {history.length > 0 ? (
                            <ul className="space-y-2">
                                {history.map(item => (
                                    <li key={item.id}>
                                        <button onClick={() => handleHistoryClick(item.query)} className="text-left w-full text-sm text-gray-400 hover:text-indigo-300 truncate">
                                            {item.query}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500">No history yet.</p>
                        )}
                    </div>
                )}
                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2">
                     <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Model:</span>
                        <div className="flex gap-1 p-1 bg-gray-700 rounded-lg">
                            <button onClick={() => setModelType('fast')} className={`px-3 py-1 text-sm font-semibold rounded-md transition ${modelType === 'fast' ? 'bg-indigo-600 text-white' : 'text-gray-300'}`}>Fast</button>
                            <button onClick={() => setModelType('complex')} className={`px-3 py-1 text-sm font-semibold rounded-md transition ${modelType === 'complex' ? 'bg-indigo-600 text-white' : 'text-gray-300'}`}>Complex</button>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Source:</span>
                         <div className={`flex gap-1 p-1 rounded-lg ${modelType === 'fast' ? 'bg-gray-700' : 'bg-gray-900'}`}>
                            <button onClick={() => setSearchMode('web')} disabled={modelType !== 'fast'} className={`px-3 py-1 text-sm font-semibold rounded-md transition ${searchMode === 'web' && modelType === 'fast' ? 'bg-indigo-600 text-white' : 'text-gray-300'} disabled:text-gray-500 disabled:cursor-not-allowed`}>Web</button>
                            <button onClick={() => setSearchMode('maps')} disabled={modelType !== 'fast'} className={`px-3 py-1 text-sm font-semibold rounded-md transition ${searchMode === 'maps' && modelType === 'fast' ? 'bg-indigo-600 text-white' : 'text-gray-300'} disabled:text-gray-500 disabled:cursor-not-allowed`}>Maps</button>
                        </div>
                    </div>
                </div>
                 <p className="text-xs text-gray-500 text-center">
                    {modelType === 'fast' ? `Using Gemini Flash with ${searchMode} grounding.` : 'Using Gemini Pro for complex reasoning tasks.'}
                </p>
            </div>
            
            {loading && <div className="flex justify-center p-8"><Loader text="Searching..."/></div>}
            {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div>}

            {result && (
                <div className="bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 p-6">
                    <h3 className="text-xl font-semibold mb-4">Results</h3>
                    <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-white">
                         <MarkdownRenderer content={result} onRunCode={() => {}} />
                    </div>
                    {sources.length > 0 && (
                        <div className="mt-6">
                             <h4 className="font-semibold mb-2">Sources:</h4>
                             <ul className="space-y-2">
                                {sources.map((source, index) => {
                                    const uri = source.web?.uri || source.maps?.uri;
                                    const title = source.web?.title || source.maps?.title;
                                    if (!uri) return null;
                                    return (
                                        <li key={index} className="flex items-center">
                                            <a href={uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline text-sm flex items-center gap-2">
                                                <Icon icon={source.web ? 'link' : 'location'} className="w-4 h-4" />
                                                {title || uri}
                                            </a>
                                        </li>
                                    );
                                })}
                             </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
