import type { WindowType } from '../types/waveform'

function applyWindow(samples: Float64Array, type: WindowType): Float64Array {
  const N = samples.length
  const out = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    let w = 1
    switch (type) {
      case 'hann':
        w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)))
        break
      case 'hamming':
        w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1))
        break
      case 'blackman':
        w =
          0.42 -
          0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) +
          0.08 * Math.cos((4 * Math.PI * i) / (N - 1))
        break
      case 'flattop':
        w =
          1 -
          1.93 * Math.cos((2 * Math.PI * i) / (N - 1)) +
          1.29 * Math.cos((4 * Math.PI * i) / (N - 1)) -
          0.388 * Math.cos((6 * Math.PI * i) / (N - 1)) +
          0.032 * Math.cos((8 * Math.PI * i) / (N - 1))
        break
    }
    out[i] = samples[i] * w
  }
  return out
}

/** In-place radix-2 Cooley-Tukey FFT */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const N = re.length
  // Bit-reversal
  let j = 0
  for (let i = 1; i < N; i++) {
    let bit = N >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  // Butterfly
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k], uIm = im[i + k]
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe
        re[i + k] = uRe + vRe
        im[i + k] = uIm + vIm
        re[i + k + len / 2] = uRe - vRe
        im[i + k + len / 2] = uIm - vIm
        const nRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nRe
      }
    }
  }
}

export function computeFFT(
  samples: Float64Array,
  sampleRate: number,
  windowType: WindowType = 'hann',
): { magnitude: Float64Array; frequency: Float64Array } {
  const N = samples.length
  const windowed = applyWindow(samples, windowType)
  const re = new Float64Array(windowed)
  const im = new Float64Array(N)

  fftInPlace(re, im)

  const halfN = N / 2
  const magnitude = new Float64Array(halfN)
  const frequency = new Float64Array(halfN)

  for (let i = 0; i < halfN; i++) {
    const mag = Math.sqrt(re[i] ** 2 + im[i] ** 2) / N
    // Scale single-sided spectrum (×2 for all bins except DC)
    const scaled = i === 0 ? mag : mag * 2
    magnitude[i] = 20 * Math.log10(scaled + 1e-12)
    frequency[i] = (i * sampleRate) / N
  }

  return { magnitude, frequency }
}
