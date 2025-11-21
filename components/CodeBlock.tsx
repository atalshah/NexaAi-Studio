import React, { useState } from 'react';
import { Icon } from './Icon';

interface CodeBlockProps {
    language: string;
    code: string;
    onRun: (code: string, lang: string) => void;
}

const isRunnable = (lang: string) => ['javascript', 'js', 'html', 'css'].includes(lang.toLowerCase());

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, onRun }) => {
    const [copyText, setCopyText] = useState('Copy');

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopyText('Copied!');
        setTimeout(() => setCopyText('Copy'), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const extension = language === 'javascript' ? 'js' : language;
        a.href = url;
        a.download = `code.${extension || 'txt'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-gray-900/70 rounded-lg my-4 overflow-hidden border border-gray-700">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800/50">
                <span className="text-xs font-semibold text-gray-400 uppercase">{language}</span>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => onRun(code, language)} 
                        disabled={!isRunnable(language)}
                        className="flex items-center gap-1 text-xs text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed"
                        title={isRunnable(language) ? "Run Code" : "Running this language is not supported"}
                    >
                        <Icon icon="play_arrow" className="w-4 h-4" /> Run
                    </button>
                    <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-300 hover:text-white">
                        <Icon icon="copy" className="w-4 h-4" /> {copyText}
                    </button>
                    <button onClick={handleDownload} className="flex items-center gap-1 text-xs text-gray-300 hover:text-white">
                        <Icon icon="download" className="w-4 h-4" /> Download
                    </button>
                </div>
            </div>
            <pre className="p-4 text-sm overflow-x-auto">
                <code>{code}</code>
            </pre>
        </div>
    );
};
