import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    singleButton?: boolean; // Acts as Alert if true
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDestructive = false,
    onConfirm,
    onCancel,
    singleButton = false
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
                    onClick={singleButton ? onConfirm : onCancel}
                />

                {/* Dialog (iOS Style) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", duration: 0.4, bounce: 0.3 }}
                    className="relative w-full max-w-[270px] bg-[#F2F2F2]/90 dark:bg-gray-800/95 backdrop-blur-xl rounded-[14px] text-center overflow-hidden shadow-xl"
                >
                    <div className="p-4 grid gap-1">
                        <h3 className="font-semibold text-[17px] leading-6 text-black dark:text-white">
                            {title}
                        </h3>
                        {description && (
                            <p className="text-[13px] leading-[18px] text-black/80 dark:text-gray-300">
                                {description}
                            </p>
                        )}
                    </div>

                    <div className="border-t border-gray-300/50 dark:border-gray-700/50 flex">
                        {!singleButton && (
                            <>
                                <button
                                    onClick={onCancel}
                                    className="flex-1 py-3 text-[17px] text-[#007AFF] dark:text-blue-400 font-normal hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-colors border-r border-gray-300/50 dark:border-gray-700/50"
                                >
                                    {cancelText}
                                </button>
                            </>
                        )}
                        <button
                            onClick={onConfirm}
                            className={`flex-1 py-3 text-[17px] font-semibold hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/20 transition-colors ${isDestructive ? 'text-[#FF3B30] dark:text-red-400' : 'text-[#007AFF] dark:text-blue-400'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
