import React, { useState } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { AspectRatio } from '../types';
import { Icon } from './Icon';
import { Loader } from './Loader';
import { blobToBase64 } from '../utils/file';

type ImageMode = 'generate' | 'analyze' | 'edit';
type EditAction = 'removeBg' | 'changeBg' | 'changeClothes' | 'changeHair' | 'addLogo' | 'addText' | 'blurBg' | 'changeEyes' | 'changeNose' | 'changeLips' | 'changeFaceShape' | 'swapFace';

const editActions: { id: EditAction, name: string, prompt: string, needsInput: boolean, placeholder?: string }[] = [
    { id: 'removeBg', name: 'Remove Background', prompt: 'Remove the background, leaving only the main subject with a clean transparent background.', needsInput: false },
    { id: 'blurBg', name: 'Blur Background', prompt: 'Blur the background of the image, keeping the main subject in sharp focus.', needsInput: false },
    { id: 'swapFace', name: 'Swap Face', prompt: 'Take only the face from the second image and expertly swap it onto the person in the first image. Blend it naturally, matching skin tone and lighting.', needsInput: false },
    { id: 'changeBg', name: 'Change Background', prompt: 'Change the background to: ', needsInput: true, placeholder: 'a serene beach at sunset' },
    { id: 'changeClothes', name: 'Change Clothes', prompt: 'For the person in the image, change their clothes to: ', needsInput: true, placeholder: 'a red leather jacket' },
    { id: 'changeHair', name: 'Change Hairstyle', prompt: 'For the person in the image, change their hairstyle to: ', needsInput: true, placeholder: 'long and blonde' },
    { id: 'changeEyes', name: 'Change Eyes', prompt: 'For the person in the image, change their eyes to: ', needsInput: true, placeholder: 'bright blue' },
    { id: 'changeNose', name: 'Change Nose', prompt: 'For the person in the image, change their nose to be: ', needsInput: true, placeholder: 'smaller and pointier' },
    { id: 'changeLips', name: 'Change Lips', prompt: 'For the person in the image, change their lips to be: ', needsInput: true, placeholder: 'fuller and red' },
    { id: 'changeFaceShape', name: 'Change Face Shape', prompt: 'For the person in the image, change their face shape to be more: ', needsInput: true, placeholder: 'oval and defined' },
    { id: 'addLogo', name: 'Add Logo', prompt: 'On a suitable surface like a shirt or wall, add a logo described as: ', needsInput: true, placeholder: 'a minimalist mountain icon' },
    { id: 'addText', name: 'Add Text', prompt: 'In a fitting style and location, add the text: ', needsInput: true, placeholder: 'Your Text Here' },
];

const addWatermark = (base64Image: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            // Draw original image
            ctx.drawImage(image, 0, 0);

            // Set watermark style
            const padding = image.width * 0.025;
            const fontSize = Math.max(12, image.width / 50);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            
            // Draw watermark text
            ctx.fillText('Nexa AI ✨', canvas.width - padding, canvas.height - padding);
            
            // Resolve with new image
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        image.onerror = (err) => {
            reject(err);
        };
        image.src = base64Image;
    });
};

