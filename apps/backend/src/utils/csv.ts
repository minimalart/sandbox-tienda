import { Readable } from 'stream';

/**
 * Convert an array of objects to CSV string
 */
export function objectsToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns?: string[]
): string {
  if (data.length === 0) {
    return '';
  }

  const firstRow = data[0];
  if (!firstRow) {
    return '';
  }

  const headers = columns || Object.keys(firstRow);
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map(escapeCSVValue).join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      return escapeCSVValue(value);
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Parse CSV string to array of objects
 */
export function csvToObjects<T extends Record<string, unknown>>(csvContent: string): T[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const firstLine = lines[0];
  if (!firstLine) {
    return [];
  }

  const headers = parseCSVLine(firstLine);
  const results: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = parseCSVLine(line);
    const obj: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });

    results.push(obj as T);
  }

  return results;
}

/**
 * Escape a value for CSV format
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let stringValue = String(value);

  // If value contains comma, newline, or double quote, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    stringValue = `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

/**
 * Convert a readable stream to string
 */
export async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
