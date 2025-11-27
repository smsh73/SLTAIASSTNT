import { useEffect, useRef } from 'react';
import { usePromptSuggestion } from '../hooks/usePromptSuggestion';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  onSuggestionsChange: (suggestions: string[]) => void;
  loading: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  onSuggestionsChange,
  loading,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { getSuggestions } = usePromptSuggestion();

  useEffect(() => {
    if (value) {
      const wordArray = value.split(/\s+/).filter((w) => w.length > 0);
      
      // 단어 단위로 프롬프트 추천 요청
      if (wordArray.length > 0) {
        getSuggestions(wordArray).then((suggestions) => {
          onSuggestionsChange(suggestions);
        });
      }
    } else {
      onSuggestionsChange([]);
    }
  }, [value, getSuggestions, onSuggestionsChange]);

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
          style={{
            minHeight: '52px',
            maxHeight: '200px',
          }}
        />
        <button
          onClick={() => {
            if (value.trim() && !loading) {
              onSend(value);
            }
          }}
          disabled={!value.trim() || loading}
          className="m-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '전송 중...' : '전송'}
        </button>
      </div>
    </div>
  );
}

