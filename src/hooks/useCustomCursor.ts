import React, { useEffect } from 'react';

export const useCustomCursor = (cursorRef: React.RefObject<HTMLDivElement>) => {
  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;
    let isHovered = false;
    let frameId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const updatePosition = () => {
      currentX = mouseX;
      currentY = mouseY;
      if (el) {
        // Compute both scale and translation together to prevent rendering conflicts (jitters)
        const scaleVal = isHovered ? 1.15 : 1;
        el.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale(${scaleVal})`;
      }
      frameId = requestAnimationFrame(updatePosition);
    };

    window.addEventListener('mousemove', onMouseMove);
    frameId = requestAnimationFrame(updatePosition);

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const isInteractive = 
        target.tagName.toLowerCase() === 'a' || 
        target.tagName.toLowerCase() === 'button' || 
        target.tagName.toLowerCase() === 'input' || 
        target.tagName.toLowerCase() === 'textarea' || 
        target.closest('a') ||
        target.closest('button') ||
        target.classList.contains('cursor-pointer') ||
        target.closest('.cursor-pointer');

      isHovered = !!isInteractive;
    };

    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(frameId);
    };
  }, [cursorRef]);

  return {};
};
