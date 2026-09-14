import React, { useState } from 'react';
import { ReceiptSession, ItemInstance } from '../types';
import { Button } from './Button';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ChevronDown, ChevronUp, Split, PieChart, Users, X } from 'lucide-react';

interface SplitterViewProps {
    session: ReceiptSession;
    activeParticipantId: string;
    onSave: (updatedItemStates: Record<string, ItemInstance[]>) => void;
    onCancel: () => void;
}

export const SplitterView: React.FC<SplitterViewProps> = ({
    session,
    activeParticipantId,
    onSave,
    onCancel
}) => {
    const activeParticipant = session.participants.find(p => p.id === activeParticipantId);

    // Local state of all items. We clone it to allow editing before saving.
    const [itemStates, setItemStates] = useState<Record<string, ItemInstance[]>>(
        JSON.parse(JSON.stringify(session.itemStates))
    );

    // Track expanded items (accordion)
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    // Track which instance is currently being configured (for the Split # modal)
    const [configuringInstance, setConfiguringInstance] = useState<{ itemId: string, instanceIdx: number } | null>(null);

    if (!activeParticipant) return null;

    const toggleExpand = (itemId: string) => {
        const newSet = new Set(expandedItems);
        if (newSet.has(itemId)) newSet.delete(itemId);
        else newSet.add(itemId);
        setExpandedItems(newSet);
    };

    // Helper: Calculate my cost for display
    const calculateMyTotal = () => {
        let total = 0;
        session.items.forEach(item => {
            const instances = itemStates[item.id] || [];
            instances.forEach(inst => {
                const myParts = inst.claims[activeParticipantId] || 0;
                if (myParts > 0) {
                    total += (item.unitPrice / inst.totalParts) * myParts;
                }
            });
        });
        return total;
    };

    // --- Actions ---

    // 1. Set Denominator (e.g., "Split into 3")
    const setInstanceSplit = (itemId: string, instanceIdx: number, parts: number) => {
        setItemStates(prev => {
            const next = { ...prev };
            const instances = [...next[itemId]];
            const inst = { ...instances[instanceIdx] };

            // Changing parts resets claims if they become invalid, 
            // but normally we only allow this if claims are empty or we are the first.
            // For simplicity, if we change denominator, we keep existing claims if possible, 
            // or we could reset. Let's reset to avoid "2/1" claims.
            inst.totalParts = parts;
            inst.claims = {};

            // Auto-claim 1 part for the user doing the splitting
            inst.claims[activeParticipantId] = 1;

            instances[instanceIdx] = inst;
            next[itemId] = instances;
            return next;
        });
        setConfiguringInstance(null);
    };

    // 2. Claim a specific number of parts on an EXISTING split
    const togglePartClaim = (itemId: string, instanceIdx: number) => {
        setItemStates(prev => {
            const next = { ...prev };
            const instances = [...next[itemId]];
            const inst = { ...instances[instanceIdx] };

            const currentMyParts = inst.claims[activeParticipantId] || 0;
            const totalClaimedByAll = (Object.values(inst.claims) as number[]).reduce((a, b) => a + b, 0);
            const freeParts = inst.totalParts - totalClaimedByAll;

            // Logic: 
            // If I have 0, and there is free space -> +1
            // If I have > 0 -> -1 (Unclaim one part)

            let newMyParts = currentMyParts;

            if (currentMyParts > 0) {
                newMyParts = currentMyParts - 1;
            } else if (freeParts > 0) {
                newMyParts = currentMyParts + 1;
            }

            const newClaims = { ...inst.claims };
            if (newMyParts <= 0) delete newClaims[activeParticipantId];
            else newClaims[activeParticipantId] = newMyParts;

            inst.claims = newClaims;
            instances[instanceIdx] = inst;
            next[itemId] = instances;
            return next;
        });
    };

    // 3. Take Whole (Shortcut)
    const takeWhole = (itemId: string, instanceIdx: number) => {
        setItemStates(prev => {
            const next = { ...prev };
            const instances = [...next[itemId]];
            instances[instanceIdx] = {
                instanceId: instanceIdx,
                totalParts: 1,
                claims: { [activeParticipantId]: 1 }
            };
            next[itemId] = instances;
            return next;
        });
    };

    return (
        <div className="pb-32 animate-slide-up min-h-screen bg-gray-50">
            {/* Header */}
            <div className="sticky top-[60px] z-30 bg-white/90 backdrop-blur border-b border-gray-200 p-4 shadow-sm">
                <div className="max-w-2xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-sm">
                            {activeParticipant.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Selecting for</p>
                            <p className="font-bold text-gray-900 text-lg leading-none">{activeParticipant.name}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Your Share</p>
                        <p className="font-black text-primary text-2xl">${calculateMyTotal().toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {session.items.map(item => {
                    const instances = itemStates[item.id] || [];
                    const expanded = expandedItems.has(item.id);

                    // Calc stats for the header row
                    let myTotalShare = 0;
                    let unitsFullyClaimed = 0;

                    instances.forEach(inst => {
                        const myParts = inst.claims[activeParticipantId] || 0;
                        myTotalShare += (myParts / inst.totalParts);

                        const totalClaimed = (Object.values(inst.claims) as number[]).reduce((a, b) => a + b, 0);
                        if (totalClaimed >= inst.totalParts) unitsFullyClaimed++;
                    });

                    const remainingQty = item.quantity - unitsFullyClaimed;
                    const isItemAllPaid = remainingQty === 0;
                    const hasMyClaim = myTotalShare > 0;

                    return (
                        <div
                            key={item.id}
                            className={`
                            rounded-xl border transition-all duration-200 overflow-hidden
                            ${isItemAllPaid
                                    ? 'bg-gray-100 border-gray-200 opacity-60 grayscale'
                                    : 'bg-white'
                                }
                            ${hasMyClaim && !isItemAllPaid ? 'border-primary ring-1 ring-primary/20 shadow-md' : (!isItemAllPaid ? 'border-gray-200 shadow-sm' : '')}
                        `}
                        >
                            {/* Item Header Row */}
                            <button
                                onClick={() => toggleExpand(item.id)}
                                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className={`font-bold truncate text-lg ${isItemAllPaid ? 'text-gray-500' : 'text-gray-900'}`}>{item.name}</h4>
                                        <span className={`font-medium ml-2 whitespace-nowrap ${isItemAllPaid ? 'text-gray-400' : 'text-gray-900'}`}>
                                            ${item.unitPrice.toFixed(2)} <span className="text-xs text-gray-400 font-normal">/ unit</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 ${isItemAllPaid ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-600'}`}>
                                            Qty: {remainingQty}
                                            {remainingQty < item.quantity && (
                                                <span className="text-[10px] opacity-60">/ {item.quantity}</span>
                                            )}
                                        </span>
                                        {hasMyClaim && !isItemAllPaid && (
                                            <span className="text-primary font-bold">
                                                You pay: {myTotalShare < 0.99 && myTotalShare > 0 ? myTotalShare.toFixed(2) : Math.round(myTotalShare)} unit(s)
                                            </span>
                                        )}
                                        {isItemAllPaid && (
                                            <span className="text-emerald-600 flex items-center text-xs font-bold uppercase tracking-wide">
                                                <Check className="w-3 h-3 mr-1" /> Completed
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                                    <ChevronDown className="w-6 h-6" />
                                </div>
                            </button>

                            {/* Expanded Instances List */}
                            <AnimatePresence>
                                {expanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className={`border-t border-gray-100 overflow-hidden ${isItemAllPaid ? 'bg-gray-100' : 'bg-gray-50/50'}`}
                                    >
                                        <div className="p-3 space-y-3">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                                                Select parts for each unit
                                            </p>

                                            {instances.map((inst, idx) => {
                                                const totalClaimedParts = (Object.values(inst.claims) as number[]).reduce((a, b) => a + b, 0);
                                                const myParts = inst.claims[activeParticipantId] || 0;
                                                const isUntouched = totalClaimedParts === 0;
                                                const remainingParts = inst.totalParts - totalClaimedParts;
                                                const isSplit = inst.totalParts > 1;
                                                const isUnitFullyPaid = totalClaimedParts >= inst.totalParts;

                                                return (
                                                    <div key={idx} className={`rounded-lg border p-3 shadow-sm animate-fade-in ${isUnitFullyPaid ? 'bg-gray-50 border-gray-200 opacity-80' : 'bg-white border-gray-200'}`}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <span className={`text-sm font-bold flex items-center ${isUnitFullyPaid ? 'text-gray-400' : 'text-gray-700'}`}>
                                                                Unit #{idx + 1}
                                                                {isSplit && (
                                                                    <span className="ml-2 bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-extrabold">
                                                                        Split by {inst.totalParts}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {myParts > 0 && (
                                                                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                                                                    You pay {myParts}/{inst.totalParts}
                                                                </span>
                                                            )}
                                                            {isUnitFullyPaid && !myParts && (
                                                                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded flex items-center">
                                                                    <Check className="w-3 h-3 mr-1" /> Paid
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Action Area */}
                                                        {isUntouched ? (
                                                            /* Fresh Unit: Choice between Whole or Split */
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <button
                                                                    onClick={() => takeWhole(item.id, idx)}
                                                                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-emerald-100 bg-emerald-50 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition-colors"
                                                                >
                                                                    <Check className="w-4 h-4" /> Pay Full
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfiguringInstance({ itemId: item.id, instanceIdx: idx })}
                                                                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-indigo-100 bg-indigo-50 text-indigo-700 font-bold text-sm hover:bg-indigo-100 transition-colors"
                                                                >
                                                                    <Split className="w-4 h-4" /> Split...
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            /* Active Unit: Segmented Control */
                                                            <div className="space-y-2">
                                                                <div className="flex gap-1 h-10 w-full">
                                                                    {Array.from({ length: inst.totalParts }).map((_, partIdx) => {
                                                                        // Determine state of this segment
                                                                        // Logic: We don't track *which* specific segment index is claimed by whom, 
                                                                        // just the count. So we visualize visually.

                                                                        // Reconstruct visual array
                                                                        // [My Claims] [Other Claims] [Empty]

                                                                        let status = 'empty'; // empty, mine, other

                                                                        // To make this visual mapping stable, we iterate:
                                                                        let allocated = 0;
                                                                        // 1. Mine
                                                                        if (partIdx < myParts) {
                                                                            status = 'mine';
                                                                        } else {
                                                                            allocated += myParts;
                                                                            // 2. Others
                                                                            const otherClaimsCount = totalClaimedParts - myParts;
                                                                            if (partIdx < allocated + otherClaimsCount) {
                                                                                status = 'other';
                                                                            }
                                                                        }

                                                                        return (
                                                                            <motion.button
                                                                                key={partIdx}
                                                                                layout
                                                                                initial={false}
                                                                                animate={{
                                                                                    backgroundColor: status === 'mine' ? '#2A7DE1' : (status === 'other' ? '#D1D5DB' : '#FFFFFF'),
                                                                                    borderColor: status === 'mine' ? '#2A7DE1' : '#D1D5DB',
                                                                                    opacity: status === 'other' ? 0.5 : 1
                                                                                }}
                                                                                whileTap={{ scale: 0.95 }}
                                                                                transition={{ duration: 0.2 }}
                                                                                onClick={() => {
                                                                                    // Only allow interaction if it's mine (to remove) or empty (to add)
                                                                                    if (status === 'mine' || status === 'empty') {
                                                                                        togglePartClaim(item.id, idx);
                                                                                    }
                                                                                }}
                                                                                disabled={status === 'other'}
                                                                                className={`
                                                                        flex-1 first:rounded-l-md last:rounded-r-md border
                                                                        ${status === 'other' ? 'cursor-not-allowed' : ''}
                                                                    `}
                                                                                title={status === 'other' ? 'Taken by someone else' : 'Tap to claim/unclaim'}
                                                                            >
                                                                                {status === 'mine' && (
                                                                                    <motion.div
                                                                                        initial={{ scale: 0 }}
                                                                                        animate={{ scale: 1 }}
                                                                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                                                    >
                                                                                        <Check className="w-4 h-4 text-white mx-auto" />
                                                                                    </motion.div>
                                                                                )}
                                                                            </motion.button>
                                                                        );
                                                                    })}
                                                                </div>

                                                                {/* Helper text below bar */}
                                                                <div className="flex justify-between text-[10px] text-gray-500 font-medium px-1">
                                                                    <span>{remainingParts} parts left</span>
                                                                    {remainingParts > 0 && (
                                                                        <span className="text-primary">Tap empty block to claim</span>
                                                                    )}
                                                                    {remainingParts === 0 && (
                                                                        <span className="text-emerald-600 font-bold">Fully Claimed</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Modal for Number of Splits */}
            {configuringInstance && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-slide-up">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center">
                                <Users className="w-5 h-5 mr-2 text-primary" />
                                How many people?
                            </h3>
                            <button onClick={() => setConfiguringInstance(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-500 mb-6 text-center">
                                Split this specific unit into...
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {[2, 3, 4, 5, 6].map(num => (
                                    <button
                                        key={num}
                                        onClick={() => setInstanceSplit(configuringInstance.itemId, configuringInstance.instanceIdx, num)}
                                        className="py-4 rounded-xl border-2 border-gray-100 hover:border-primary hover:bg-indigo-50 hover:text-primary transition-all font-bold text-xl text-gray-700"
                                    >
                                        {num}
                                    </button>
                                ))}
                                {/* Custom Input Placeholder - keeping it simple for now */}
                                <button
                                    onClick={() => setInstanceSplit(configuringInstance.itemId, configuringInstance.instanceIdx, 8)}
                                    className="py-4 rounded-xl border-2 border-gray-100 hover:border-primary hover:bg-indigo-50 hover:text-primary transition-all font-bold text-xl text-gray-700"
                                >
                                    8
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sticky Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <Button variant="ghost" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => onSave(itemStates)}
                        fullWidth
                        variant="primary"
                    >
                        Confirm <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
};