import { parse } from 'csv-parse/sync';

/**
 * Parses raw CSV content into array of row objects.
 */
export function parseCsvContent(csvContent) {
  if (!csvContent) {
    throw new Error('CSV content is empty');
  }

  const text = Buffer.isBuffer(csvContent) ? csvContent.toString('utf-8') : String(csvContent);
  
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  return records;
}
