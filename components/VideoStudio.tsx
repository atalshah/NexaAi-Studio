import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Icon } from './Icon';
import { Loader } from './Loader';
import { blobToBase64 } from '../utils/file';

const loadingMessages = [
    "Warming up the digital director's chair...",
    "Choreographing pixels into motion...",
    "Rendering the first few frames of your masterpiece...",
    "Consulting with the AI muse for creative inspiration...",
    "This can take a few minutes, good things come to those who wait!",
    "Almost there, adding the final cinematic touches..."
];

type AspectRatioVideo = '16:9' | '9:16';

export const VideoStudio: React.FC = () => {
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<AspectRatioVideo>('16:9');
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const checkApiKey = useCallback(async () => {
        if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
            setApiKeySelected(true);
        } else {
            setApiKeySelected(false);
        }
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    useEffect(() => {
        let interval: number;
        if (loading) {
            interval = window.setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    return loadingMessages[(currentIndex + 1) % loadingMessages.length];
                });
            }, 4000);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const handleSelectKey = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            // Assume success to avoid race condition
            setApiKeySelected(true);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const generateVideo = async () => {
        if (!imageFile || loading) return;

        setLoading(true);
        setError(null);
        setVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);

        try {
            // Re-create instance to get latest key
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const base64Data = await blobToBase64(imageFile);
            
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt || 'Animate this image beautifully.',
                image: {
                  imageBytes: base64Data,
                  mimeType: imageFile.type,
                },
                config: {
                  numberOfVideos: 1,
                  resolution: '720p',
                  aspectRatio: aspectRatio
                }
            });

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }
            
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                 const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                 const videoBlob = await response.blob();
                 setVideoUrl(URL.createObjectURL(videoBlob));
            } else {
                throw new Error("Video generation completed, but no download link was provided.");
            }

        } catch (err: any) {
            console.error(err);
            let errorMessage = err.message || 'An unknown error occurred.';
             if (err.message && err.message.includes("API key not valid")) {
                errorMessage = "Your API Key is not valid. Please select a valid key and ensure billing is enabled.";
                setApiKeySelected(false);
            } else if (err.message && err.message.includes("Requested entity was not found")) {
                errorMessage = "API Key error. Please re-select your API key.";
                setApiKeySelected(false);
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (!apiKeySelected) {
        return (
            <div className="text-center max-w-lg mx-auto p-8 bg-gray-800 rounded-lg">
                <Icon icon="movie" className="w-16 h-16 mx-auto text-indigo-400 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Veo Video Generation</h2>
                <p className="text-gray-400 mb-6">To use this feature, you need to select a Google AI Studio API key. Video generation is a billable service.</p>
                <button onClick={handleSelectKey} className="px-6 py-3 bg-indigo-600 rounded-lg font-semibold hover:bg-indigo-500 transition-colors">
                    Select API Key
                </button>
                <p className="text-xs text-gray-500 mt-4">
                    For more information, please see the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">billing documentation</a>.
                </p>
                 {error && <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div>}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white">Animate Image with Veo</h2>
                
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Upload Starting Image</label>
                    <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-600 px-6 py-10">
                        <div className="text-center">
                            <Icon icon="upload" className="mx-auto h-12 w-12 text-gray-500" />
                            <div className="mt-4 flex text-sm leading-6 text-gray-400">
                                <label htmlFor="video-file-upload" className="relative cursor-pointer rounded-md bg-gray-800 font-semibold text-indigo-400 hover:text-indigo-300">
                                    <span>Upload a file</span>
                                    <input id="video-file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                                </label>
                            </div>
                            <p className="text-xs leading-5 text-gray-500">{imageFile ? imageFile.name : 'PNG or JPG'}</p>
                        </div>
                    </div>
                </div>

                <div>
                    <label htmlFor="video-prompt" className="block text-sm font-medium text-gray-300 mb-2">Animation Prompt (Optional)</label>
                    <textarea id="video-prompt" rows={2} value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g., The clouds move slowly across the sky" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['16:9', '9:16'] as AspectRatioVideo[]).map(ar => (
                                <button key={ar} onClick={() => setAspectRatio(ar)} className={`p-2 rounded-lg text-sm font-semibold transition ${aspectRatio === ar ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                    {ar} {ar === '16:9' ? '(Landscape)' : '(Portrait)'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Animation Duration</label>
                        <div className="grid grid-cols-2 gap-2" title="The current Veo model has a fixed animation duration. Custom durations are not yet supported.">
                            {['5s', '10s'].map(d => (
                                <button key={d} disabled className="p-2 rounded-lg text-sm font-semibold transition bg-gray-700 text-gray-500 cursor-not-allowed">
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>


                <button onClick={generateVideo} disabled={!imageFile || loading} className="w-full flex justify-center items-center gap-2 p-3 bg-indigo-600 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors font-semibold">
                    Generate Video
                </button>
            </div>

            {loading && (
                <div className="text-center p-8 bg-gray-800/50 rounded-lg">
                    <Loader text={loadingMessage} />
                </div>
            )}

            {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {imagePreview && (
                    <div className="bg-gray-800/50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">Your Image</h3>
                        <img src={imagePreview} alt="Preview" className="w-full h-auto rounded-lg" />
                    </div>
                )}
                {videoUrl && (
                    <div className="bg-gray-800/50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold mb-2">Generated Video</h3>
                        <div className="relative">
                            <video src={videoUrl} controls autoPlay loop className="w-full h-auto rounded-lg" />
                            <a
                                href={videoUrl}
                                download={`nexa-ai-video-${Date.now()}.mp4`}
                                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors"
                                title="Download Video"
                                >
                                <Icon icon="download" className="w-5 h-5" />
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};