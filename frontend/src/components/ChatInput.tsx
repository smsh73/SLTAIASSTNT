import { useEffect, useRef, useCallback } from 'react';
import { usePromptSuggestion } from '../hooks/usePromptSuggestion';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  onSuggestionsChange: (suggestions: string[]) => void;
  onSuggestionsLoadingChange?: (loading: boolean) => void;
  loading: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onSuggestionsChange,
  onSuggestionsLoadingChange,
  loading,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { getSuggestions } = usePromptSuggestion();

  const debouncedGetSuggestions = useCallback((inputValue: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (!inputValue || inputValue.trim().length < 2) {
      onSuggestionsChange([]);
      onSuggestionsLoadingChange?.(false);
      return;
    }
    
    onSuggestionsLoadingChange?.(true);
    
    debounceRef.current = setTimeout(async () => {
      const trimmedValue = inputValue.trim();
      if (trimmedValue.length >= 2) {
        const wordArray = trimmedValue.split(/\s+/).filter((w) => w.length > 0);
        try {
          const suggestions = await getSuggestions(wordArray);
          onSuggestionsChange(suggestions);
        } finally {
          onSuggestionsLoadingChange?.(false);
        }
      }
    }, 300);
  }, [getSuggestions, onSuggestionsChange, onSuggestionsLoadingChange]);

  useEffect(() => {
    debouncedGetSuggestions(value);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, debouncedGetSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !loading) {
        onSend(value);
      }
    }
  };

  return (
    <div className="relative">
      <div className="flex items-end space-x-2 bg-white rounded-lg border border-gray-300 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-200">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
          className="flex-1 px-4 py-3 resize-none border-0 focus:outline-none focus:ring-0 text-gray-900 placeholder-gray-400"
          rows={1}
          aria-label="메시지 입력"
          aria-describedby="input-help"
          style={{
            minHeight: '52px',
            maxHeight: '200px',
          }}
        />
        <span id="input-help" className="sr-only">
          Enter 키로 전송, Shift+Enter로 줄바꿈
        </span>
        <button
          onClick={() => {
            if (value.trim() && !loading) {
              onSend(value);
            }
          }}
          disabled={!value.trim() || loading}
          className="m-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="메시지 전송"
          aria-disabled={!value.trim() || loading}
        >
          {loading ? '전송 중...' : '전송'}
        </button>
      </div>
    </div>
  );
}
