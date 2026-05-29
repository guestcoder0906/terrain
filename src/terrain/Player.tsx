import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainY } from './utils';

export const Player = ({ 
  joystickState, 
  moveSpeed, 
  bobbingIntensity, 
  hillSteepness, 
  hillDensity, 
  plainsPrevalence, 
  hillsPrevalence, 
  mountainPrevalence, 
  mountainHeight, 
  basins, 
  rivers, 
  treePositions, 
  jumpForce, 
  gravity, 
  jumpTrigger 
}: any) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const bobbingTime = useRef(0);
  const isJumping = useRef(false);
  const verticalVelocity = useRef(0);
  const keyboardState = useRef({ forward: 0, right: 0 });

  useEffect(() => {
    if (jumpTrigger) {
      jumpTrigger.current = () => {
        if (!isJumping.current) {
          isJumping.current = true;
          verticalVelocity.current = jumpForce;
        }
      };
    }
  }, [jumpForce, jumpTrigger]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'arrowup') keyboardState.current.forward = 1;
      if (key === 's' || e.key === 'arrowdown') keyboardState.current.forward = -1;
      if (key === 'a' || e.key === 'arrowleft') keyboardState.current.right = -1;
      if (key === 'd' || e.key === 'arrowright') keyboardState.current.right = 1;
      if (e.key === ' ') {
        e.preventDefault();
        if (jumpTrigger && jumpTrigger.current) jumpTrigger.current();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'arrowup') keyboardState.current.forward = 0;
      if (key === 's' || e.key === 'arrowdown') keyboardState.current.forward = 0;
      if (key === 'a' || e.key === 'arrowleft') keyboardState.current.right = 0;
      if (key === 'd' || e.key === 'arrowright') keyboardState.current.right = 0;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [jumpTrigger]);

  useEffect(() => {
    camera.position.set(0, 5, 5);
    camera.rotation.order = 'YXZ';
  }, [camera]);

  useFrame((state, delta) => {
    let { x: joystickX, y: joystickY } = joystickState.current;
    
    if (keyboardState.current.right !== 0) joystickX = keyboardState.current.right;
    if (keyboardState.current.forward !== 0) joystickY = -keyboardState.current.forward;

    let moveDirection = new THREE.Vector3(joystickX, 0, joystickY);
    if (moveDirection.lengthSq() > 1) moveDirection.normalize();
    moveDirection.applyEuler(camera.rotation);

    const speed = moveSpeed * delta;
    velocity.current.lerp(moveDirection.multiplyScalar(speed), 0.1);

    const prevPosition = camera.position.clone();

    if (velocity.current.lengthSq() > 0.0001) {
      camera.position.add(velocity.current);
      bobbingTime.current += delta * moveSpeed * 0.5;
    }

    const terrainY = getTerrainY(camera.position.x, camera.position.z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
    
    const playerRadius = 0.5;
    let collided = false;
    for (const treePos of treePositions) {
      const treeY = getTerrainY(treePos.x, treePos.z, hillDensity, hillSteepness, plainsPrevalence, hillsPrevalence, mountainPrevalence, mountainHeight, basins, rivers);
      const dx = camera.position.x - treePos.x;
      const dz = camera.position.z - treePos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const treeRadius = 0.5;
      
      if (distance < treeRadius + playerRadius && camera.position.y < treeY + 10) {
        collided = true;
        break;
      }
    }

    if (collided) {
      camera.position.copy(prevPosition);
      if (navigator.vibrate) navigator.vibrate(50);
    }

    if (isJumping.current) {
      verticalVelocity.current -= gravity * delta;
      camera.position.y += verticalVelocity.current * delta;
      
      const groundY = terrainY + 1.7;
      if (camera.position.y <= groundY) {
        camera.position.y = groundY;
        isJumping.current = false;
        verticalVelocity.current = 0;
      }
    } else {
      const targetY = terrainY + 1.7;
      let bobbingOffset = 0;
      if (velocity.current.lengthSq() > 0.001) {
          bobbingOffset = Math.sin(bobbingTime.current) * bobbingIntensity;
      }
      
      camera.position.y += (targetY + bobbingOffset - camera.position.y) * 0.1;
    }
  });

  return null;
};

export const LookController = () => {
  const { camera, gl } = useThree();
  const touchId = useRef<number | null>(null);
  const previousTouch = useRef({ x: 0, y: 0 });
  const isMouseDown = useRef(false);

  useEffect(() => {
    const canvasEl = gl.domElement;

    const handleTouchStart = (e: TouchEvent) => {
      let element = e.target as HTMLElement;
      while (element) {
        if (element.dataset?.isControlButton) return;
        element = element.parentElement as HTMLElement;
      }
      
      if (touchId.current === null) {
        const touch = e.changedTouches[0];
        touchId.current = touch.identifier;
        previousTouch.current.x = touch.clientX;
        previousTouch.current.y = touch.clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === touchId.current) {
          const sensitivity = 0.004;
          const dx = touch.clientX - previousTouch.current.x;
          const dy = touch.clientY - previousTouch.current.y;

          camera.rotation.y -= dx * sensitivity;
          camera.rotation.x -= dy * sensitivity;

          camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

          previousTouch.current.x = touch.clientX;
          previousTouch.current.y = touch.clientY;
          break;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === touchId.current) {
          touchId.current = null;
          break;
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown.current = true;
      previousTouch.current.x = e.clientX;
      previousTouch.current.y = e.clientY;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown.current) return;
      const sensitivity = 0.004;
      const dx = e.clientX - previousTouch.current.x;
      const dy = e.clientY - previousTouch.current.y;

      camera.rotation.y -= dx * sensitivity;
      camera.rotation.x -= dy * sensitivity;
      camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

      previousTouch.current.x = e.clientX;
      previousTouch.current.y = e.clientY;
    };
    
    const handleMouseUp = () => {
      isMouseDown.current = false;
    };

    canvasEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvasEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvasEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvasEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    canvasEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvasEl.removeEventListener('touchstart', handleTouchStart);
      canvasEl.removeEventListener('touchmove', handleTouchMove);
      canvasEl.removeEventListener('touchend', handleTouchEnd);
      canvasEl.removeEventListener('touchcancel', handleTouchEnd);
      
      canvasEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [camera, gl]);

  return null;
};
