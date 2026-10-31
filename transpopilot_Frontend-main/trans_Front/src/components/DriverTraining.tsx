import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../lib/apiConfig';
import { PlayCircle, CheckCircle, AlertCircle, Award } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import SignaturePad from './SignaturePad';

const DriverTraining: React.FC = () => {
  const { profile } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeModule, setActiveModule] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [signatureData, setSignatureData] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number, passed: boolean } | null>(null);

  useEffect(() => {
    if (profile?.organization_id) {
      loadModules();
    }
  }, [profile]);

  const loadModules = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/training-modules`, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setModules(result.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load training modules');
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = (mod: any) => {
    setActiveModule(mod);
    setAnswers({});
    setSignatureData('');
    setScoreResult(null);
  };

  const calculateScore = () => {
    if (!activeModule?.quiz_data?.questions) return 100; // No quiz means automatic pass
    let correct = 0;
    const questions = activeModule.quiz_data.questions;
    questions.forEach((q: any, idx: number) => {
      if (answers[idx] === q.correct_index) correct++;
    });
    return Math.round((correct / questions.length) * 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureData) {
      setError("Please sign to acknowledge completion.");
      return;
    }
    const score = calculateScore();
    const passingScore = activeModule.quiz_data?.passing_score || 80;
    const passed = score >= passingScore;

    try {
      setSubmitting(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_BASE_URL}/api/driver/training-modules/${activeModule.id}/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ score, signature: signatureData })
      });
      
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      setScoreResult({ score, passed });
      loadModules(); // Refresh status
    } catch (err: any) {
      setError(err.message || "Failed to submit training");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && modules.length === 0) return <LoadingSpinner />;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
          <Award className="h-6 w-6 mr-2 text-blue-600" />
          Safety Training Center
        </h1>
        <p className="text-gray-600">Complete your assigned safety modules below.</p>
      </div>

      {error && <ErrorMessage message={error} />}

      {!activeModule ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map(mod => {
            const isCompleted = !!mod.completion;
            const isPassed = mod.completion?.status === 'passed';
            return (
              <div key={mod.id} className={`p-5 rounded-xl border \${isCompleted ? (isPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200') : 'bg-white hover:border-blue-300 transition-colors cursor-pointer'}`} onClick={() => !isPassed && handleModuleClick(mod)}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-900">{mod.title}</h3>
                  {isCompleted ? (
                    isPassed ? <CheckCircle className="text-green-600 h-6 w-6" /> : <AlertCircle className="text-red-600 h-6 w-6" />
                  ) : (
                    <PlayCircle className="text-blue-500 h-6 w-6" />
                  )}
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-4">{mod.description}</p>
                {isCompleted && (
                  <p className="text-sm font-medium">
                    Score: {mod.completion.score}% - {isPassed ? <span className="text-green-600">Passed</span> : <span className="text-red-600">Failed (Retake Required)</span>}
                  </p>
                )}
              </div>
            );
          })}
          {modules.length === 0 && <p className="text-gray-500">No training modules assigned.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <button onClick={() => setActiveModule(null)} className="text-sm text-blue-600 hover:underline mb-6">&larr; Back to Modules</button>
          
          <h2 className="text-2xl font-bold mb-4">{activeModule.title}</h2>
          
          {scoreResult ? (
            <div className={`p-6 rounded-lg text-center \${scoreResult.passed ? 'bg-green-100' : 'bg-red-100'}`}>
              <h3 className="text-xl font-bold mb-2">{scoreResult.passed ? 'Congratulations!' : 'Training Failed'}</h3>
              <p>You scored {scoreResult.score}%. {scoreResult.passed ? 'You have successfully passed this module.' : 'Please review the material and try again.'}</p>
              <button onClick={() => setActiveModule(null)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Return to Dashboard</button>
            </div>
          ) : (
            <>
              {activeModule.video_url && (
                <div className="aspect-video bg-black rounded-lg mb-8 flex items-center justify-center">
                  <p className="text-white">Video Player Placeholder (URL: {activeModule.video_url})</p>
                </div>
              )}
              {activeModule.description && (
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-xl mb-8">
                  <h3 className="font-bold text-blue-900 mb-2">Instructions / Notes</h3>
                  <p className="text-blue-800 whitespace-pre-wrap">{activeModule.description}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-8">
                {activeModule.quiz_data?.questions?.length > 0 && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold border-b pb-2">Knowledge Check</h3>
                    {activeModule.quiz_data.questions.map((q: any, qIdx: number) => (
                      <div key={qIdx} className="p-4 bg-gray-50 rounded-lg border">
                        <p className="font-medium text-gray-900 mb-3">{qIdx + 1}. {q.question}</p>
                        <div className="space-y-2">
                          {q.options.map((opt: string, oIdx: number) => (
                            <label key={oIdx} className="flex items-center space-x-3 p-2 bg-white border rounded cursor-pointer hover:bg-gray-50">
                              <input type="radio" required name={`q-\${qIdx}`} value={oIdx} checked={answers[qIdx] === oIdx} onChange={() => setAnswers(prev => ({ ...prev, [qIdx]: oIdx }))} className="h-4 w-4 text-blue-600" />
                              <span className="text-gray-700">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="pt-6 border-t">
                  <h3 className="text-xl font-bold mb-4">Acknowledgment</h3>
                  <SignaturePad onSign={setSignatureData} label="By signing, I acknowledge that I have watched the video and understand the policies." />
                </div>
                
                <div className="flex justify-end pt-4">
                  <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? 'Submitting...' : 'Complete Training'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverTraining;
