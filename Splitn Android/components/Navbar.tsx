import React, { useState } from 'react';
import { Receipt, ChevronLeft, User as UserIcon, LogOut, Settings, X, Loader2, Moon, Sun, Languages } from 'lucide-react';
import { User } from 'firebase/auth';
import { Button } from './Button';
import { UserProfile } from '../services/userService';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface NavbarProps {
  onHome?: () => void;
  showHome?: boolean;
  sessionName?: string;
  user?: User | null;
  userProfile?: UserProfile | null;
  onSignOut?: () => void;
  onUpdateProfile?: (displayName: string) => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  onHome,
  showHome,
  sessionName,
  user,
  userProfile,
  onSignOut,
  onUpdateProfile
}) => {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [showMenu, setShowMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenProfileEdit = () => {
    setEditName(userProfile?.displayName || '');
    setShowProfileModal(true);
    setShowMenu(false);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim() || !onUpdateProfile) return;
    setSaving(true);
    try {
      await onUpdateProfile(editName.trim());
      setShowProfileModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-sm transition-all">
        <div className="max-w-2xl mx-auto flex items-center justify-between">

          {/* Left Side: Logo or Back Button */}
          <div className="flex items-center gap-2">
            {showHome ? (
              <button
                onClick={onHome}
                className="flex items-center text-gray-500 hover:text-gray-900 transition-colors -ml-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
              >
                <ChevronLeft className="w-5 h-5 mr-1" />
                <span className="font-medium">{t.common.back}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Splitn" className="w-8 h-8 rounded-lg" />
                <h1 className="text-xl font-bold tracking-tight text-gray-900">Splitn</h1>
              </div>
            )}
          </div>

          {/* Right Side: Active Session or User Profile */}
          <div className="flex items-center gap-3">
            {showHome && sessionName && (
              <div className="hidden sm:flex items-center text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-full truncate max-w-[200px]">
                {sessionName}
              </div>
            )}

            {user && onSignOut && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200 focus:ring-2 focus:ring-primary/20 transition-all border border-gray-200"
                >
                  {userProfile?.displayName ? (
                    <span className="text-sm font-bold text-gray-700">{userProfile.displayName[0].toUpperCase()}</span>
                  ) : user.email ? (
                    <span className="text-sm font-bold text-gray-700">{user.email[0].toUpperCase()}</span>
                  ) : (
                    <UserIcon className="w-5 h-5" />
                  )}
                </button>

                {/* Dropdown Menu */}
                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in-up origin-top-right">
                      <div className="px-4 py-2 border-b border-gray-100 mb-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{t.navbar.signedInAs}</p>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {user.isAnonymous ? t.navbar.guest : (userProfile?.displayName || user.email)}
                        </p>
                      </div>

                      {/* Theme Toggle */}
                      <button
                        onClick={() => toggleTheme()}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                          {t.navbar.darkMode}
                        </div>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${theme === 'dark' ? 'left-4.5' : 'left-0.5'}`} style={{ left: theme === 'dark' ? '18px' : '2px' }} />
                        </div>
                      </button>

                      {/* Language Toggle */}
                      <button
                        onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Languages className="w-4 h-4" />
                          {t.navbar.language}
                        </div>
                        <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-primary">
                          {language.toUpperCase()}
                        </span>
                      </button>

                      <div className="border-t border-gray-100 my-1" />

                      {/* Edit Profile - only for non-anonymous users */}
                      {!user.isAnonymous && onUpdateProfile && (
                        <button
                          onClick={handleOpenProfileEdit}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          {t.navbar.editProfile}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onSignOut();
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        {t.navbar.signOut}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none text-lg"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveProfile()}
                />
              </div>

              <Button fullWidth onClick={handleSaveProfile} disabled={!editName.trim() || saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};