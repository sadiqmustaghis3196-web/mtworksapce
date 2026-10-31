import { HEALTH_SCORE_CONFIG } from './config.js';

export function mapGeotabDiagnostics(diagnosticRow, maintenanceRecords = []) {
  let hasCriticalFault = false;
  let hasWarningFault = false;
  let engineFaults = 0;
  let dpfFaults = 0;
  let transmissionFaults = 0;

  if (diagnosticRow.dtc_codes && Array.isArray(diagnosticRow.dtc_codes)) {
    diagnosticRow.dtc_codes.forEach(fault => {
      // Severity parsing
      if (fault.redStopLamp) hasCriticalFault = true;
      if (fault.amberWarningLamp || fault.protectWarningLamp) hasWarningFault = true;
      
      // Component parsing
      const sourceAddr = fault.sourceAddress;
      const controllerId = fault.controller ? fault.controller.id : null;
      
      // Basic heuristic for Geotab source addresses/controllers
      if (sourceAddr === 0 || controllerId === 'ControllerObdWwhPowertrainId') {
        engineFaults++;
      }
      if (sourceAddr === 3 || String(controllerId).toLowerCase().includes('transmission')) {
        transmissionFaults++;
      }
      // Assuming DPF is usually tied to engine emissions, but without specific SPN, we might count specific controller strings
      // We can fallback to searching the recommendation string if provided by Geotab
      if (fault.recommendation && fault.recommendation.toLowerCase().includes('exhaust')) {
        dpfFaults++;
      }
    });
  }

  return {
    batteryVoltage: diagnosticRow.battery_voltage ?? null,
    coolantTemp: diagnosticRow.coolant_temp ?? null,
    isPmOverdue: determinePmOverdue(maintenanceRecords),
    hasCriticalFault,
    hasWarningFault,
    componentFaults: {
      engine: engineFaults,
      dpf: dpfFaults,
      transmission: transmissionFaults
    }
  };
}

export function mapSamsaraDiagnostics(diagnosticRow, maintenanceRecords = []) {
  let hasCriticalFault = false;
  let hasWarningFault = false;
  let engineFaults = 0;
  let dpfFaults = 0;
  let transmissionFaults = 0;

  if (diagnosticRow.dtc_codes && Array.isArray(diagnosticRow.dtc_codes)) {
    diagnosticRow.dtc_codes.forEach(fault => {
      // In Samsara J1939 fault codes, milStatus indicates warning/critical
      // 1 = Warning, 2 = Flashing/Critical (usually)
      if (fault.milStatus === 2 || fault.redStopLampStatus === 1) {
        hasCriticalFault = true;
      } else if (fault.milStatus === 1 || fault.amberWarningLampStatus === 1) {
        hasWarningFault = true;
      } else {
        // If unknown, default to warning
        hasWarningFault = true;
      }

      // Basic heuristic for Samsara SPNs
      if (fault.spn === 110 || fault.spn === 190) engineFaults++; // Coolant / Engine Speed
      if (fault.spn === 191 || fault.spn === 523) transmissionFaults++;
      if (fault.spn === 3251 || fault.spn === 3936) dpfFaults++;
    });
  }

  return {
    batteryVoltage: diagnosticRow.battery_voltage ?? null,
    coolantTemp: diagnosticRow.coolant_temp ?? null,
    isPmOverdue: determinePmOverdue(maintenanceRecords),
    hasCriticalFault,
    hasWarningFault,
    componentFaults: {
      engine: engineFaults,
      dpf: dpfFaults,
      transmission: transmissionFaults
    }
  };
}

function determinePmOverdue(records) {
  if (!records || records.length === 0) return null;
  // Simplistic rule: If the most recent PM record is > 90 days old, it's overdue.
  // In a real app, this would use the fleet's specific PM interval policy.
  const pmRecords = records.filter(r => r.service_type === 'Preventive Maintenance');
  if (pmRecords.length === 0) return null;

  const sorted = pmRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestDate = new Date(sorted[0].date);
  const daysSince = (new Date() - latestDate) / (1000 * 60 * 60 * 24);
  
  return daysSince > HEALTH_SCORE_CONFIG.THRESHOLDS.PM_INTERVAL_DAYS;
}
