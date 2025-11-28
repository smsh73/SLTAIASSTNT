import { useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export function usePromptSuggestion() {
  const cacheRef = useRef<Map<string, string[]>>(new Map());
  const { token } = useAuthStore();

  const getSuggestions = useCallback(
    async (words: string[]): Promise<string[]> => {
      if (words.length === 0) return [];

      const key = words.join(' ');
      if (cacheRef.current.has(key)) {
        return cacheRef.current.get(key) || [];
      }

      try {
        const response = await axios.post(
          '/api/ai/prompt-suggestions',
          { words },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const suggestions = response.data.suggestions || [];
        cacheRef.current.set(key, suggestions);
        return suggestions;
      } catch (error) {
        console.error('Failed to get prompt suggestions', error);
        return [];
      }
    },
    [token]
  );

  return { getSuggestions };
}

