import { AlertTriangle, ExternalLink } from 'lucide-react';

interface ConfigurationWarningProps {
  message: string;
  details?: string[];
  showDocLink?: boolean;
}

export default function ConfigurationWarning({
  message,
  details = [],
  showDocLink = true
}: ConfigurationWarningProps) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Configuration Required
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>{message}</p>
            {details.length > 0 && (
              <ul className="list-disc list-inside mt-2 space-y-1">
                {details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            )}
            {showDocLink && (
              <div className="mt-4">
                <a
                  href="/diagnostics"
                  className="inline-flex items-center text-sm font-medium text-yellow-800 hover:text-yellow-900 underline"
                >
                  View diagnostics page
                  <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
