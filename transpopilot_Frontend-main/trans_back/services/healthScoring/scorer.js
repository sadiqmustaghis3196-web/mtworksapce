import { HEALTH_SCORE_CONFIG } from './config.js';

export function calculateVehicleHealth(normalizedData) {
  const {
    batteryVoltage,
    coolantTemp,
    isPmOverdue,
    hasCriticalFault,
    hasWarningFault,
    componentFaults
  } = normalizedData;

  // 1. Calculate individual sub-scores
  const battery_score = calculateBatteryScore(batteryVoltage);
  const cooling_score = calculateCoolingScore(coolantTemp);
  const pm_score = calculatePmScore(isPmOverdue);
  const engine_score = calculateComponentScore(componentFaults.engine, HEALTH_SCORE_CONFIG.DEDUCTIONS.ENGINE_FAULT);
  const dpf_score = calculateComponentScore(componentFaults.dpf, HEALTH_SCORE_CONFIG.DEDUCTIONS.DPF_FAULT);
  const transmission_score = calculateComponentScore(componentFaults.transmission, HEALTH_SCORE_CONFIG.DEDUCTIONS.TRANSMISSION_FAULT);

  // 2. All-Categories-Missing Guard
  const validScores = [
    { score: engine_score, weight: HEALTH_SCORE_CONFIG.WEIGHTS.ENGINE },
    { score: cooling_score, weight: HEALTH_SCORE_CONFIG.WEIGHTS.COOLING },
    { score: pm_score, weight: HEALTH_SCORE_CONFIG.WEIGHTS.PM },
    { score: dpf_score, weight: HEALTH_SCORE_CONFIG.WEIGHTS.DPF },
    { score: transmission_score, weight: HEALTH_SCORE_CONFIG.WEIGHTS.TRANSMISSION },
    { score: battery_score, weight: HEALTH_SCORE_CONFIG.WEIGHTS.BATTERY }
  ].filter(s => s.score !== null);

  if (validScores.length === 0) {
    return {
      isInsufficientData: true,
      overall_score: null,
      engine_score: null,
      cooling_score: null,
      pm_score: null,
      dpf_score: null,
      transmission_score: null,
      battery_score: null,
      has_critical_fault: false,
      has_warning_fault: false
    };
  }

  // 3. Compute weighted average of available scores
  const totalAvailableWeight = validScores.reduce((sum, item) => sum + item.weight, 0);
  let baseOverallScore = validScores.reduce((sum, item) => {
    // Redistribute weight proportionally to make it out of 100
    const normalizedWeight = item.weight / totalAvailableWeight;
    return sum + (item.score * normalizedWeight);
  }, 0);

  // 4. Apply Veto Logic
  let isBatteryCritical = batteryVoltage !== null && batteryVoltage < HEALTH_SCORE_CONFIG.THRESHOLDS.BATTERY_CRITICAL;
  let isBatteryWarning = batteryVoltage !== null && batteryVoltage < HEALTH_SCORE_CONFIG.THRESHOLDS.BATTERY_WARNING;
  
  let finalCritical = hasCriticalFault || isBatteryCritical;
  let finalWarning = hasWarningFault || isBatteryWarning;

  let overall_score = Math.round(baseOverallScore);

  if (finalCritical) {
    overall_score = Math.min(overall_score, HEALTH_SCORE_CONFIG.THRESHOLDS.MAX_SCORE_CRITICAL);
  } else if (finalWarning) {
    overall_score = Math.min(overall_score, HEALTH_SCORE_CONFIG.THRESHOLDS.MAX_SCORE_WARNING);
  }

  return {
    isInsufficientData: false,
    overall_score,
    engine_score,
    cooling_score,
    pm_score,
    dpf_score,
    transmission_score,
    battery_score,
    has_critical_fault: finalCritical,
    has_warning_fault: finalWarning
  };
}

function calculateBatteryScore(voltage) {
  if (voltage === null) return null;
  const { BATTERY_CRITICAL, BATTERY_NORMAL } = HEALTH_SCORE_CONFIG.THRESHOLDS;
  if (voltage < BATTERY_CRITICAL) return 0;
  if (voltage >= BATTERY_NORMAL) return 100;
  // Linear scale between critical (0) and normal (100)
  const range = BATTERY_NORMAL - BATTERY_CRITICAL;
  const current = voltage - BATTERY_CRITICAL;
  return Math.max(0, Math.min(100, Math.round((current / range) * 100)));
}

function calculateCoolingScore(temp) {
  if (temp === null) return null;
  const { COOLANT_CRITICAL, COOLANT_NORMAL } = HEALTH_SCORE_CONFIG.THRESHOLDS;
  if (temp > COOLANT_CRITICAL) return 0;
  if (temp <= COOLANT_NORMAL) return 100;
  // Linear scale down from normal (100) to critical (0)
  const range = COOLANT_CRITICAL - COOLANT_NORMAL;
  const current = temp - COOLANT_NORMAL;
  return Math.max(0, Math.min(100, Math.round(100 - ((current / range) * 100))));
}

function calculatePmScore(isOverdue) {
  if (isOverdue === null) return null;
  // Binary for now: if overdue, it drops to 0 (urgent). If not, 100.
  return isOverdue ? 0 : 100;
}

function calculateComponentScore(faultsCount, deductionPerFault) {
  if (faultsCount === null || faultsCount === undefined) return null;
  if (faultsCount === 0) return 100;
  return Math.max(0, 100 - (faultsCount * deductionPerFault));
}
