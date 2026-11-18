import type { jsPDF } from "jspdf";
import {
  preloadEquipmentImages,
  resolveEquipmentImage,
} from "./equipmentImages";

export type EquipmentReportImage = Awaited<
  ReturnType<typeof preloadEquipmentImages>
> extends Map<string, infer Entry>
  ? Entry
  : never;
export type EquipmentReportImageMap = Awaited<
  ReturnType<typeof preloadEquipmentImages>
>;
export type ResolvedEquipmentImage = NonNullable<
  ReturnType<typeof resolveEquipmentImage>
>;

/**
 * The source helper intentionally returns an empty/missing entry when the
 * browser cannot load an asset. Reports must turn that into a visible failure
 * before starting a download, while Node contract tests remain text-only.
 */
export function assertEquipmentReportImagesLoaded(
  rows: unknown[],
  imageMap: EquipmentReportImageMap,
): void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof window.location === "undefined" ||
    typeof Image === "undefined"
  ) {
    return;
  }
  for (const row of rows) {
    const image = resolveEquipmentImage(row);
    if (image && !imageMap.has(image.key)) {
      throw new Error(
        `Não foi possível carregar a imagem do equipamento “${image.label}”. Verifique o asset ${image.src} e tente novamente.`,
      );
    }
  }
}

/**
 * Draws one resolved equipment PNG inside the requested box without stretching
 * it. Unknown equipment intentionally returns false and remains text-only.
 */
export function drawEquipmentPdfImage(
  doc: jsPDF,
  row: unknown,
  imageMap: EquipmentReportImageMap,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const image = resolveEquipmentImage(row);
  if (!image || width <= 0 || height <= 0) return false;

  const loaded = imageMap.get(image.key);
  if (
    !loaded ||
    !loaded.dataUrl ||
    !Number.isFinite(loaded.width) ||
    !Number.isFinite(loaded.height) ||
    loaded.width <= 0 ||
    loaded.height <= 0
  ) {
    return false;
  }

  const scale = Math.min(width / loaded.width, height / loaded.height);
  const drawWidth = loaded.width * scale;
  const drawHeight = loaded.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  try {
    // PNG is intentional: the supplied assets contain alpha and must not get
    // a white rectangle over the table text/background.
    doc.addImage(
      loaded.dataUrl,
      "PNG",
      drawX,
      drawY,
      drawWidth,
      drawHeight,
      undefined,
      "FAST",
    );
    return true;
  } catch {
    return false;
  }
}
