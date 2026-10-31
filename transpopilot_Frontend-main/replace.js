const fs = require('fs');
let content = fs.readFileSync('trans_Front/src/components/Dashboard.tsx', 'utf8');

const startMarker = '{operations && (';
const endMarker = '{/* --- Stats Cards (Bento Style) --- */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  
  const newMiddle = `{operations && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-[2rem] p-6 shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white">Fleet Operations — {operations.stage === 'live_operations' ? 'Live' : 'Pending'}</h2>
              <p className="text-slate-400 mt-1">
                 {operations.stage === 'live_operations' 
                    ? \`\${operations.liveOperations?.activeVehicles || 0} active routes in progress. \${operations.liveOperations?.activeDrivers || 0} active drivers.\` 
                    : \`\${operations.dispatchableRoutes?.length || 0} routes ready for dispatch.\`}
              </p>
            </div>
            <button 
               onClick={() => onNavigate && onNavigate('fleet-operations')}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
               View Fleet Operations <ArrowRight className="w-5 h-5" />
            </button>
        </div>
      )}

      `;
      
  fs.writeFileSync('trans_Front/src/components/Dashboard.tsx', before + newMiddle + after, 'utf8');
  console.log('Replaced successfully');
}
