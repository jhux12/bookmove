import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let openModalCount = 0;
let originalOverflow = '';

// Native modal dialogs provide focus trapping, background inertness, Escape,
// and focus restoration without maintaining a second keyboard implementation.
export function Modal({
  children,
  onClose,
  label,
  className = '',
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (openModalCount === 0) originalOverflow = document.body.style.overflow;
    openModalCount++;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      openModalCount--;
      if (openModalCount === 0) document.body.style.overflow = originalOverflow;
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.target === e.currentTarget &&
          (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        )
          onClose();
      }}
      className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-400/15 bg-[#161E29] p-0 text-slate-100 backdrop:bg-black/70 backdrop:backdrop-blur-sm ${className}`}
    >
      {children}
    </dialog>,
    document.body
  );
}
