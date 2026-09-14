import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Camera, ArrowRight, Users, Receipt, Sparkles, Clock, ChevronRight, Loader2, Trash2, AlertTriangle, Crown, UserCheck } from 'lucide-react';
import { ReceiptSession } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface HomeViewProps {
  onCreateNew: () => void;
  onJoinSession: (code: string) => void;
  onSelectSession: (sessionId: string) => void;
  userSessions: ReceiptSession[];
  loadingSessions: boolean;
  onLoadSessions: () => void;
  onDeleteSession?: (sessionId: string) => void;
  isAnonymous?: boolean;
  currentUserId?: string;
}

// Helper to format relative time
const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

// Get a display name for the session (prefer user-defined name, fallback to first item)
const getSessionName = (session: ReceiptSession): string => {
  // Use user-defined name if available
  if (session.name) {
    return session.name;
  }
  // Fallback to first item name
  if (session.items && session.items.length > 0) {
    const itemCount = session.items.length;
    if (itemCount === 1) {
      return session.items[0].name;
    }
    return `${session.items[0].name} +${itemCount - 1} items`;
  }
  return 'Receipt Session';
};

export const HomeView: React.FC<HomeViewProps> = ({
  onCreateNew,
  onJoinSession,
  onSelectSession,
  userSessions,
  loadingSessions,
  onLoadSessions,
  onDeleteSession,
  isAnonymous,
  currentUserId
}) => {
  const { t } = useLanguage();
  const [joinCode, setJoinCode] = useState('');

  // Load sessions on mount
  useEffect(() => {
    onLoadSessions();
  }, [onLoadSessions]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length >= 4) {
      onJoinSession(joinCode);
    }
  };

  return (
    <div className="flex flex-col min-h-[85vh] animate-fade-in p-6">
      {/* Guest Warning Banner */}
      {isAnonymous && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            <p className="font-semibold">You're using Splitn as a guest</p>
            <p className="mt-1">Sessions won't be saved to your history. Sign up to keep your sessions!</p>
          </div>
        </div>
      )}

      {/* Hero Section - Smaller when we have sessions */}
      <div className={`flex flex-col items-center justify-center text-center space-y-4 ${userSessions.length > 0 ? 'py-6' : 'flex-1 mt-8'}`}>
        <img src="/logo.png" alt="Splitn" className="w-20 h-20 rounded-3xl shadow-2xl shadow-blue-200 transform rotate-3" />

        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Splitn
          </h1>
          {userSessions.length === 0 && (
            <p className="text-base text-gray-500 dark:text-gray-400 max-w-xs mx-auto leading-relaxed">
              {t.home.welcome}
            </p>
          )}
        </div>
      </div>

      {/* My Sessions Section */}
      {(userSessions.length > 0 || loadingSessions) && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.home.yourSessions}</h2>
            <span className="text-sm text-gray-400">{userSessions.length} total</span>
          </div>

          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {userSessions.map((session) => (
                <div
                  key={session.id}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 dark:hover:border-primary/30 transition-all duration-200 text-left group active:scale-[0.98] cursor-pointer mb-2"
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary transition-colors">
                          {getSessionName(session)}
                        </h3>
                        {currentUserId && session.ownerId !== currentUserId ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                            <UserCheck className="w-3 h-3" />
                            Joined
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                            <Crown className="w-3 h-3" />
                            Hosted
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(session.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {session.participants?.length || 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {onDeleteSession && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this session? This cannot be undone.')) {
                              onDeleteSession(session.id);
                            }
                          }}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions Section */}
      <div className="flex-1 flex flex-col justify-end space-y-6 pb-8">

        {/* Create New Card */}
        <button
          onClick={onCreateNew}
          className="group relative overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left active:scale-[0.98]"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-24 h-24 text-primary" />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors">{t.dashboard.scanReceipt}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.home.startNew}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-primary rounded-full flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
              <Camera className="w-6 h-6" />
            </div>
          </div>
        </button>

        {/* Divider */}
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium uppercase tracking-wider">Or Join</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Join Input */}
        <form onSubmit={handleJoin} className="bg-white dark:bg-gray-900 p-2 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center gap-2 pl-4 focus-within:ring-2 focus-within:ring-primary/50 transition-shadow">
          <Users className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Enter Code (e.g. A4F2)"
            className="flex-1 py-3 bg-transparent border-none focus:ring-0 text-lg font-bold text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 uppercase"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <Button
            disabled={joinCode.length < 3}
            className="!rounded-xl !px-6"
            type="submit"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};
