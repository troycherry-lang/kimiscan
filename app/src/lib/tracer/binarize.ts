/**
 * Image preprocessing: grayscale, blur, threshold
 */

export interface BinarizeOptions {
  threshold: number; // 0-255, -1 = auto (Otsu)
  blur: number; // 0-10 px
  invert: boolean;
}

function imageDataToGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

function gaussianBlur1D(src: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  if (radius <= 0.5) return src;
  const sigma = radius / 3;
  const size = Math.ceil(radius) * 2 + 1;
  const kernel: number[] = [];
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - Math.floor(size / 2);
    const v = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum;

  const tmp = new Uint8ClampedArray(width * height);
  const dst = new Uint8ClampedArray(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = 0; k < size; k++) {
        const sx = Math.min(width - 1, Math.max(0, x + k - Math.floor(size / 2)));
        val += src[y * width + sx] * kernel[k];
      }
      tmp[y * width + x] = val;
    }
  }
  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let val = 0;
      for (let k = 0; k < size; k++) {
        const sy = Math.min(height - 1, Math.max(0, y + k - Math.floor(size / 2)));
        val += tmp[sy * width + x] * kernel[k];
      }
      dst[y * width + x] = val;
    }
  }
  return dst;
}

function otsuThreshold(histogram: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

export function binarize(
  imageData: ImageData,
  options: BinarizeOptions
): { binary: Uint8ClampedArray; thresholdUsed: number } {
  const { width, height, data } = imageData;
  let gray = imageDataToGrayscale(data);

  // Blur
  if (options.blur > 0.5) {
    gray = gaussianBlur1D(gray, width, height, options.blur);
  }

  // Compute histogram and threshold
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }

  let threshold = options.threshold;
  if (threshold < 0) {
    threshold = otsuThreshold(histogram, width * height);
  }

  // Binarize: 0 = background, 255 = object
  const binary = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) {
    const isObject = options.invert
      ? gray[i] >= threshold
      : gray[i] <= threshold;
    binary[i] = isObject ? 255 : 0;
  }

  return { binary, thresholdUsed: threshold };
}

export function computeHistogram(imageData: ImageData): number[] {
  const histogram = new Array(256).fill(0);
  const gray = imageDataToGrayscale(imageData.data);
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }
  return histogram;
}
