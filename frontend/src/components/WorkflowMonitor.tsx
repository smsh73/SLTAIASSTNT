import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface Workflow {
  id: number;
  name: string;
  status: string;
  currentStep: number;
  plan: {
    steps: Array<{
      id: string;
      name: string;
      description: string;
    }>;
  };
  results?: Record<string, any>;
}

interface WorkflowMonitorProps {
  workflowId: number;
}

export default function WorkflowMonitor({ workflowId }: WorkflowMonitorProps) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();

  useEffect(() => {
    if (workflowId) {
      fetchWorkflow();
      const interval = setInterval(fetchWorkflow, 2000);
      return () => clearInterval(interval);
    }
  }, [workflowId]);

  const fetchWorkflow = async () => {
    try {
      const response = await axios.get(
        `/api/workflows/${workflowId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setWorkflow(response.data.workflow);
    } catch (error) {
      console.error('Failed to fetch workflow', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !workflow) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'running':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{workflow.name}</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
            workflow.status
          )}`}
        >
          {workflow.status === 'completed'
            ? '완료'
            : workflow.status === 'running'
            ? '실행 중'
            : workflow.status === 'failed'
            ? '실패'
            : '대기'}
        </span>
      </div>

      <div className="space-y-2">
        {workflow.plan.steps.map((step, index) => {
          const isCompleted = index < workflow.currentStep;
          const isCurrent = index === workflow.currentStep - 1;
          const hasResult = workflow.results && workflow.results[step.id];

          return (
            <div
              key={step.id}
              className={`p-3 rounded border ${
                isCompleted
                  ? 'bg-green-50 border-green-200'
                  : isCurrent
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{step.name}</div>
                  <div className="text-sm text-gray-600">{step.description}</div>
                  {hasResult && (
                    <div className="mt-2 text-xs text-gray-500">
                      결과: {typeof workflow.results![step.id] === 'string'
                        ? workflow.results![step.id].substring(0, 100)
                        : '완료'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

