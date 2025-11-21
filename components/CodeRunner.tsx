import React, { useMemo } from 'react';
import { Icon } from './Icon';

interface CodeRunnerProps {
    code: string;
    lang: string;
    onClose: () => void;
}

export const CodeRunner: React.FC<CodeRunnerProps> = ({ code, lang, onClose }) => {
    
    const srcDoc = useMemo(() => {
        if (lang.toLowerCase() === 'html') {
            return code;
        }
        if (['javascript', 'js'].includes(lang.toLowerCase())) {
            return `
                <html>
                    <body style="background-color:#111827; color: #f9fafb; font-family: monospace;">
                        <script>
                            const originalLog = console.log;
                            console.log = (...args) => {
                                const output = args.map(arg => {
                                    if (typeof arg === 'object' && arg !== null) {
                                        return JSON.stringify(arg, null, 2);
                                    }
                                    return String(arg);
                                }).join(' ');
                                document.body.innerHTML += \`<pre>> \${output}</pre>\`;
                                originalLog.apply(console, args);
                            };
                            try {
                                ${code}
                            } catch (e) {
                                console.log('Error:', e.message);
                            }
                        </script>
                    </body>
                </html>
            `;
        }
        return '';
    }, [code, lang]);

    return (
        <div className="flex flex-col h-full bg-gray-900">
            <div className="flex justify-between items-center p-2 border-b border-gray-700 flex-shrink-0">
                <h3 className="text-sm font-semibold">Code Runner Result</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700">
                    <Icon icon="close" className="w-5 h-5" />
                </button>
            </div>
            <div className="flex-grow">
                <iframe
                    srcDoc={srcDoc}
                    title="Code Execution Result"
                    sandbox="allow-scripts"
                    className="w-full h-full border-0"
                />
            </div>
        </div>
    );
};
