import { Message } from '../types/message';

interface ConversationHistoryProps {
  messages: Message[];
}

export default function ConversationHistory({
  messages,
}: ConversationHistoryProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-3xl rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-800 shadow-sm border border-gray-200'
            }`}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>
            <div
              className={`text-xs mt-2 ${
                message.role === 'user'
                  ? 'text-primary-100'
                  : 'text-gray-500'
              }`}
            >
              {new Date(message.createdAt).toLocaleTimeString('ko-KR')}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

