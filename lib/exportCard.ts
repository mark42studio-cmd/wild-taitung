/**
 * Captures a DOM element as a PNG and triggers browser download.
 * Uses dynamic import so html2canvas is never bundled server-side.
 * scale:3 on a 360×640 element → 1080×1920 (IG story resolution).
 */
export async function exportElementAsImage(
  element: HTMLElement,
  filename = `wild-taitung-${Date.now()}.png`,
): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#0a1510',
    logging: false,
    width: element.offsetWidth,
    height: element.offsetHeight,
  } as any);

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
