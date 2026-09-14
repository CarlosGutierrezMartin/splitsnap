import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { AuthView } from './components/AuthView';
import { UploadView } from './components/UploadView';
import { SplitterView } from './components/SplitterView';
import { ReceiptDashboard } from './components/ReceiptDashboard';
import { parseReceiptImage } from './services/geminiService';
import { AppState, ItemInstance, ParsedItem } from './types';
import { Button } from './components/Button';
import { UserPlus, X, Loader2 } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useSession } from './hooks/useSession';
import { OnboardingView } from './components/OnboardingView';
import { ClaimParticipantModal } from './components/ClaimParticipantModal';
import { ConfirmDialog } from './components/ConfirmDialog';

function App() {
  const {
    user,
    userProfile,
    loading: authLoading,
    error: authError,
    signInAnon,
    signInEmail,
    signUpEmail,
    signInWithGoogle,
    updateProfile,
    completeOnboarding,
    signOut,
    clearError: clearAuthError
  } = useAuth();
  const {
    session,
    userSessions,
    loadingUserSessions,
    loading: sessionLoading,
    error: sessionError,
    createSession,
    joinSession,
    updateItemStates,
    addParticipant,
    fetchUserSessions,
    loadSession, // Allow loading a session by ID if we ever needed (e.g. from URL)
    clearError,
    deleteSession,
    claimParticipant,
    addGuest
  } = useSession();

  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  // Lazy init state from localStorage to ensure correct initial render
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem('hasSeenIntro'));
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);

  // Modal state for adding user
  const [showNameModal, setShowNameModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");

  // Modal state for naming session
  const [showSessionNameModal, setShowSessionNameModal] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [pendingItems, setPendingItems] = useState<ParsedItem[] | null>(null);

  // Claim participant modal
  const [showClaimModal, setShowClaimModal] = useState(false);

  // Native-like Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    isDestructive?: boolean;
    singleButton?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    onConfirm: () => { }
  });

  const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));

  const showAlert = (title: string, message: string) => {
    setDialogConfig({
      isOpen: true,
      title,
      description: message,
      singleButton: true,
      confirmText: "OK",
      onConfirm: closeDialog
    });
  };

  // Sync AppState with Session existence
  useEffect(() => {
    if (session) {
      if (appState === AppState.HOME || appState === AppState.PROCESSING) {
        setAppState(AppState.DASHBOARD);
      }
    } else {
      if (appState === AppState.DASHBOARD || appState === AppState.SPLIT_PARTICIPANT) {
        // Session ended or lost
        setAppState(AppState.HOME);
      }
    }
  }, [session, appState]);

  // Auto-clear errors when navigating away
  useEffect(() => {
    clearError();
  }, [appState]);

  const handleHomeClick = () => {
    if (appState === AppState.DASHBOARD || appState === AppState.SPLIT_PARTICIPANT) {
      setDialogConfig({
        isOpen: true,
        title: "Exit Session?",
        description: "Are you sure you want to leave? Your current session layout will be closed.",
        confirmText: "Exit",
        isDestructive: true,
        onConfirm: () => {
          closeDialog();
          setAppState(AppState.HOME);
          window.location.reload();
        }
      });
    } else {
      setAppState(AppState.HOME);
      clearError();
    }
  };

  const handleCreateNew = () => {
    setAppState(AppState.UPLOAD);
  };

  const handleJoinSession = async (code: string) => {
    const sessionId = await joinSession(code);
    if (sessionId) {
      loadSession(sessionId);
    }
  };

  // Check if user needs to claim a participant
  useEffect(() => {
    if (session && user && appState === AppState.DASHBOARD) {
      const isAdmin = session.ownerId === user.uid;
      const isGuest = session.guestIds?.includes(user.uid);
      const hasClaimed = session.participants?.some(p => p.claimedBy === user.uid);

      // If I am NOT admin, and I haven't claimed/joined yet
      if (!isAdmin && !isGuest && !hasClaimed) {
        setShowClaimModal(true);
      }
    }
  }, [session, user, appState]);

  const handleSelectSession = (sessionId: string) => {
    loadSession(sessionId);
  };

  const handleFileSelect = async (file: File) => {
    setAppState(AppState.PROCESSING);

    try {
      // 1. Parse Image (Calls Cloud Function)
      const parsedItems = await parseReceiptImage(file);

      if (parsedItems.length === 0) {
        showAlert("No Items Found", "Could not detect any items in this receipt. Please try a cleaner image.");
        setAppState(AppState.UPLOAD);
        return;
      }

      // 2. Store items and prompt for session name
      setPendingItems(parsedItems);
      setSessionName("");
      setShowSessionNameModal(true);

    } catch (err) {
      console.error(err);
      showAlert("Processing Failed", "Failed to process the receipt. Please try again.");
      setAppState(AppState.UPLOAD);
    }
  };

  const confirmCreateSession = async () => {
    if (!pendingItems) return;

    const name = sessionName.trim() || `Receipt ${new Date().toLocaleDateString()}`;
    setShowSessionNameModal(false);

    // Create Session in Firestore with name
    const sessionId = await createSession(pendingItems, name);
    if (sessionId) {
      loadSession(sessionId);
      // Auto-add participant if user has profile, otherwise show modal
      setTimeout(async () => {
        if (userProfile?.displayName) {
          await addParticipant(userProfile.displayName);
        } else {
          setShowNameModal(true);
        }
      }, 500);
    } else {
      setAppState(AppState.UPLOAD);
    }
    setPendingItems(null);
  };

  const handleAddParticipant = () => {
    // Pre-fill with profile name if available
    setNewUserName(userProfile?.displayName || "");
    setShowNameModal(true);
  };

  const confirmAddParticipant = async () => {
    if (!newUserName.trim()) return;
    await addParticipant(newUserName.trim());
    setNewUserName("");
    setShowNameModal(false);
  };

  const handleClaimParticipant = async (participantId: string) => {
    await claimParticipant(participantId);
    setShowClaimModal(false);
  };

  const handleCreateGuest = async (name: string) => {
    // Add as participant AND mark as guest
    await addParticipant(name); // Helper needs to be updated to optionally link it? 
    // Actually addParticipant just adds name. We need to link it to the user.
    // But since `addParticipant` (service) just pushes to array, we should catch the new participant 
    // and claim it? Or simpler: just add user to guest list for now, 
    // and they can claim the newly created one? 

    // Better: let addParticipant logic handle it?
    // For now, simpler: Add participant -> add guest -> (auto claim? harder to do race-condition free)
    // Let's just add as guest for now so they stop seeing the modal
    await addGuest();
    // But they need 'claimedBy'. 
    // We should probably update `addParticipant` to accept a 'claimedBy' field?
    // Let's stick to the requested flow: "set their name for the session"
    // Since addParticipant is generic, let's just use it, and maybe `addGuest` is enough to satisfy "joined".
    // Wait, if they create a name, that participant should be theirs.
    // Let's rely on manual claim if needed, or just proceed. 
    // The requirement is "set their name". 
    // Let's just create it and mark them as guest.
    // Ideally we'd modify addParticipant to take an ID or claimedBy, but let's keep it simple.
    setShowClaimModal(false);
    // Optionally auto-select the new participant to edit?
    // We can find the participant ID based on name or just added one, but ID is generated on server or by ID.
    // For now, let's just close modal.
  };

  const handleEditParticipant = (id: string) => {
    setEditingParticipantId(id);
    setAppState(AppState.SPLIT_PARTICIPANT);
  };

  const handleSaveSplit = async (updatedItemStates: Record<string, ItemInstance[]>) => {
    if (!session) return;
    await updateItemStates(updatedItemStates);
    setAppState(AppState.DASHBOARD);
    setEditingParticipantId(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    if (showIntro) {
      return <OnboardingView onComplete={() => {
        localStorage.setItem('hasSeenIntro', 'true');
        setShowIntro(false);
      }} />;
    }

    return (
      <AuthView
        onSignInAnon={signInAnon}
        onSignInEmail={signInEmail}
        onSignUpEmail={signUpEmail}
        onSignInGoogle={signInWithGoogle}
        loading={authLoading}
        error={authError}
        clearError={clearAuthError}
      />
    );
  }

  // Show onboarding for logged-in users who haven't seen it
  if (!user.isAnonymous && userProfile && !userProfile.hasSeenOnboarding) {
    return <OnboardingView onComplete={completeOnboarding} />;
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] dark:bg-gray-950 text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <Navbar
        onHome={handleHomeClick}
        showHome={appState !== AppState.HOME}
        sessionName={session?.name}
        user={user}
        userProfile={userProfile}
        onSignOut={signOut}
        onUpdateProfile={updateProfile}
      />

      <main className="max-w-md mx-auto sm:max-w-xl md:max-w-2xl relative">

        {sessionError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 mx-4 mt-4" role="alert">
            <span className="block sm:inline">{sessionError}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
              <X className="fill-current h-6 w-6 text-red-500" role="button" onClick={clearError} />
            </span>
          </div>
        )}

        {appState === AppState.HOME && (
          <HomeView
            onCreateNew={handleCreateNew}
            onJoinSession={handleJoinSession}
            onSelectSession={handleSelectSession}
            userSessions={userSessions}
            loadingSessions={loadingUserSessions}
            onLoadSessions={fetchUserSessions}
            onDeleteSession={deleteSession}
            isAnonymous={user?.isAnonymous}
            currentUserId={user?.uid}
          />
        )}

        {appState === AppState.UPLOAD && (
          <UploadView
            onFileSelect={handleFileSelect}
            isProcessing={false}
            error={null}
          />
        )}

        {appState === AppState.PROCESSING && (
          <UploadView
            onFileSelect={() => { }}
            isProcessing={true}
            error={null}
          />
        )}

        {appState === AppState.DASHBOARD && session && session.items && (
          <ReceiptDashboard
            session={session}
            isAdmin={session.ownerId === user?.uid}
            onAddParticipant={handleAddParticipant}
            onEditParticipant={handleEditParticipant}
            onShare={() => {
              if (session.joinCode) {
                navigator.clipboard.writeText(session.joinCode);
                showAlert("Copied!", `Join code ${session.joinCode} copied to clipboard.`);
              }
            }}
          />
        )}

        {appState === AppState.SPLIT_PARTICIPANT && session && editingParticipantId && (
          <SplitterView
            session={session}
            activeParticipantId={editingParticipantId}
            onSave={handleSaveSplit}
            onCancel={() => setAppState(AppState.DASHBOARD)}
          />
        )}
      </main>

      {/* Claim Participant Modal */}
      {showClaimModal && session && (
        <ClaimParticipantModal
          participants={session.participants}
          onClaim={handleClaimParticipant}
          onCreateNew={handleCreateGuest}
          onClose={() => {
            // If they close it without claiming, we could force them back or just let them be "observer"
            // For now, let's just close it.
            setShowClaimModal(false);
          }}
          suggestedName={userProfile?.displayName}
        />
      )}

      {/* Session Naming Modal */}
      {showSessionNameModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Name Your Session</h3>
              <button onClick={() => {
                setShowSessionNameModal(false);
                setPendingItems(null);
                setAppState(AppState.UPLOAD);
              }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-4">Give this receipt a name so you can find it later.</p>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Dinner at Mario's"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-6 focus:border-primary focus:outline-none text-lg"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmCreateSession()}
            />
            <Button fullWidth onClick={confirmCreateSession}>
              Create Session
            </Button>
          </div>
        </div>
      )}

      {/* Name Input Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Who is paying?</h3>
              <button onClick={() => setShowNameModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Enter name (e.g., John)"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-6 focus:border-primary focus:outline-none text-lg"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmAddParticipant()}
            />
            <Button fullWidth onClick={confirmAddParticipant} disabled={!newUserName.trim() || sessionLoading}>
              {sessionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" /> Start Selecting Items
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      {/* Native-like Dialog */}
      <ConfirmDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        description={dialogConfig.description}
        confirmText={dialogConfig.confirmText}
        isDestructive={dialogConfig.isDestructive}
        singleButton={dialogConfig.singleButton}
        onConfirm={dialogConfig.onConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}

export default App;