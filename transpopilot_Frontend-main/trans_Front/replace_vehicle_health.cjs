const fs = require('fs');
const path = 'c:/Users/Window 10/Downloads/transpopitlot_web/trans_Front/src/components/VehicleHealthAI.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `{upcomingMaintenance.length > 0 ? (
                    upcomingMaintenance.map((m) => (`;

const replaceStr = `{upcomingMaintenance.filter(m => m.vehicle_id === selectedVehicle.id).length > 0 ? (
                    upcomingMaintenance.filter(m => m.vehicle_id === selectedVehicle.id).map((m) => (`;

if (code.includes(targetStr)) {
  fs.writeFileSync(path, code.replace(targetStr, replaceStr));
  console.log("Success replacing VehicleHealthAI.tsx");
} else {
  console.log("Target string not found.");
}
