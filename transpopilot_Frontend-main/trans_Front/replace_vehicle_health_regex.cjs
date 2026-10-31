const fs = require('fs');
const path = 'c:/Users/Window 10/Downloads/transpopitlot_web/trans_Front/src/components/VehicleHealthAI.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /{upcomingMaintenance\.length > 0 \? \([\s\S]*?upcomingMaintenance\.map\(\(m\) => \(/g,
  `{upcomingMaintenance.filter(m => m.vehicle_id === selectedVehicle.id).length > 0 ? (
                    upcomingMaintenance.filter(m => m.vehicle_id === selectedVehicle.id).map((m) => (`
);

fs.writeFileSync(path, code);
console.log("Replaced successfully with regex.");
