import React, { useState } from 'react';
import { Participant } from '../types';
import { Button } from './Button';
import { User, UserPlus, X } from 'lucide-react';

interface ClaimParticipantModalProps {
    participants: Participant[];
    onClaim: (participantId: string) => void;
    onCreateNew: (name: string) => void;
    onClose: () => void;
    suggestedName?: string;
}

export const ClaimParticipantModal: React.FC<ClaimParticipantModalProps> = ({
    participants,
    onClaim,
    onCreateNew,
    onClose,
    suggestedName = ""
}) => {
    const [mode, setMode] = useState<'choose' | 'create'>('choose');
    const [newName, setNewName] = useState(suggestedName);

    // Get unclaimed participants
    const unclaimedParticipants = participants.filter(p => !p.claimedBy);

    const handleCreateSubmit = () => {
        if (newName.trim()) {
            onCreateNew(newName.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Join Session</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {mode === 'choose' ? (
                    <>
                        <p className="text-gray-600 mb-4">
                            {unclaimedParticipants.length > 0
                                ? "Select your name from the list, or create a new entry:"
                                : "No names available. Create your entry:"}
                        </p>

                        {/* Unclaimed Participants List */}
                        {unclaimedParticipants.length > 0 && (
                            <div className="space-y-2 mb-4 max-h-[200px] overflow-y-auto">
                                {unclaimedParticipants.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => onClaim(p.id)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-gray-200 hover:border-primary hover:bg-indigo-50 transition-all text-left"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-primary flex items-center justify-center font-bold">
                                            {p.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-semibold text-gray-900">{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Create New Button */}
                        <Button
                            variant="outline"
                            fullWidth
                            onClick={() => setMode('create')}
                            className="mt-2"
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            {unclaimedParticipants.length > 0 ? "I'm not on the list" : "Add my name"}
                        </Button>
                    </>
                ) : (
                    <>
                        <p className="text-gray-600 mb-4">Enter your name for this session:</p>

                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="Your name"
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 mb-4 focus:border-primary focus:outline-none text-lg"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateSubmit()}
                        />

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setMode('choose')}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleCreateSubmit}
                                disabled={!newName.trim()}
                                className="flex-1"
                            >
                                <User className="w-5 h-5 mr-2" />
                                Join
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
