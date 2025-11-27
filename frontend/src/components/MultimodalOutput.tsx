import { MultimodalOutput as MultimodalOutputType } from '../types/multimodal';

interface MultimodalOutputProps {
  output: MultimodalOutputType;
}

export default function MultimodalOutput({ output }: MultimodalOutputProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="mb-2">
        <span className="text-xs font-medium text-gray-500">
          {output.type === 'text'
            ? '텍스트'
            : output.type === 'image'
            ? '이미지'
            : output.type === 'audio'
            ? '음성'
            : '동영상'}
        </span>
      </div>

      {output.type === 'text' && (
        <div className="prose prose-sm max-w-none">
          {output.content}
        </div>
      )}

      {output.type === 'image' && output.metadata?.imageUrl && (
        <img
          src={output.metadata.imageUrl}
          alt="Processed image"
          className="max-w-full rounded-lg"
        />
      )}

      {output.type === 'audio' && output.metadata?.audioUrl && (
        <audio controls className="w-full">
          <source src={output.metadata.audioUrl} type={output.metadata.mimeType} />
        </audio>
      )}

      {output.type === 'video' && output.metadata?.videoUrl && (
        <video controls className="w-full rounded-lg">
          <source src={output.metadata.videoUrl} type={output.metadata.mimeType} />
        </video>
      )}

      {output.metadata && (
        <div className="mt-4 text-xs text-gray-500">
          <pre>{JSON.stringify(output.metadata, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

