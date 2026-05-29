import React, { useEffect, useRef } from 'react';

export const JumpButton = ({ onJump }: { onJump: () => void }) => {
  return (
    <div
      data-is-control-button="true"
      style={{
        position: 'absolute',
        bottom: '30px',
        right: '30px',
        width: '80px',
        height: '80px',
        backgroundColor: '#FFFFFF80',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
        cursor: 'pointer',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: 10,
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        onJump();
        if (navigator.vibrate) navigator.vibrate(50);
      }}
      onClick={onJump}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </div>
  );
};

export const Joystick = ({ onMove, joystickBaseColor, joystickHandleColor }: any) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const touchId = useRef<number | null>(null);
  
  const joystickRadius = 60; 
  const handleRadius = 25;

  const getNormalizedPositionAndUpdateHandle = (clientX: number, clientY: number) => {
    if (!baseRef.current || !handleRef.current) return { x: 0, y: 0 };
    
    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + joystickRadius;
    const centerY = rect.top + joystickRadius;

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = joystickRadius - handleRadius;

    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }
    
    handleRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    
    return { 
      x: dx / maxDistance, 
      y: dy / maxDistance 
    }; 
  };

  const handleStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (touchId.current === null) {
      touchId.current = touch.identifier;
      if (navigator.vibrate) navigator.vibrate(20);
      const newPos = getNormalizedPositionAndUpdateHandle(touch.clientX, touch.clientY);
      onMove(newPos);
    }
  };

  const handleMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === touchId.current) {
        const newPos = getNormalizedPositionAndUpdateHandle(touch.clientX, touch.clientY);
        onMove(newPos);
        break;
      }
    }
  };

  const handleEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (const touch of Array.from(e.changedTouches)) {
      if (touch.identifier === touchId.current) {
        touchId.current = null;
        if (navigator.vibrate) navigator.vibrate(20);
        if (handleRef.current) {
          handleRef.current.style.transform = `translate(-50%, -50%)`;
        }
        onMove({ x: 0, y: 0 });
        break;
      }
    }
  };
  
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
        if (touchId.current === null) {
            touchId.current = -1;
            if (navigator.vibrate) navigator.vibrate(20);
            const newPos = getNormalizedPositionAndUpdateHandle(e.clientX, e.clientY);
            onMove(newPos);
        }
    };
    const handleMouseMove = (e: MouseEvent) => {
        if (touchId.current === -1) {
            const newPos = getNormalizedPositionAndUpdateHandle(e.clientX, e.clientY);
            onMove(newPos);
        }
    };
    const handleMouseUp = () => {
        if (touchId.current === -1) {
            touchId.current = null;
            if (navigator.vibrate) navigator.vibrate(20);
            if (handleRef.current) {
                handleRef.current.style.transform = `translate(-50%, -50%)`;
            }
            onMove({ x: 0, y: 0 });
        }
    };

    const baseEl = baseRef.current;
    baseEl?.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
        baseEl?.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onMove]);

  return (
    <div
      ref={baseRef}
      data-is-control-button="true"
      style={{
        position: 'absolute',
        bottom: '30px',
        left: '30px',
        width: `${joystickRadius * 2}px`,
        height: `${joystickRadius * 2}px`,
        backgroundColor: joystickBaseColor,
        borderRadius: '50%',
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      <div
        ref={handleRef}
        style={{
          width: `${handleRadius * 2}px`,
          height: `${handleRadius * 2}px`,
          backgroundColor: joystickHandleColor,
          borderRadius: '50%',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          cursor: 'grab',
        }}
      />
    </div>
  );
};