export const ImageStudio: React.FC = () => {
  const [mode, setMode] = useState<ImageMode>('generate');
  const [prompt, setPrompt] = useState('');
  const [promptPlaceholder, setPromptPlaceholder] = useState('e.g., A futuristic cityscape at sunset, neon lights');
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [faceImageFile, setFaceImageFile] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string | null>(null);

  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [activeEditAction, setActiveEditAction] = useState<EditAction | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setGeneratedImage(null);
      setAnalysisResult('');
    }
  };

  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setFaceImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setFaceImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  };


  const clearState = () => {
    setPrompt('');
    setImageFile(null);
    setImagePreview(null);
    setFaceImageFile(null);
    setFaceImagePreview(null);
    setGeneratedImage(null);
    setAnalysisResult('');
    setLoading(false);
    setError(null);
    setActiveEditAction(null);
  }

  const handleModeChange = (newMode: ImageMode) => {
    setMode(newMode);
    clearState();
    setPromptPlaceholder(newMode === 'generate' ? 'e.g., A futuristic cityscape at sunset, neon lights' : 'e.g., Add a retro filter');
  }

  const handleEditAction = (action: typeof editActions[0]) => {
      setActiveEditAction(action.id);
      if (action.needsInput) {
          setPrompt('');
          setPromptPlaceholder(action.placeholder || 'Describe your edit...');
      } else {
          setPrompt(action.prompt);
          performAction(action.prompt);
      }
  }
  
  const handleEditGeneratedImage = async () => {
    if (!generatedImage) return;

    try {
        // Convert base64 to File
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const file = new File([blob], `generated-image-${Date.now()}.jpg`, { type: blob.type });

        // Switch to edit mode with the generated image
        setMode('edit');
        setImageFile(file);
        setImagePreview(generatedImage);
        
        // Clear state from generate mode, but keep the prompt
        setGeneratedImage(null);
        setAnalysisResult('');
        setActiveEditAction(null);
        setPromptPlaceholder('e.g., Add a retro filter');
    } catch (e) {
        console.error("Failed to process generated image for editing:", e);
        setError("Could not load the generated image for editing. Please try downloading and re-uploading it.");
    }
  };


  const performAction = async (actionPrompt?: string) => {
    if (loading) return;
    
    let finalPrompt: string;

    if (actionPrompt) {
        // For no-input quick actions
        finalPrompt = actionPrompt;
    } else {
        // For the main "Run" button or input-based quick actions
        const currentAction = activeEditAction ? editActions.find(a => a.id === activeEditAction) : null;
        if (mode === 'edit' && currentAction && currentAction.needsInput) {
             finalPrompt = currentAction.prompt + (currentAction.id === 'addText' ? `"${prompt}"` : prompt);
        } else {
            finalPrompt = prompt;
        }
    }

    if (mode === 'edit' && activeEditAction === 'swapFace' && !faceImageFile) {
        setError("Please upload a second image containing the face you want to use.");
        return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setAnalysisResult('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (mode === 'generate') {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: finalPrompt || 'A beautiful, high-resolution photograph',
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: aspectRatio,
            },
        });
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const originalImage = `data:image/jpeg;base64,${base64ImageBytes}`;
        const watermarkedImage = await addWatermark(originalImage);
        setGeneratedImage(watermarkedImage);
      } else if ((mode === 'analyze' || mode === 'edit') && imageFile) {
        
        const parts: ({ text: string } | { inlineData: { data: string, mimeType: string }})[] = [];
        
        const base64Data = await blobToBase64(imageFile);
        parts.push({ inlineData: { data: base64Data, mimeType: imageFile.type } });

        if (mode === 'edit' && activeEditAction === 'swapFace' && faceImageFile) {
            const faceBase64Data = await blobToBase64(faceImageFile);
            parts.push({ inlineData: { data: faceBase64Data, mimeType: faceImageFile.type }});
        }
        
        parts.push({ text: finalPrompt });

        if (mode === 'analyze') {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: parts },
            });
            setAnalysisResult(response.text);
        } else { // edit mode
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: parts },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            const part = response.candidates?.[0]?.content?.parts?.[0];
            if (part && part.inlineData) {
                const base64ImageBytes = part.inlineData.data;
                const originalImage = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                const watermarkedImage = await addWatermark(originalImage);
                setGeneratedImage(watermarkedImage);
            } else {
                throw new Error("No image was generated. The model may not have understood the request or it may violate safety policies.");
            }
        }
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    const showImageUpload = mode === 'analyze' || mode === 'edit';
    const showPrompt = mode !== 'analyze' || (mode === 'analyze' && imageFile);

    return (
        <div className="bg-gray-800/50 rounded-lg shadow-2xl border border-gray-700 p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-white capitalize">{mode} Image</h2>
                <div className="grid grid-cols-3 gap-1 p-1 bg-gray-700 rounded-lg">
                    {(['generate', 'analyze', 'edit'] as ImageMode[]).map(m => (
                        <button key={m} onClick={() => handleModeChange(m)} className={`px-4 py-2 text-sm font-semibold rounded-md transition ${mode === m ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
                    ))}
                </div>
            </div>

            {showImageUpload && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Upload Image</label>
                    <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-600 px-6 py-10">
                        <div className="text-center">
                            <Icon icon="image" className="mx-auto h-12 w-12 text-gray-500" />
                            <div className="mt-4 flex text-sm leading-6 text-gray-400">
                                <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-gray-800 font-semibold text-indigo-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 hover:text-indigo-300">
                                    <span>Upload a file</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*"/>
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs leading-5 text-gray-500">{imageFile ? imageFile.name : 'PNG, JPG, GIF up to 10MB'}</p>
                        </div>
                    </div>
                </div>
            )}
            
            {mode === 'edit' && imageFile && (
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Quick Actions</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {editActions.map(action => (
                            <button key={action.id} onClick={() => handleEditAction(action)} className={`p-2 rounded-lg text-sm font-semibold transition text-center ${activeEditAction === action.id ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{action.name}</button>
                        ))}
                    </div>
                </div>
            )}

            {mode === 'edit' && activeEditAction === 'swapFace' && imageFile && (
                 <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Upload Face Image</label>
                     <div className="mt-2 flex justify-center rounded-lg border border-dashed border-indigo-400/50 px-6 py-10">
                        <div className="text-center">
                             <Icon icon="upload" className="mx-auto h-12 w-12 text-gray-500" />
                             <div className="mt-4 flex text-sm leading-6 text-gray-400">
                                <label htmlFor="face-file-upload" className="relative cursor-pointer rounded-md bg-gray-800 font-semibold text-indigo-400 hover:text-indigo-300">
                                     <span>Upload the image with the face to use</span>
                                     <input id="face-file-upload" name="face-file-upload" type="file" className="sr-only" onChange={handleFaceFileChange} accept="image/*"/>
                                 </label>
                             </div>
                             <p className="text-xs leading-5 text-gray-500">{faceImageFile ? faceImageFile.name : 'PNG, JPG, etc.'}</p>
                         </div>
                     </div>
                 </div>
            )}

            {showPrompt && (
                <div>
                    <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
                        {mode === 'generate' && "Image Prompt"}
                        {mode === 'analyze' && "What do you want to know about this image?"}
                        {mode === 'edit' && "Describe your edit"}
                    </label>
                    <textarea id="prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder={promptPlaceholder} />
                </div>
            )}

            {mode === 'generate' && (
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                    <div className="grid grid-cols-5 gap-2">
                        {(['1:1', '16:9', '9:16', '4:3', '3:4'] as AspectRatio[]).map(ar => (
                            <button key={ar} onClick={() => setAspectRatio(ar)} className={`p-2 rounded-lg text-sm font-semibold transition ${aspectRatio === ar ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{ar}</button>
                        ))}
                    </div>
                </div>
            )}
            
            <button onClick={() => performAction()} disabled={loading || (showImageUpload && !imageFile)} className="w-full flex justify-center items-center gap-2 p-3 bg-indigo-600 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors font-semibold">
                {loading ? 'Processing...' : `Run ${mode}`}
                {loading && <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>}
            </button>
            
            {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm text-center">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                    {(imagePreview || faceImagePreview) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {imagePreview && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Original Image</h3>
                                    <img src={imagePreview} alt="Preview" className="w-full h-auto rounded-lg shadow-lg" />
                                </div>
                            )}
                            {faceImagePreview && (
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Face Source</h3>
                                    <img src={faceImagePreview} alt="Face Preview" className="w-full h-auto rounded-lg shadow-lg" />
                                </div>
                            )}
                        </div>
                    )}
                     {generatedImage && (
                        <div>
                            <h3 className="text-lg font-semibold mb-2 mt-4">{mode === 'edit' ? 'Edited Image' : 'Generated Image'}</h3>
                            <div className="relative">
                                <img src={generatedImage} alt="Generated" className="w-full h-auto rounded-lg shadow-lg" />
                                    <a
                                    href={generatedImage}
                                    download={`nexa-ai-image-${Date.now()}.jpg`}
                                    className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-black/75 transition-colors"
                                    title="Download Image"
                                >
                                    <Icon icon="download" className="w-5 h-5" />
                                </a>
                            </div>
                            {mode === 'generate' && (
                                <button
                                    onClick={handleEditGeneratedImage}
                                    className="w-full mt-4 flex justify-center items-center gap-2 p-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors font-semibold"
                                >
                                    <Icon icon="blur_on" className="w-5 h-5" />
                                    Edit this Image
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                {analysisResult && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Analysis Result</h3>
                        <div className="p-4 bg-gray-900/70 rounded-lg whitespace-pre-wrap">{analysisResult}</div>
                    </div>
                )}

                 {loading && !generatedImage && !analysisResult && (
                    <div className="col-span-1 md:col-span-2 flex justify-center p-8">
                       <Loader text="AI is creating..."/>
                    </div>
                )}
            </div>
        </div>
    );
  };
  
  return renderContent();
};
