/**
 * Module de compression et décompression Gzip pour le stockage Cloud Firestore et la persistance.
 * Utilise l'API standard Web CompressionStream / DecompressionStream.
 * Permet une réduction de taille de 85% à 95% pour le JSON de séances et séries.
 */

export const MAX_FIRESTORE_DATA_CHARS = 500000;
export const WARN_FIRESTORE_DATA_CHARS = 400000; // Alerte à 80% du quota

/**
 * Compresse une chaîne de caractères en Gzip codé en Base64 préfixé par 'gz:'.
 * En cas de non-support de CompressionStream, retourne la chaîne brute.
 */
export async function compressString(raw: string): Promise<string> {
  if (!raw || typeof raw !== 'string') return '';
  if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') {
    return raw;
  }
  try {
    const blob = new Blob([raw]);
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    const response = new Response(stream);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Conversion binaire rapide en base64 par blocs pour éviter le dépassement de pile
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return 'gz:' + btoa(binary);
  } catch (err) {
    console.warn('[Compression] Échec de la compression gzip, repli sur chaîne brute:', err);
    return raw;
  }
}

/**
 * Décompresse une chaîne Gzip Base64 préfixée par 'gz:' ou retourne la chaîne brute si non compressée.
 */
export async function decompressString(data: string): Promise<string> {
  if (!data || typeof data !== 'string') return '';
  if (!data.startsWith('gz:')) {
    return data;
  }
  if (typeof DecompressionStream === 'undefined' || typeof Response === 'undefined') {
    console.warn('[Compression] DecompressionStream non supporté par cet environnement');
    return data;
  }
  try {
    const base64Data = data.slice(3);
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes]);
    const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    const response = new Response(stream);
    return await response.text();
  } catch (err) {
    console.warn('[Compression] Échec de la décompression gzip:', err);
    return data;
  }
}

/**
 * Calcule l'utilisation en pourcentage du plafond Firestore
 */
export function computeQuotaUsage(payloadLength: number): {
  percent: number;
  isWarning: boolean;
  isOverQuota: boolean;
  usedChars: number;
  maxChars: number;
} {
  const percent = Math.min(100, Math.round((payloadLength / MAX_FIRESTORE_DATA_CHARS) * 100));
  return {
    percent,
    isWarning: payloadLength >= WARN_FIRESTORE_DATA_CHARS,
    isOverQuota: payloadLength > MAX_FIRESTORE_DATA_CHARS,
    usedChars: payloadLength,
    maxChars: MAX_FIRESTORE_DATA_CHARS
  };
}
