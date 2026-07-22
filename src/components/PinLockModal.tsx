import React, { useState, useEffect } from 'react';
import { Lock, Delete, ShieldCheck, AlertCircle, KeyRound, RefreshCw } from 'lucide-react';

interface PinLockModalProps {
  storedPin: string;
  onUnlock: () => void;
  storeName?: string;
}

export function PinLockModal({ storedPin, onUnlock, storeName = 'Store #4812' }: PinLockModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showMasterReset, setShowMasterReset] = useState(false);
  const [masterInput, setMasterInput] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const targetLength = storedPin.length || 4;

  const handleKeyPress = (num: string) => {
    if (pinInput.length < 8) {
      const next = pinInput + num;
      setPinInput(next);
      setError(false);
      
      // Auto submit if reached target length
      if (next.length === targetLength) {
        verifyPin(next);
      }
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPinInput('');
    setError(false);
  };

  const verifyPin = (input: string) => {
    if (input === storedPin || input === '4812') { // '4812' is default master store PIN
      setError(false);
      setPinInput('');
      onUnlock();
    } else {
      setError(true);
      setAttempts((a) => a + 1);
      setTimeout(() => {
        setPinInput('');
      }, 500);
    }
  };

  // Keyboard handler for physical keyboard users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinInput, storedPin]);

  const handleMasterReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterInput === '4812') {
      // Default master store PIN resets local storage PIN to 4812
      localStorage.setItem('idealpos_security_pin', '4812');
      localStorage.setItem('idealpos_pin_enabled', 'true');
      setResetMessage('PIN reset to default store PIN: 4812');
      setTimeout(() => {
        onUnlock();
      }, 1000);
    } else {
      setResetMessage('Invalid Store Master PIN (Default: 4812)');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-center p-6 sm:p-8 flex flex-col items-center">
        
        {/* Header Badge */}
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-4 animate-bounce-short">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          IdealPOS Security Lock
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {storeName} • Enter Passcode to Access
        </p>

        {/* PIN Indicators Dots */}
        <div className="flex items-center justify-center gap-3 my-6">
          {Array.from({ length: Math.max(targetLength, 4) }).map((_, idx) => {
            const isFilled = idx < pinInput.length;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  error
                    ? 'bg-rose-500 scale-110 shadow-md shadow-rose-500/30'
                    : isFilled
                    ? 'bg-blue-600 scale-110 shadow-md shadow-blue-500/30'
                    : 'bg-slate-200 border border-slate-300'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-xs text-rose-600 font-bold bg-rose-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 mb-2 animate-shake">
            <AlertCircle className="w-3.5 h-3.5" />
            Incorrect Passcode. Try again.
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] my-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleKeyPress(num)}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-blue-50 active:text-blue-600 active:scale-95 text-slate-800 text-xl font-bold transition-all shadow-xs border border-slate-200/60 flex items-center justify-center focus:outline-none"
            >
              {num}
            </button>
          ))}

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-100/70 hover:bg-slate-200 active:scale-95 text-slate-500 text-xs font-bold transition-all flex items-center justify-center focus:outline-none"
          >
            CLEAR
          </button>

          {/* 0 button */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-blue-50 active:text-blue-600 active:scale-95 text-slate-800 text-xl font-bold transition-all shadow-xs border border-slate-200/60 flex items-center justify-center focus:outline-none"
          >
            0
          </button>

          {/* Backspace button */}
          <button
            type="button"
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-slate-100/70 hover:bg-slate-200 active:scale-95 text-slate-600 transition-all flex items-center justify-center focus:outline-none"
            aria-label="Delete last digit"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Master reset option if failed multiple attempts */}
        {attempts >= 3 && !showMasterReset && (
          <button
            onClick={() => setShowMasterReset(true)}
            className="mt-4 text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Forgot PIN / Master Reset
          </button>
        )}

        {showMasterReset && (
          <form onSubmit={handleMasterReset} className="mt-4 w-full bg-slate-50 p-3 rounded-xl border border-slate-200 text-left space-y-2">
            <label className="text-[11px] font-bold text-slate-700 block">
              Store Master Reset PIN (Default: 4812)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={masterInput}
                onChange={(e) => setMasterInput(e.target.value)}
                placeholder="4812"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg"
              >
                Reset
              </button>
            </div>
            {resetMessage && (
              <p className="text-[11px] font-semibold text-blue-600 mt-1">{resetMessage}</p>
            )}
          </form>
        )}

        <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Secured by IdealPOS Lock Protection
        </div>
      </div>
    </div>
  );
}
