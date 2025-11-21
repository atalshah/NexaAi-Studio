import React, { useState } from 'react';
import { Icon } from './Icon';

export const ModelDropdown: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    const models = [
        { name: "Chat", model: "Gemini 2.5 Flash" },
        { name: "Image Generation", model: "Imagen 4.0" },
        { name: "Image Editing", model: "Gemini 2.5 Flash Image" },
        { name: "Video Generation", model: "Veo 3.1" },
        { name: "Voice Assistant", model: "Gemini 2.5 Flash Native Audio" },
        { name: "Search", model: "Gemini 2.5 Pro / Flash" },
    ];

    return (
        <div className="relative" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
            <button
                className="p-2 rounded-full transition-colors duration-200 text-gray-300 hover:bg-gray-700 hover:text-white"
                title="View Models"
            >
                <Icon icon="thinking" className="w-5 h-5" />
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
                    <div className="p-3 border-b border-gray-700">
                        <h3 className="font-semibold text-white">Models Used</h3>
                    </div>
                    <ul className="p-2">
                        {models.map(m => (
                            <li key={m.name} className="px-3 py-1.5 text-sm text-gray-300">
                                <span className="font-semibold text-white">{m.name}:</span> {m.model}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
