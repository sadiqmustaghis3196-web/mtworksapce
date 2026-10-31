import { AlertTriangle, CheckCircle, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function SetupWizard() {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const copyToClipboard = (text: string, type: 'url' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="bg-white rounded-full p-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">Configuration Required</h1>
              <p className="text-red-100 mt-1">TranspoPilot needs to be connected to your database</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-8 rounded-r-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">Your App Is Not Connected</h3>
                <p className="text-yellow-800">
                  The app was deployed without configuring the required Supabase database connection.
                  This is why you're seeing "load fail" errors when trying to access data.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Fix (5 minutes)</h2>
              <p className="text-gray-600 mb-6">
                Follow these steps to configure your database connection and get your app working:
              </p>
            </div>

            <div className="space-y-6">
              <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Your Supabase Credentials</h3>
                    <ol className="space-y-3 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>Go to <a href="https://app.supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">Supabase Dashboard</a></span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>Create a new project (or select an existing one)</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>Navigate to <strong>Settings → API</strong></span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>Copy your <strong>Project URL</strong> and <strong>anon/public key</strong></span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Add Environment Variables</h3>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-sm font-mono text-gray-700">VITE_SUPABASE_URL</code>
                        <button
                          onClick={() => copyToClipboard('VITE_SUPABASE_URL', 'url')}
                          className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm"
                        >
                          {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="https://your-project.supabase.co"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                        readOnly
                      />
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-sm font-mono text-gray-700">VITE_SUPABASE_ANON_KEY</code>
                        <button
                          onClick={() => copyToClipboard('VITE_SUPABASE_ANON_KEY', 'key')}
                          className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 text-sm"
                        >
                          {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          <span>{copiedKey ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="your-anon-key-here"
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
                        readOnly
                      />
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-900 font-medium mb-2">Where to add these:</p>
                      <ul className="space-y-2 text-sm text-blue-800">
                        <li><strong>Vercel:</strong> Settings → Environment Variables</li>
                        <li><strong>Netlify:</strong> Site settings → Environment variables</li>
                        <li><strong>Local dev:</strong> Create a <code className="bg-blue-100 px-1 rounded">.env</code> file in project root</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Redeploy Your App</h3>
                    <p className="text-gray-700 mb-3">After adding the environment variables:</p>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span><strong>Vercel/Netlify:</strong> Trigger a new deployment (or it will auto-deploy)</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span><strong>Local dev:</strong> Restart your dev server (<code className="bg-gray-100 px-1 rounded">npm run dev</code>)</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-6 hover:border-green-300 transition-colors bg-green-50">
                <div className="flex items-start space-x-4">
                  <div className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Verify Setup</h3>
                    <p className="text-gray-700">
                      After redeploying, visit <strong>/diagnostics</strong> to verify all environment
                      variables are configured correctly. All checks should show green.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Need More Help?</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <a
                  href="https://github.com/yourusername/transpopilot-ai/blob/main/README.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700 font-medium">View Full Setup Guide</span>
                </a>
                <a
                  href="https://supabase.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700 font-medium">Supabase Documentation</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
