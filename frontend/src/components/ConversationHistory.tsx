import { Message } from '../types/message';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ConversationHistoryProps {
  messages: Message[];
}

const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    // @ts-expect-error - React 18 type compatibility issue with react-markdown
    <Markdown remarkPlugins={[remarkGfm]}>
      {content}
    </Markdown>
  );
};

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
            {message.role === 'user' ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-800 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700">
                <MarkdownRenderer content={message.content} />
              </div>
            )}
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

