import { TableData } from '../types/table';

interface TableRendererProps {
  data: TableData;
  className?: string;
}

export default function TableRenderer({ data, className = '' }: TableRendererProps) {
  return (
    <div className={`table-container ${className}`}>
      {data.title && (
        <h3 className="text-lg font-semibold mb-4 text-gray-800">{data.title}</h3>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm">
          <thead className="bg-primary-50">
            <tr>
              {data.headers.map((header: string, index: number) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b border-gray-200"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.rows.map((row: string[], rowIndex: number) => (
              <tr
                key={rowIndex}
                className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                {row.map((cell: string, cellIndex: number) => (
                  <td
                    key={cellIndex}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

