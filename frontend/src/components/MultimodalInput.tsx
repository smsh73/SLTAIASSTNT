import { useState, useRef } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface MultimodalInputProps {
  onOutput: (output: any) => void;
}

export default function MultimodalInput({ onOutput }: MultimodalInputProps) {
  const [type, setType] = useState<'text' | 'image' | 'audio' | 'video'>('text');
  const [text, setText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('prompt', prompt);

      if (type === 'text') {
        formData.append('text', text);
      } else if (fileInputRef.current?.files?.[0]) {
        formData.append('file', fileInputRef.current.files[0]);
      }

      const response = await axios.post(
        '/api/multimodal/process',
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      onOutput(response.data.output);
    } catch (error) {
      console.error('Failed to process multimodal input', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          입력 유형
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="text">텍스트</option>
          <option value="image">이미지</option>
          <option value="audio">음성</option>
          <option value="video">동영상</option>
        </select>
      </div>

      {type === 'text' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            텍스트
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            rows={4}
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            파일
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={
              type === 'image'
                ? 'image/*'
                : type === 'audio'
                ? 'audio/*'
                : 'video/*'
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          프롬프트 (선택)
        </label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="처리 방법을 설명하세요..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? '처리 중...' : '처리'}
      </button>
    </form>
  );
}

