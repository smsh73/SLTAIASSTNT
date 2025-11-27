import { useState, useCallback } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export function usePromptSuggestion() {
  const [cache, setCache] = useState<Map<string, string[]>>(new Map());
  const { token } = useAuthStore();

  const getSuggestions = useCallback(
    async (words: string[]): Promise<string[]> => {
      if (words.length === 0) return [];

      const key = words.join(' ');
      if (cache.has(key)) {
        return cache.get(key) || [];
      }

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ai/prompt-suggestions`,
          { words },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const suggestions = response.data.suggestions || [];
        setCache((prev) => new Map(prev).set(key, suggestions));
        return suggestions;
      } catch (error) {
        console.error('Failed to get prompt suggestions', error);
        return [];
      }
    },
    [token, cache]
  );

  return { getSuggestions };
}

