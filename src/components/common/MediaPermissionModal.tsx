import React from 'react';
import { Camera, Mic, AlertCircle, RefreshCw, X, ShieldAlert, Lock, HelpCircle } from 'lucide-react';
import type { MediaErrorInfo } from '../../types/index.ts';

interface MediaPermissionModalProps {
  error: MediaErrorInfo;
  onRetry: () => void;
  onDismiss: () => void;
}

export const MediaPermissionModal: React.FC<MediaPermissionModalProps> = ({
  error,
  onRetry,
  onDismiss,
}) => {
  const isCamera = error.kind === 'camera';

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-error-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#121422] border border-white/15 rounded-3xl p-6 md:p-7 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-indigo-500" />

        {/* Close Button */}
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Header with Kind Icon */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
            {error.errorKind === 'permission_denied' ? (
              <Lock size={22} />
            ) : isCamera ? (
              <Camera size={22} />
            ) : (
              <Mic size={22} />
            )}
          </div>
          <div className="pr-6">
            <h2 id="media-error-title" className="text-lg font-bold text-white mb-1">
              {error.title}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {error.message}
            </p>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="my-5 p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
            <HelpCircle size={14} />
            <span>How to resolve this in your browser:</span>
          </div>

          <ol className="space-y-2 text-xs text-slate-300 list-decimal list-inside pl-1">
            {error.instructions.map((step, idx) => (
              <li key={idx} className="leading-snug">
                <span className="text-slate-200">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Platform helper tips */}
        {error.errorKind === 'permission_denied' && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/90 mb-5 flex items-center gap-2">
            <ShieldAlert size={14} className="shrink-0 text-amber-400" />
            <span>
              Tip: In Chrome or Edge, click the <strong>tune/lock icon</strong> to the left of the URL bar, toggle {isCamera ? 'Camera' : 'Microphone'} to <strong>Allow</strong>, and then click Retry below.
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Continue Without {isCamera ? 'Camera' : 'Mic'}
          </button>

          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Retry {isCamera ? 'Camera' : 'Microphone'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
