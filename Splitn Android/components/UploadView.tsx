import React, { useRef, useState } from 'react';
import { Camera, Upload, AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface UploadViewProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  error?: string | null;
}

export const UploadView: React.FC<UploadViewProps> = ({ onFileSelect, isProcessing, error }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-gray-900">Split bills instantly</h2>
        <p className="text-gray-500 text-lg">Upload a receipt to detect items automatically.</p>
      </div>

      <div 
        className={`
          relative w-full max-w-sm aspect-[4/5] sm:aspect-square 
          border-4 border-dashed rounded-3xl flex flex-col items-center justify-center 
          transition-all duration-300 cursor-pointer bg-white
          ${isDragging ? 'border-primary bg-indigo-50 scale-105' : 'border-gray-300 hover:border-primary hover:bg-gray-50'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        
        <div className="p-8 text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-100 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Camera className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            {isProcessing ? 'Analyzing...' : 'Tap to Scan'}
          </h3>
          <p className="text-sm text-gray-500">
            Take a photo or upload an image of your receipt
          </p>
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-3xl flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent"></div>
              <p className="text-primary font-medium animate-pulse">Reading receipt...</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="w-full max-w-sm p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="w-full max-w-sm">
         <Button 
            onClick={() => fileInputRef.current?.click()} 
            fullWidth 
            disabled={isProcessing}
            variant="outline"
         >
           <Upload className="w-5 h-5 mr-2" />
           Select from Gallery
         </Button>
      </div>
    </div>
  );
};
