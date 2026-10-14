import { useEffect, useRef } from 'react';

export interface ModalA11yOptions {
  onEscape?: () => void;
  initialFocusSelector?: string;
}

/**
 * Hook mutualisé d'Accessibilité Modale (WCAG 2.2 SC 2.1.2 & SC 2.4.3)
 * 1. Sauvegarde et restauration du document.activeElement
 * 2. Écoute globale de la touche Escape (avec support d'un gestionnaire personnalisé)
 * 3. Focus trap (Tab / Shift+Tab bouclant sur les éléments focusables du containerRef)
 */
export function useModalA11y(
  isOpen: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLElement | null>,
  optionsOrEscape?: (() => void) | ModalA11yOptions
) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const onEscape = typeof optionsOrEscape === 'function' 
    ? optionsOrEscape 
    : optionsOrEscape?.onEscape;
  const initialFocusSelector = typeof optionsOrEscape === 'object' 
    ? optionsOrEscape?.initialFocusSelector 
    : undefined;

  useEffect(() => {
    if (!isOpen) return;

    // 1. Sauvegarde de l'élément actif avant ouverture
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

    // Focus initial sur le premier élément pertinent
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const target = initialFocusSelector
          ? containerRef.current.querySelector<HTMLElement>(initialFocusSelector)
          : containerRef.current.querySelector<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
        if (target) {
          target.focus();
        } else {
          containerRef.current.focus();
        }
      }
    }, 50);

    // 2. Écoute globale de la touche Escape et 3. Focus Trap (Tab / Shift+Tab)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onEscape) {
          onEscape();
        } else {
          onClose();
        }
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusables = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter(el => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === containerRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      // Restauration du focus initial
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, onEscape, containerRef, initialFocusSelector]);
}
