import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface CompareSliderProps {
  beforeImage: string;
  afterImage: string;
  labelBefore?: string;
  labelAfter?: string;
}

export const CompareSlider: React.FC<CompareSliderProps> = ({
  beforeImage,
  afterImage,
  labelBefore = "RAW NEGATIVE",
  labelAfter = "PROCESSED"
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => setIsResizing(true), []);
  const handleMouseUp = useCallback(() => setIsResizing(false), []);
  
  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    let clientX: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = (e as MouseEvent).clientX;
    }
    
    const width = rect.width;
    const offset = clientX - rect.left;
    
    const newPosition = Math.max(0, Math.min(100, (offset / width) * 100));
    setPosition(newPosition);
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove as unknown as EventListener);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove as unknown as EventListener);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove as unknown as EventListener);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove as unknown as EventListener);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[500px] bg-[#0a0a0a] rounded-sm overflow-hidden cursor-col-resize select-none border border-zinc-800"
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      {/* Background (After Image) */}
      <img 
        src={afterImage} 
        alt="After" 
        className="absolute top-0 left-0 w-full h-full object-contain bg-[#0a0a0a]"
      />
      
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-green-400 border border-green-500/30 px-3 py-1 text-[10px] font-mono uppercase tracking-widest z-10 pointer-events-none">
        {labelAfter}
      </div>

      {/* Foreground (Before Image) - Clipped */}
      <div 
        className="absolute top-0 left-0 h-full overflow-hidden bg-[#0a0a0a]"
        style={{ width: `${position}%` }}
      >
        <img 
          src={beforeImage} 
          alt="Before" 
          className="absolute top-0 left-0 max-w-none h-full object-contain"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
        />
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-zinc-400 border border-zinc-700 px-3 py-1 text-[10px] font-mono uppercase tracking-widest pointer-events-none">
          {labelBefore}
        </div>
      </div>

      {/* Slider Handle - Red line like many pro tools */}
      <div 
        className="absolute top-0 bottom-0 w-[1px] bg-red-600 cursor-col-resize z-20"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-transparent border-2 border-red-600 rounded-full flex items-center justify-center text-white shadow-sm transform hover:scale-110 transition-transform bg-black/20 backdrop-blur-[1px]">
          <ChevronsLeftRight size={14} />
        </div>
      </div>
    </div>
  );
};