import { useRef, useCallback } from 'react';
import axios, { CancelTokenSource } from 'axios';
import { useAuthStore } from '../store/authStore';

export function usePromptSuggestion() {
  const cacheRef = useRef<Map<string, string[]>>(new Map());
  const cancelTokenRef = useRef<CancelTokenSource | null>(null);
  const { token } = useAuthStore();

  const getSuggestions = useCallback(
    async (words: string[]): Promise<string[]> => {
      if (words.length === 0) return [];

      const inputText = words.join(' ').trim();
      
      if (inputText.length < 2) return [];

      if (cacheRef.current.has(inputText)) {
        return cacheRef.current.get(inputText) || [];
      }

      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel('New request initiated');
      }

      cancelTokenRef.current = axios.CancelToken.source();

      try {
        const response = await axios.post(
          '/api/ai/prompt-suggestions',
          { words },
          {
            headers: { Authorization: `Bearer ${token}` },
            cancelToken: cancelTokenRef.current.token,
            timeout: 10000,
          }
        );

        const suggestions = response.data.suggestions || [];
        
        if (suggestions.length > 0) {
          cacheRef.current.set(inputText, suggestions);
          
          if (cacheRef.current.size > 50) {
            const firstKey = cacheRef.current.keys().next().value;
            if (firstKey) cacheRef.current.delete(firstKey);
          }
        }
        
        return suggestions;
      } catch (error) {
        if (axios.isCancel(error)) {
          return [];
        }
        console.error('Failed to get prompt suggestions', error);
        return [];
      }
    },
    [token]
  );

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return { getSuggestions, clearCache };
}
