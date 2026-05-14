export function reverseAudioBuffer (buffer, audioContext) {
  const reversedBuffer = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const originalData = buffer.getChannelData(channel);
    const reversedData = reversedBuffer.getChannelData(channel);
    for (let i = 0; i < originalData.length; i++) {
      reversedData[i] = originalData[originalData.length - 1 - i];
    }
  }

  return reversedBuffer;
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function averageBand(freqData, startIndex, endIndex) {
  if (!freqData || freqData.length === 0) {
    return 0;
  }

  const lastIndex = Math.min(freqData.length - 1, endIndex);
  let total = 0;
  let weightSum = 0;

  for (let index = Math.max(0, startIndex); index <= lastIndex; index++) {
    const normalizedValue = clamp01((freqData[index] ?? 0) / 255);
    const weight = 1 + (index - startIndex) * 0.05;
    total += normalizedValue * weight;
    weightSum += weight;
  }

  return weightSum > 0 ? total / weightSum : 0;
}

/**
 * Normalizes FFT data into stable audio features for visual mapping.
 * @param {ArrayLike<number>} freqData
 * @param {number} [previousEnergy=0]
 * @returns {{ bass: number, mid: number, treble: number, energy: number, centroid: number, energyTrend: number }}
 */
export function normalizeAudioFeatures(freqData, previousEnergy = 0) {
  if (!freqData || freqData.length === 0) {
    return {
      bass: 0,
      mid: 0,
      treble: 0,
      energy: 0,
      centroid: 0,
      energyTrend: 0.5,
    };
  }

  const bass = averageBand(freqData, 1, 3);
  const mid = averageBand(freqData, 4, 8);
  const treble = averageBand(freqData, 9, 20);

  let sumSquares = 0;
  let weightedSum = 0;
  let amplitudeSum = 0;

  for (let index = 0; index < freqData.length; index++) {
    const normalizedValue = clamp01((freqData[index] ?? 0) / 255);
    sumSquares += normalizedValue * normalizedValue;
    weightedSum += normalizedValue * index;
    amplitudeSum += normalizedValue;
  }

  const energy = clamp01(Math.sqrt(sumSquares / freqData.length));
  const centroid = amplitudeSum > 0 ? clamp01(weightedSum / amplitudeSum / Math.max(1, freqData.length - 1)) : 0;
  const previousEnergyValue = Number.isFinite(previousEnergy) ? clamp01(previousEnergy) : 0;
  const energyTrend = clamp01(0.5 + (energy - previousEnergyValue) * 0.5);

  return {
    bass,
    mid,
    treble,
    energy,
    centroid,
    energyTrend,
  };
}