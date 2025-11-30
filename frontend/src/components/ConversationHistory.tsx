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

const getProviderColor = (provider: string): string => {
  const colors: Record<string, string> = {
    openai: 'bg-green-100 text-green-800 border-green-200',
    claude: 'bg-orange-100 text-orange-800 border-orange-200',
    gemini: 'bg-blue-100 text-blue-800 border-blue-200',
    perplexity: 'bg-purple-100 text-purple-800 border-purple-200',
    luxia: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[provider] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getProviderIcon = (provider: string): string => {
  const icons: Record<string, string> = {
    openai: '🤖',
    claude: '🧠',
    gemini: '✨',
    perplexity: '🔍',
    luxia: '🌟',
  };
  return icons[provider] || '💬';
};

export default function ConversationHistory({
  messages,
}: ConversationHistoryProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        if (message.role === 'system') {
          return (
            <div key={message.id} className="flex justify-center">
              <div className="bg-gradient-to-r from-primary-100 to-primary-50 text-primary-800 px-6 py-2 rounded-full text-sm font-medium shadow-sm border border-primary-200">
                {message.content}
              </div>
            </div>
          );
        }

        const isAgent = message.role === 'assistant' && message.provider;
        
        return (
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
                  : isAgent
                    ? `bg-white shadow-md border-l-4 ${getProviderColor(message.provider || '').split(' ')[2]}`
                    : 'bg-white text-gray-800 shadow-sm border border-gray-200'
              }`}
            >
              {isAgent && (
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <span className="text-lg">{getProviderIcon(message.provider || '')}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getProviderColor(message.provider || '')}`}>
                    {message.providerName || message.provider}
                  </span>
                  {message.phase && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {message.phase}
                    </span>
                  )}
                </div>
              )}
              
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-800 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700">
                  {message.content ? (
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm">응답 생성 중...</span>
                    </div>
                  )}
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
        );
      })}
    </div>
  );
}
