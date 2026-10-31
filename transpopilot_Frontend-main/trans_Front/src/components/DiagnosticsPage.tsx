import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export default function DiagnosticsPage() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const checks = [
    {
      name: 'Supabase URL',
      status: !!supabaseUrl,
      value: supabaseUrl || 'Not configured',
      required: true,
    },
    {
      name: 'Supabase Anon Key',
      status: !!supabaseAnonKey,
      value: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Not configured',
      required: true,
    },
    {
      name: 'Overall Configuration',
      status: isSupabaseConfigured,
      value: isSupabaseConfigured ? 'All required variables configured' : 'Missing required variables',
      required: true,
    },
  ];

  const allPassed = checks.every(check => check.status);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Diagnostics</h1>
        <p className="text-gray-600">Check the configuration status of your TranspoPilot installation</p>
      </div>

      <div className={`p-4 rounded-lg mb-6 ${allPassed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center">
          {allPassed ? (
            <>
              <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold text-green-900">System Ready</h2>
                <p className="text-green-700">All required environment variables are configured correctly.</p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-6 w-6 text-red-600 mr-3" />
              <div>
                <h2 className="text-lg font-semibold text-red-900">Configuration Required</h2>
                <p className="text-red-700">Some required environment variables are missing or incorrect.</p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Configuration Checks</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {checks.map((check, index) => (
            <div key={index} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <h3 className="text-lg font-medium text-gray-900 mr-2">{check.name}</h3>
                    {check.required && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Required</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded mt-2">
                    {check.value}
                  </p>
                </div>
                <div className="ml-4">
                  {check.status ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!allPassed && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Setup Instructions</h3>
              <div className="text-yellow-800 space-y-3">
                <p>To configure your TranspoPilot installation:</p>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Create a <code className="bg-yellow-100 px-2 py-1 rounded">.env</code> file in your project root</li>
                  <li>Add the following environment variables:</li>
                </ol>
                <pre className="bg-gray-900 text-green-400 p-4 rounded mt-3 overflow-x-auto text-sm">
{`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}
                </pre>
                <p className="mt-3">
                  Get your Supabase credentials from your{' '}
                  <a
                    href="https://app.supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-900 underline font-semibold hover:text-yellow-700"
                  >
                    Supabase Dashboard
                  </a>
                </p>
                <p className="font-semibold mt-4">
                  After adding the variables, restart your development server.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Recheck Configuration
        </button>
      </div>
    </div>
  );
}
