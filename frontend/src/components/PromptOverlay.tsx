import { useEffect, useState } from 'react';

interface PromptOverlayProps {
  show: boolean;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export default function PromptOverlay({
  show,
  suggestions,
  onSelect,
}: PromptOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && suggestions.length > 0) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [show, suggestions]);

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-64 overflow-y-auto z-50">
      <div className="p-2">
        <div className="text-xs text-gray-500 px-2 py-1 mb-1 font-medium">
          프롬프트 제안
        </div>
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="w-full text-left px-3 py-2 rounded hover:bg-primary-50 text-sm text-gray-700 transition-colors"
          >
            <div className="flex items-start space-x-2">
              <span className="text-primary-500 mt-1">💡</span>
              <span className="flex-1">{suggestion}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

