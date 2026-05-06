import React, { useRef } from 'react';
import { useCustomCursor } from '../../hooks/useCustomCursor';

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  useCustomCursor(cursorRef);

  return (
    <div
      ref={cursorRef}
      className="custom-cursor-wrapper"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        width: '24px',
        height: '24px',
        transform: 'translate(-50%, -50%)',
        willChange: 'transform',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="32" height="32" viewBox="0 0 24 24" fill="none"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          transform: 'translate(-10%, -10%) rotate(-5deg)'
        }}
      >
        <path 
          d="M5.5 3.5L18.5 10.5L11.5 12.5L9.5 20.5L5.5 3.5Z" 
          fill="#ffffff" 
          stroke="none"
        />
      </svg>
    </div>
  );
};
