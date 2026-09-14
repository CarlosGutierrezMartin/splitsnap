import React from 'react';
import { SplitItem } from '../types';
import { Button } from './Button';
import { Share2 } from 'lucide-react';

interface SummaryViewProps {
  splitItems: SplitItem[]; // Note: This type is compatible but the data feeding it needs to be correct in parent if used.
  onReset: () => void;
}

// Helper to format quantity
const formatQuantity = (value: number): string => {
  if (value < 0.01) return "0";
  return parseFloat(value.toFixed(2)).toString();
};

export const SummaryView: React.FC<SummaryViewProps> = ({ splitItems, onReset }) => {
  const myItems = splitItems.filter(item => item.claimedQuantity > 0.001);
  const total = myItems.reduce((sum, item) => sum + (item.claimedQuantity * item.unitPrice), 0);

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in pb-20">
      <div className="text-center mb-8 mt-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
            <span className="text-2xl font-bold">$</span>
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Your Breakdown</h2>
        <p className="text-gray-500">Here is what you need to pay</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-100">
           <div className="flex justify-between items-end mb-2">
                <span className="text-gray-500 text-sm font-medium uppercase tracking-wide">Total Due</span>
                <span className="text-4xl font-black text-gray-900">${total.toFixed(2)}</span>
           </div>
        </div>

        <div className="divide-y divide-gray-100">
            {myItems.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 min-w-[2.5rem]">
                            {formatQuantity(item.claimedQuantity)}x
                         </div>
                         <div>
                             <p className="font-semibold text-gray-900">{item.name}</p>
                             <p className="text-xs text-gray-500">@ ${item.unitPrice.toFixed(2)}/ea</p>
                         </div>
                    </div>
                    <span className="font-bold text-gray-900">
                        ${(item.claimedQuantity * item.unitPrice).toFixed(2)}
                    </span>
                </div>
            ))}
        </div>
        
        {myItems.length === 0 && (
            <div className="p-8 text-center text-gray-400 italic">
                No items selected.
            </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button variant="outline" onClick={() => alert("Sharing feature coming soon!")}>
            <Share2 className="w-5 h-5 mr-2" /> Share
        </Button>
        <Button variant="primary" onClick={onReset}>
            Scan New Receipt
        </Button>
      </div>
    </div>
  );
};