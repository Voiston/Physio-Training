export function calculateEMA(dataArray, period, decayToZero = false) {
  const k = 2 / (period + 1);
  const emaArray = [];
  let currentEMA = null;

  for (let i = 0; i < dataArray.length; i++) {
    const rawVal = dataArray[i];
    
    if (currentEMA === null) {
      if (rawVal !== null && rawVal !== undefined) {
        currentEMA = rawVal;
      } else if (decayToZero) {
        currentEMA = 0;
      }
    } else {
      let actualVal;
      if (rawVal !== null && rawVal !== undefined) {
        actualVal = rawVal;
      } else if (decayToZero) {
        actualVal = 0;
      } else {
        actualVal = currentEMA;
      }
      currentEMA = (actualVal * k) + (currentEMA * (1 - k));
    }
    
    emaArray.push(currentEMA !== null ? currentEMA : 0);
  }
  return emaArray;
}

