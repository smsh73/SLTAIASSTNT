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

const getProviderBadgeColor = (provider: string): string => {
  const colors: Record<string, string> = {
    openai: 'bg-green-50 text-green-700',
    claude: 'bg-orange-50 text-orange-700',
    gemini: 'bg-blue-50 text-blue-700',
    perplexity: 'bg-purple-50 text-purple-700',
    luxia: 'bg-red-50 text-red-700',
  };
  return colors[provider] || 'bg-gray-50 text-gray-700';
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

const isLuxiaProvider = (provider: string | undefined): boolean => {
  return provider?.toLowerCase() === 'luxia';
};

export default function ConversationHistory({
  messages,
}: ConversationHistoryProps) {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const uniqueKey = `msg-${message.id}-${index}`;
        if (message.role === 'system') {
          return (
            <div key={uniqueKey} className="flex justify-center">
              <div className="bg-gradient-to-r from-primary-100 to-primary-50 text-primary-800 px-6 py-2 rounded-full text-sm font-medium shadow-sm border border-primary-200">
                {message.content}
              </div>
            </div>
          );
        }

        const isAgent = message.role === 'assistant' && message.provider;
        const isLuxia = isLuxiaProvider(message.provider);
        
        return (
          <div
            key={uniqueKey}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-3xl rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white p-4'
                  : isAgent
                    ? isLuxia
                      ? 'bg-gradient-to-br from-white to-gray-50 shadow-lg border border-gray-200 p-5'
                      : 'bg-white shadow-sm border border-gray-200 p-4'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-200 p-4'
              }`}
            >
              {isAgent && (
                <div className={`flex items-center gap-2 mb-3 pb-2 ${isLuxia ? 'border-b-2 border-red-100' : 'border-b border-gray-100'}`}>
                  <span className={isLuxia ? 'text-xl' : 'text-lg'}>{getProviderIcon(message.provider || '')}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getProviderBadgeColor(message.provider || '')}`}>
                    {message.providerName || message.provider}
                  </span>
                  {message.phase && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {message.phase}
                    </span>
                  )}
                  {isLuxia && (
                    <span className="text-xs text-red-600 font-medium ml-auto">최종 종합</span>
                  )}
                </div>
              )}
              
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className={`prose max-w-none ${
                  isLuxia 
                    ? 'prose-lg prose-headings:text-gray-900 prose-headings:font-semibold prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2 prose-p:text-gray-700 prose-p:leading-relaxed prose-strong:text-gray-800 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700 prose-li:my-1 prose-hr:my-4 prose-hr:border-gray-200'
                    : 'prose-sm prose-headings:text-gray-800 prose-p:text-gray-700 prose-strong:text-gray-800 prose-ul:text-gray-700 prose-ol:text-gray-700 prose-li:text-gray-700'
                }`}>
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
                className={`text-xs mt-3 ${
                  message.role === 'user'
                    ? 'text-primary-100'
                    : 'text-gray-400'
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
