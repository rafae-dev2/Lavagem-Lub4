export interface WatermarkAsset {
  dataUrl: string | null;
  width: number;
  height: number;
}

export interface WatermarkOptions {
  /** Opacidade final aplicada diretamente nos pixels da imagem (0..1). */
  alpha?: number;
  /** Tamanho do canvas quadrado de saída em pixels. */
  size?: number;
  /** Desenha anéis concêntricos sutis ao redor da marca d'água. */
  withFrameRings?: boolean;
  /** Cor RGBA dos anéis decorativos quando `withFrameRings` está ativo. */
  ringColor?: string;
}

/**
 * Converte um ativo PNG local (como `/logo.png`) em uma imagem com opacidade já
 * aplicada no canal alfa via canvas, garantindo renderização consistente tanto
 * no `jsPDF` quanto no `html2canvas`.
 */
export async function createLogoWatermarkDataUrl(
  src = '/logo.png',
  options: WatermarkOptions = {},
): Promise<WatermarkAsset> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return { dataUrl: null, width: 0, height: 0 };
  }

  const alpha = Math.max(0.01, Math.min(0.4, options.alpha ?? 0.06));
  const size = Math.max(160, Math.min(900, Math.round(options.size ?? 540)));

  return new Promise<WatermarkAsset>((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const naturalW = image.naturalWidth || image.width;
        const naturalH = image.naturalHeight || image.height;
        if (!naturalW || !naturalH) {
          resolve({ dataUrl: null, width: 0, height: 0 });
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve({ dataUrl: null, width: 0, height: 0 });
          return;
        }

        context.clearRect(0, 0, size, size);

        if (options.withFrameRings) {
          context.save();
          context.strokeStyle = options.ringColor ?? `rgba(20, 72, 47, ${Math.min(0.18, alpha * 1.45)})`;
          context.lineWidth = Math.max(1.5, size * 0.004);
          context.beginPath();
          context.arc(size / 2, size / 2, size * 0.455, 0, Math.PI * 2);
          context.stroke();

          context.setLineDash([size * 0.015, size * 0.012]);
          context.lineWidth = Math.max(1, size * 0.0025);
          context.beginPath();
          context.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }

        const innerMargin = options.withFrameRings ? size * 0.16 : size * 0.08;
        const maxDraw = size - innerMargin * 2;
        const ratio = Math.min(maxDraw / naturalW, maxDraw / naturalH);
        const drawW = naturalW * ratio;
        const drawH = naturalH * ratio;
        const drawX = (size - drawW) / 2;
        const drawY = (size - drawH) / 2;

        context.save();
        context.globalAlpha = alpha;
        context.drawImage(image, drawX, drawY, drawW, drawH);
        context.restore();

        resolve({ dataUrl: canvas.toDataURL('image/png'), width: size, height: size });
      } catch {
        resolve({ dataUrl: null, width: 0, height: 0 });
      }
    };
    image.onerror = () => resolve({ dataUrl: null, width: 0, height: 0 });
    image.src = src;
  });
}
