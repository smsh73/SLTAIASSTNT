import { useState } from 'react';
import ConversationList from './ConversationList';

export default function Sidebar() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`transition-all duration-300 ${
        isHovered ? 'w-80' : 'w-0'
      } overflow-hidden bg-gray-50 border-r border-gray-200`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">
            대화 목록
          </h2>
          <ConversationList />
        </div>
      )}
    </div>
  );
}

