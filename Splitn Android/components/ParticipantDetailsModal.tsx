import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Edit2 } from 'lucide-react';
import { ReceiptSession, Participant, ItemInstance } from '../types';
import { Button } from './Button';
import { Avatar } from './Avatar';

interface ParticipantDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    participant: Participant;
    session: ReceiptSession;
    onEdit: () => void;
}

export const ParticipantDetailsModal: React.FC<ParticipantDetailsModalProps> = ({
    isOpen,
    onClose,
    participant,
    session,
    onEdit
}) => {
    if (!isOpen) return null;

    // Calculate breakdown
    const claimedItems: Array<{
        name: string;
        share: number; // e.g. 0.5 for half
        cost: number;
        totalParts: number;
        myParts: number;
    }> = [];

    let totalCost = 0;

    session.items.forEach(item => {
        const instances = session.itemStates[item.id] || [];
        instances.forEach((inst, idx) => {
            const myParts = inst.claims[participant.id] || 0;
            if (myParts > 0) {
                const share = myParts / inst.totalParts;
                const cost = item.unitPrice * share;
                totalCost += cost;

                const itemName = instances.length > 1
                    ? `${item.name} (${idx + 1}/${instances.length})`
                    : item.name;

                claimedItems.push({
                    name: itemName,
                    share,
                    cost,
                    totalParts: inst.totalParts,
                    myParts
                });
            }
        });
    });

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <Avatar name={participant.name} size="lg" className="shadow-md" />
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{participant.name}</h3>
                                <p className="text-sm text-gray-500 font-medium">Breakdown</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 -mt-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {claimedItems.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No items claimed yet</p>
                            </div>
                        ) : (
                            claimedItems.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            {item.share < 0.99 ? (
                                                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                                                    {item.myParts}/{item.totalParts} split
                                                </span>
                                            ) : (
                                                <span className="text-emerald-600 font-medium">Full item</span>
                                            )}
                                        </p>
                                    </div>
                                    <span className="font-bold text-gray-900">${item.cost.toFixed(2)}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-white border-t border-gray-100 space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-gray-500 font-medium">Total Owed</span>
                            <span className="text-3xl font-black text-primary">${totalCost.toFixed(2)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button onClick={onClose} variant="outline" className="h-12">
                                Close
                            </Button>
                            <Button onClick={onEdit} className="h-12 gap-2">
                                <Edit2 className="w-4 h-4" /> Edit Items
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
