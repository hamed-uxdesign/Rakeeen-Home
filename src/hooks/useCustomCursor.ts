import React, { useEffect } from 'react';
import gsap from 'gsap';

export const useCustomCursor = (cursorRef: React.RefObject<HTMLDivElement>) => {
  useEffect(() => {
    if (!cursorRef.current) return;

    const xTo = gsap.quickTo(cursorRef.current, "x", { duration: 0.1, ease: "power2.out" });
    const yTo = gsap.quickTo(cursorRef.current, "y", { duration: 0.1, ease: "power2.out" });

    const onMouseMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };

    window.addEventListener('mousemove', onMouseMove);

    gsap.set(cursorRef.current, { 
      xPercent: -50, 
      yPercent: -50,
      width: 24,
      height: 24,
      position: 'fixed',
      top: 0,
      left: 0,
      pointerEvents: 'none',
      zIndex: 9999,
      mixBlendMode: 'difference',
      color: '#ffffff'
    });

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = 
        target.tagName.toLowerCase() === 'a' || 
        target.tagName.toLowerCase() === 'button' || 
        target.tagName.toLowerCase() === 'input' || 
        target.tagName.toLowerCase() === 'textarea' || 
        target.closest('a') ||
        target.closest('button');

      if (isInteractive) {
        gsap.to(cursorRef.current, { scale: 1.5, duration: 0.2, ease: "back.out(1.7)" });
      } else {
        gsap.to(cursorRef.current, { scale: 1, duration: 0.2, ease: "back.out(1.7)" });
      }
    };

    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [cursorRef]);

  return {};
};
