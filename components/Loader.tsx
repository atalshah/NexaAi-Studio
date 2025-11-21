
import React from 'react';

interface LoaderProps {
  text?: string;
}

export const Loader: React.FC<LoaderProps> = ({ text = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-2">
      <div className="w-8 h-8 border-4 border-t-indigo-500 border-gray-600 rounded-full animate-spin"></div>
      {text && <p className="text-gray-400">{text}</p>}
    </div>
  );
};
