import React, { useState, useEffect, useRef } from 'react';

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({ isOpen, title, defaultValue = '', onSubmit, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Small delay to ensure the modal is rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-bg-surface border border-border-main rounded-lg shadow-xl w-96 p-4">
        <h2 className="text-text-primary font-semibold mb-4">{title}</h2>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-bg-base border border-border-main rounded p-2 text-text-primary outline-none focus:border-blue-500 mb-4"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded text-text-secondary hover:bg-bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
