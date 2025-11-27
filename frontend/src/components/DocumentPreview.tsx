import { useState, useEffect } from 'react';

interface DocumentPreviewProps {
  documentId?: number;
}

export default function DocumentPreview({ documentId }: DocumentPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content] = useState<string>('');

  useEffect(() => {
    if (documentId) {
      // 문서 내용 로드
      setIsOpen(true);
    }
  }, [documentId]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-40">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">문서 미리보기</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {content ? (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <div className="text-gray-500 text-center py-8">
            문서를 선택하거나 생성 중입니다...
          </div>
        )}
      </div>
    </div>
  );
}

