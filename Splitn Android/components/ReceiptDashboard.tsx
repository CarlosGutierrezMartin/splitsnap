import React from 'react';
import { ReceiptSession, ItemInstance } from '../types';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as LinkIcon, Plus, Edit2, Copy } from 'lucide-react';
import { Avatar } from './Avatar';
import { ParticipantDetailsModal } from './ParticipantDetailsModal';
import { Participant } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ReceiptDashboardProps {
  session: ReceiptSession;
  isAdmin: boolean;
  onAddParticipant: () => void;
  onEditParticipant: (participantId: string) => void;
  onShare: () => void;
}

export const ReceiptDashboard: React.FC<ReceiptDashboardProps> = ({
  session,
  isAdmin,
  onAddParticipant,
  onEditParticipant,
  onShare
}) => {
  const { t } = useLanguage();
  // ... (existing code for totals) ...

  const totalBill = session.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // ... (rest of the component until return) ...



  // Calculate Total Claimed from ItemStates
  let totalClaimed = 0;

  const participantTotals: Record<string, number> = {};
  const participantClaimCounts: Record<string, number> = {};

  session.participants.forEach(p => {
    participantTotals[p.id] = 0;
    participantClaimCounts[p.id] = 0;
  });

  Object.entries(session.itemStates).forEach(([itemId, instances]: [string, ItemInstance[]]) => {
    const item = session.items.find(i => i.id === itemId);
    if (!item) return;

    // Iterate through instances
    instances.forEach(inst => {
      Object.entries(inst.claims).forEach(([userId, partsClaimed]) => {
        const costShare = (item.unitPrice / inst.totalParts) * partsClaimed;
        totalClaimed += costShare;

        if (participantTotals[userId] !== undefined) {
          participantTotals[userId] += costShare;
          participantClaimCounts[userId] += 1;
        }
      });
    });
  });

  const remaining = totalBill - totalClaimed;
  const progressPercent = Math.min(100, (totalClaimed / totalBill) * 100);

  const [selectedParticipant, setSelectedParticipant] = React.useState<Participant | null>(null);

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in pb-24">
      {selectedParticipant && (
        <ParticipantDetailsModal
          isOpen={true}
          onClose={() => setSelectedParticipant(null)}
          participant={selectedParticipant}
          session={session}
          onEdit={() => {
            setSelectedParticipant(null);
            onEditParticipant(selectedParticipant.id);
          }}
        />
      )}

      {/* Session Code Banner */}
      <div className="flex justify-between items-center bg-gray-900 text-white p-3 rounded-t-2xl px-6 shadow-lg mb-[-10px] relative z-0">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Join Code</span>
        <div className="flex items-center gap-2 cursor-pointer hover:text-indigo-300" onClick={onShare}>
          <span className="text-xl font-mono font-bold tracking-widest">{session.joinCode || 'DEMO'}</span>
          <Copy className="w-4 h-4" />
        </div>
      </div>

      {/* Header Card */}
      <div className="relative z-10 bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden mb-6">
        <div className="bg-primary/5 dark:bg-primary/10 p-6 text-center border-b border-primary/10 dark:border-primary/5">
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm uppercase tracking-wider mb-1">{t.dashboard.total}</p>
          <h2 className="text-5xl font-black text-gray-900 dark:text-white">${totalBill.toFixed(2)}</h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-emerald-600 dark:text-emerald-400">Paid: ${totalClaimed.toFixed(2)}</span>
              <span className="text-gray-500 dark:text-gray-400">{t.dashboard.remaining}: ${Math.max(0, remaining).toFixed(2)}</span>
            </div>
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>


        </div>
      </div>

      {/* Participants List */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">{t.dashboard.members}</h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">{session.participants.length} people</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-3"
        >
          <AnimatePresence>
            {session.participants.map((p, i) => {
              const pTotal = participantTotals[p.id] || 0;
              const pCount = participantClaimCounts[p.id] || 0;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  onClick={() => setSelectedParticipant(p)}
                  className="group bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between hover:border-primary/50 cursor-pointer"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={p.name} size="md" />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Involved in {pCount} instances
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 dark:text-white text-lg">${pTotal.toFixed(2)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditParticipant(p.id);
                      }}
                      className="p-2 -mr-2 text-gray-300 hover:text-primary hover:bg-gray-100 rounded-full transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Floating Action Button for Adding - Only for Admin */}
      {remaining > 0.01 && isAdmin && (
        <div className="fixed bottom-6 left-0 right-0 p-4 flex justify-center z-40 pointer-events-none">
          <div className="max-w-2xl w-full pointer-events-auto shadow-2xl rounded-xl">
            <Button onClick={onAddParticipant} fullWidth className="py-4 text-lg">
              <Plus className="w-6 h-6 mr-2" />
              {session.participants.length === 0 ? "Start Splitting" : "Add Person"}
            </Button>
          </div>
        </div>
      )}

      {remaining <= 0.01 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-800">
          <p className="font-bold text-lg">Receipt Fully Paid! 🎉</p>
        </div>
      )}
    </div>
  );
};