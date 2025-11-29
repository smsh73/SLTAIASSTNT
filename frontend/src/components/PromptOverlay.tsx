import { useEffect, useState } from 'react';

interface PromptOverlayProps {
  show: boolean;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  loading?: boolean;
}

export default function PromptOverlay({
  show,
  suggestions,
  onSelect,
  loading = false,
}: PromptOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (show && (suggestions.length > 0 || loading)) {
      setVisible(true);
      setAnimating(true);
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [show, suggestions, loading]);

  if (!visible) {
    return null;
  }

  return (
    <div 
      className={`absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-72 overflow-y-auto z-50 transition-all duration-200 ${
        animating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <div className="p-2">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-primary-600">Luxia AI</span>
            <span className="text-xs text-gray-400">프롬프트 제안</span>
          </div>
          {loading && (
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}
        </div>
        
        {loading && suggestions.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-gray-400">
            프롬프트 생성 중...
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSelect(suggestion)}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-primary-50 text-sm text-gray-700 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 group"
              aria-label={`프롬프트 제안: ${suggestion}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(suggestion);
                }
              }}
            >
              <div className="flex items-start space-x-2">
                <span className="text-primary-500 mt-0.5 group-hover:scale-110 transition-transform" aria-hidden="true">
                  ✨
                </span>
                <span className="flex-1 leading-relaxed group-hover:text-primary-700 transition-colors">
                  {suggestion}
                </span>
              </div>
            </button>
          ))
        )}
        
        <div className="px-2 pt-2 mt-1 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 text-center">
            Tab 또는 클릭으로 선택
          </p>
        </div>
      </div>
    </div>
  );
}
