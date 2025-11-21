import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
  onRunCode: (code: string, lang: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onRunCode }) => {
  // Regex to split the content by code blocks, keeping the delimiters
  const parts = content.split(/(```[\s\S]*?```)/g);

  const renderText = (text: string) => {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
      
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');
    // Italic: *text* or _text_
    html = html.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
    // Newlines to <br>
    html = html.replace(/\n/g, '<br />');

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const codeBlock = part.slice(3, -3);
          const firstLineEnd = codeBlock.indexOf('\n');
          const lang = codeBlock.slice(0, firstLineEnd).trim();
          const code = codeBlock.slice(firstLineEnd + 1).trim();
          return <CodeBlock key={index} language={lang} code={code} onRun={onRunCode} />;
        } else {
          return <React.Fragment key={index}>{renderText(part)}</React.Fragment>;
        }
      })}
    </div>
  );
};
