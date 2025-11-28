import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

interface ApiKey {
  id: number;
  provider: string;
  isActive: boolean;
  weight: number;
  createdAt: string;
}

export default function ApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'openai',
    apiKey: '',
    weight: 1.0,
    isActive: true,
  });
  const { token } = useAuthStore();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await axios.get(
        '/api/admin/api-keys',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setApiKeys(response.data.apiKeys);
    } catch (error) {
      console.error('Failed to fetch API keys', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/admin/api-keys',
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShowForm(false);
      setFormData({
        provider: 'openai',
        apiKey: '',
        weight: 1.0,
        isActive: true,
      });
      fetchApiKeys();
    } catch (error) {
      console.error('Failed to create API key', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await axios.delete(
        `/api/admin/api-keys/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchApiKeys();
    } catch (error) {
      console.error('Failed to delete API key', error);
    }
  };

  if (loading) {
    return <div className="p-6">로딩 중...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">API 키 관리</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          {showForm ? '취소' : '추가'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">프로바이더</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
                <option value="perplexity">Perplexity</option>
                <option value="luxia">Luxia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">가중치</label>
              <input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">API 키</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
          >
            저장
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                프로바이더
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                가중치
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                생성일
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {apiKeys.map((key) => (
              <tr key={key.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {key.provider}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{key.weight}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      key.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {key.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(key.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

