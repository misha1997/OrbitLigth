// B_lambda: spectral radiance per unit wavelength, normalised to its peak.
// Wavelengths are in micrometres and temperatures are in kelvins.
const WIEN_MICRON_K = 2897.771955;
const SECOND_RADIATION_MICRON_K = 14387.76877;

export function wienPeakMicrons(temperature) {
  return WIEN_MICRON_K / temperature;
}

export function normalizedPlanck(wavelength, temperature) {
  const peak = wienPeakMicrons(temperature);
  const exponent = SECOND_RADIATION_MICRON_K / (wavelength * temperature);
  if (exponent > 700) return 0;
  return Math.min(1, (peak / wavelength) ** 5
    * Math.expm1(SECOND_RADIATION_MICRON_K / (peak * temperature))
    / Math.expm1(exponent));
}

export const SPITZER_IMAGING_CHANNELS = [3.6, 4.5, 5.8, 8, 24, 70, 160];
export const spitzerChannelAvailable = (wavelength, mode) =>
  SPITZER_IMAGING_CHANNELS.includes(wavelength) && (mode === "cold" || wavelength === 3.6 || wavelength === 4.5);
