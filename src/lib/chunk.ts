/**
 * Split long chapter text into chunks of roughly maxChars,
 * preferring paragraph / sentence boundaries.
 */
export function chunkText(text: string, maxChars = 3000): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const t = current.trim();
    if (t) chunks.push(t);
    current = "";
  };

  const appendPiece = (piece: string) => {
    if (!piece) return;
    if (piece.length > maxChars) {
      const sentences = piece.split(/(?<=[。！？.!?\n])/);
      for (const sentence of sentences) {
        if (!sentence) continue;
        if (sentence.length > maxChars) {
          for (let i = 0; i < sentence.length; i += maxChars) {
            const slice = sentence.slice(i, i + maxChars);
            if (current && current.length + slice.length + 1 > maxChars) {
              pushCurrent();
            }
            current = current ? `${current}${slice}` : slice;
            if (current.length >= maxChars) pushCurrent();
          }
        } else if (current && current.length + sentence.length > maxChars) {
          pushCurrent();
          current = sentence;
        } else {
          current = current ? `${current}${sentence}` : sentence;
        }
      }
      return;
    }

    const sep = current ? "\n\n" : "";
    if (current && current.length + sep.length + piece.length > maxChars) {
      pushCurrent();
      current = piece;
    } else {
      current = current ? `${current}${sep}${piece}` : piece;
    }
  };

  for (const para of paragraphs) {
    appendPiece(para.trim());
  }
  pushCurrent();

  return chunks;
}
