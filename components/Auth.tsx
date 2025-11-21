import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Icon } from './Icon';

export const Auth: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError(null);
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            console.error(error);
            setError(error.message || "Failed to sign in with Google. Please try again.");
            setLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error: any) {
            console.error(error);
            setError(error.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}. Please check your credentials.`);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full text-center bg-gray-800/50 border border-gray-700 rounded-2xl shadow-2xl p-8">
                <Icon icon="spark" className="w-16 h-16 text-indigo-400 mx-auto mb-4" />
                <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Welcome to Nexa AI</h1>
                <p className="text-gray-400 mb-8">Sign in to unlock the full power of Gemini.</p>

                <form onSubmit={handleEmailAuth} className="space-y-4">
                    <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        required
                        className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        minLength={6}
                        className="w-full p-3 bg-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition-colors disabled:bg-gray-600"
                    >
                        <Icon icon="email" className="w-6 h-6" />
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div className="my-6 flex items-center">
                    <div className="flex-grow border-t border-gray-600"></div>
                    <span className="flex-shrink mx-4 text-gray-400">OR</span>
                    <div className="flex-grow border-t border-gray-600"></div>
                </div>
                
                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-800 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:bg-gray-400"
                >
                    <Icon icon="google" className="w-6 h-6" />
                    Sign in with Google
                </button>

                <p className="mt-6 text-sm">
                    <button onClick={() => setIsSignUp(!isSignUp)} className="text-indigo-400 hover:underline">
                        {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                    </button>
                </p>

                {error && <p className="text-red-400 text-sm mt-4 bg-red-900/30 p-2 rounded-md">{error}</p>}
            </div>
        </div>
    );
};
