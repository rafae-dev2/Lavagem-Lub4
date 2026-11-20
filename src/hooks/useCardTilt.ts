import type React from 'react';
import {
  calculateCardTilt,
  CardTiltOptions,
  NEUTRAL_CARD_TILT,
  shouldSuppressTiltTarget,
} from '../lib/cardTilt';

const activeFrames = new WeakMap<HTMLElement, number>();
const touchResetTimers = new WeakMap<HTMLElement, number>();

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clearScheduledFrame(element: HTMLElement): void {
  const frameId = activeFrames.get(element);
  if (frameId !== undefined && typeof window !== 'undefined') {
    window.cancelAnimationFrame(frameId);
    activeFrames.delete(element);
  }
}

function clearTouchResetTimer(element: HTMLElement): void {
  const timerId = touchResetTimers.get(element);
  if (timerId !== undefined && typeof window !== 'undefined') {
    window.clearTimeout(timerId);
    touchResetTimers.delete(element);
  }
}

function writeTiltVariables(
  element: HTMLElement,
  tilt: ReturnType<typeof calculateCardTilt>,
  tilting: boolean,
): void {
  element.style.setProperty('--tilt-rx', `${tilt.rotateX}deg`);
  element.style.setProperty('--tilt-ry', `${tilt.rotateY}deg`);
  element.style.setProperty('--tilt-ty', `${tilt.translateY}px`);
  element.style.setProperty('--tilt-scale', `${tilt.scale}`);
  element.style.setProperty('--tilt-gx', `${tilt.glareX}%`);
  element.style.setProperty('--tilt-gy', `${tilt.glareY}%`);
  element.style.setProperty('--tilt-glare', `${tilt.glareOpacity}`);
  if (tilting) {
    element.style.transform = `perspective(920px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) translate3d(0, ${tilt.translateY}px, 0) scale3d(${tilt.scale}, ${tilt.scale}, 1)`;
  } else {
    element.style.removeProperty('transform');
  }
  element.classList.toggle('is-tilting', tilting);
}

export function resetCardTilt(element: HTMLElement | null): void {
  if (!element) return;
  clearScheduledFrame(element);
  clearTouchResetTimer(element);
  writeTiltVariables(element, NEUTRAL_CARD_TILT, false);
}

function scheduleTiltAtPoint(
  element: HTMLElement,
  clientX: number,
  clientY: number,
  options: CardTiltOptions,
): void {
  if (prefersReducedMotion()) return;
  clearScheduledFrame(element);
  const frameId = window.requestAnimationFrame(() => {
    activeFrames.delete(element);
    const rect = element.getBoundingClientRect();
    const result = calculateCardTilt(clientX, clientY, rect, options);
    writeTiltVariables(element, result, true);
  });
  activeFrames.set(element, frameId);
}

export interface CardTiltHandlers<T extends HTMLElement = HTMLElement> {
  onPointerEnter: (event: React.PointerEvent<T>) => void;
  onPointerMove: (event: React.PointerEvent<T>) => void;
  onPointerLeave: (event: React.PointerEvent<T>) => void;
  onPointerDown: (event: React.PointerEvent<T>) => void;
  onPointerUp: (event: React.PointerEvent<T>) => void;
  onPointerCancel: (event: React.PointerEvent<T>) => void;
  onTouchStart: (event: React.TouchEvent<T>) => void;
  onTouchMove: (event: React.TouchEvent<T>) => void;
  onTouchEnd: (event: React.TouchEvent<T>) => void;
  onTouchCancel: (event: React.TouchEvent<T>) => void;
  onDragStart: (event: React.DragEvent<T>) => void;
}

export interface UseCardTiltConfig extends CardTiltOptions {
  disabled?: boolean;
}

export function getCardTiltProps<T extends HTMLElement = HTMLElement>(
  config: UseCardTiltConfig = {},
): CardTiltHandlers<T> {
  const { disabled = false, ...options } = config;

  const isTargetSuppressed = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return shouldSuppressTiltTarget(el.tagName);
  };

  const applyFromCoords = (element: T, clientX: number, clientY: number, target: EventTarget | null) => {
    if (disabled || isTargetSuppressed(target)) return;
    clearTouchResetTimer(element);
    scheduleTiltAtPoint(element, clientX, clientY, options);
  };

  const scheduleTouchRelease = (element: T) => {
    clearTouchResetTimer(element);
    const timer = window.setTimeout(() => {
      touchResetTimers.delete(element);
      resetCardTilt(element);
    }, 180);
    touchResetTimers.set(element, timer);
  };

  return {
    onPointerEnter: (event) => {
      if (event.pointerType === 'touch') return;
      applyFromCoords(event.currentTarget, event.clientX, event.clientY, event.target);
    },
    onPointerMove: (event) => {
      if (event.pointerType === 'touch') return;
      applyFromCoords(event.currentTarget, event.clientX, event.clientY, event.target);
    },
    onPointerLeave: (event) => {
      if (event.pointerType === 'touch') return;
      resetCardTilt(event.currentTarget);
    },
    onPointerDown: (event) => {
      applyFromCoords(event.currentTarget, event.clientX, event.clientY, event.target);
    },
    onPointerUp: (event) => {
      if (event.pointerType === 'touch') {
        scheduleTouchRelease(event.currentTarget);
      }
    },
    onPointerCancel: (event) => {
      resetCardTilt(event.currentTarget);
    },
    onTouchStart: (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      applyFromCoords(event.currentTarget, touch.clientX, touch.clientY, event.target);
    },
    onTouchMove: (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      applyFromCoords(event.currentTarget, touch.clientX, touch.clientY, event.target);
    },
    onTouchEnd: (event) => {
      scheduleTouchRelease(event.currentTarget);
    },
    onTouchCancel: (event) => {
      resetCardTilt(event.currentTarget);
    },
    onDragStart: (event) => {
      resetCardTilt(event.currentTarget);
    },
  };
}
