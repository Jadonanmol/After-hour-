/**
 * Room code extraction, normalization, and validation utilities for AFTERHOURS.
 */

/**
 * Normalizes a room code:
 * - Trims whitespace
 * - Converts to uppercase
 * - Strips all non-alphanumeric characters (A-Z, 0-9)
 * - Limits length to max 8 characters
 */
export function normalizeRoomCode(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

/**
 * Validates a normalized room code according to AFTERHOURS standards.
 * Room codes are expected to be 4 to 8 alphanumeric characters (standard is 6 chars).
 */
export function validateRoomCode(raw: string | null | undefined): { isValid: boolean; error?: string } {
  if (!raw || !raw.trim()) {
    return { isValid: false, error: 'Please enter a room code.' };
  }

  const clean = normalizeRoomCode(raw);
  if (!clean) {
    return { isValid: false, error: 'Please enter a valid alphanumeric room code.' };
  }

  if (clean.length < 4) {
    return { isValid: false, error: 'Room codes are 6 alphanumeric characters (e.g. ABC123).' };
  }

  if (clean.length > 8) {
    return { isValid: false, error: 'Room code cannot exceed 8 characters.' };
  }

  return { isValid: true };
}

export interface ExtractedRoomInfo {
  code: string;
  hasParam: boolean;
  isMalformed: boolean;
  rawParam: string;
}

/**
 * Extracts and normalizes the room code from an invitation URL or query search string.
 * Supports:
 * - Query parameter format: ?room=XYZ or &room=XYZ
 * - Full URL: https://example.com/?room=XYZ
 * - Hash query format: #room=XYZ or /#?room=XYZ
 * - Path format fallback: /room/XYZ
 */
export function extractRoomCodeFromUrl(urlOrSearch?: string): ExtractedRoomInfo {
  let searchStr = '';
  let fullUrl = '';

  try {
    if (urlOrSearch) {
      if (urlOrSearch.includes('?') || urlOrSearch.includes('://')) {
        fullUrl = urlOrSearch;
        const qIndex = urlOrSearch.indexOf('?');
        if (qIndex !== -1) {
          searchStr = urlOrSearch.slice(qIndex);
        }
      } else {
        searchStr = urlOrSearch.startsWith('&') ? `?${urlOrSearch.slice(1)}` : (urlOrSearch.startsWith('?') ? urlOrSearch : `?${urlOrSearch}`);
      }
    } else if (typeof window !== 'undefined') {
      searchStr = window.location.search;
      fullUrl = window.location.href;
    }
  } catch {}

  // 1. Try URLSearchParams on search string
  if (searchStr) {
    try {
      const params = new URLSearchParams(searchStr);
      if (params.has('room')) {
        const rawParam = params.get('room') || '';
        const trimmed = rawParam.trim();
        const code = normalizeRoomCode(trimmed);
        const isMalformed = trimmed.length === 0 || code.length < 4 || code.length > 8 || code !== trimmed.toUpperCase();
        return {
          code,
          hasParam: true,
          isMalformed,
          rawParam,
        };
      }
    } catch {}
  }

  // 2. Try hash parameters e.g. #room=XYZ or #/room=XYZ
  if (fullUrl && fullUrl.includes('#')) {
    try {
      const hashPart = fullUrl.split('#')[1] || '';
      const hashParams = new URLSearchParams(hashPart.includes('?') ? hashPart.slice(hashPart.indexOf('?')) : hashPart);
      if (hashParams.has('room')) {
        const rawParam = hashParams.get('room') || '';
        const trimmed = rawParam.trim();
        const code = normalizeRoomCode(trimmed);
        const isMalformed = trimmed.length === 0 || code.length < 4 || code.length > 8 || code !== trimmed.toUpperCase();
        return {
          code,
          hasParam: true,
          isMalformed,
          rawParam,
        };
      }
    } catch {}
  }

  // 3. Fallback path check: /room/XYZ
  if (fullUrl) {
    try {
      const match = fullUrl.match(/\/room\/([A-Za-z0-9_-]+)/);
      if (match && match[1]) {
        const rawParam = match[1];
        const trimmed = rawParam.trim();
        const code = normalizeRoomCode(trimmed);
        const isMalformed = trimmed.length === 0 || code.length < 4 || code.length > 8;
        return {
          code,
          hasParam: true,
          isMalformed,
          rawParam,
        };
      }
    } catch {}
  }

  return {
    code: '',
    hasParam: false,
    isMalformed: false,
    rawParam: '',
  };
}
