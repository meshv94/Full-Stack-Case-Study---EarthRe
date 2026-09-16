const { parse } = require('csv-parse/sync');

/**
 * Parses raw CSV content string or buffer into an array of row objects.
 *
 * @param {string|Buffer} csvContent 
 * @returns {Array<Object>}
 */
function parseCsvContent(csvContent) {
  if (!csvContent) {
    throw new Error('CSV content is empty');
  }

  const text = Buffer.isBuffer(csvContent) ? csvContent.toString('utf-8') : String(csvContent);
  
  // Parse with header row
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  return records;
}

module.exports = {
  parseCsvContent
};
