import type { Sheet } from '@fortune-sheet/core';

const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 400;
const CHAR_WIDTH = 8; // approx pixels per character at default font size 10
const COL_PADDING = 24; // padding for cell borders + some breathing room

/**
 * Calculates auto-fit column widths based on cell content.
 */
function calcColumnWidths(values: string[][], colCount: number): Record<string, number> {
  const maxLengths = new Array(colCount).fill(0);

  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      const len = (values[r][c] ?? '').length;
      if (len > maxLengths[c]) maxLengths[c] = len;
    }
  }

  const columnlen: Record<string, number> = {};
  for (let c = 0; c < colCount; c++) {
    if (maxLengths[c] > 0) {
      const width = Math.min(Math.max(maxLengths[c] * CHAR_WIDTH + COL_PADDING, MIN_COL_WIDTH), MAX_COL_WIDTH);
      columnlen[String(c)] = width;
    }
  }

  return columnlen;
}

/**
 * Converts Google Sheets API string[][] data into FortuneSheet's Sheet format.
 */
export function toFortuneSheet(
  values: string[][],
  sheetName: string,
  sheetIndex: number
): Sheet {
  const celldata: { r: number; c: number; v: { v: string; m: string } }[] = [];
  let maxCol = 0;

  for (let r = 0; r < values.length; r++) {
    if (values[r].length > maxCol) maxCol = values[r].length;
    for (let c = 0; c < values[r].length; c++) {
      const val = values[r][c];
      if (val !== undefined && val !== null && val !== '') {
        celldata.push({ r, c, v: { v: val, m: val } });
      }
    }
  }

  const columnlen = calcColumnWidths(values, maxCol);

  return {
    name: sheetName,
    index: String(sheetIndex),
    celldata,
    order: sheetIndex,
    row: Math.max(values.length + 20, 100),
    column: Math.max(maxCol + 5, 26),
    config: { columnlen },
  } as Sheet;
}

/**
 * Converts a column index (0-based) to a spreadsheet column letter (A, B, ..., Z, AA, AB, ...).
 */
function colToLetter(col: number): string {
  let letter = '';
  let c = col;
  while (c >= 0) {
    letter = String.fromCharCode((c % 26) + 65) + letter;
    c = Math.floor(c / 26) - 1;
  }
  return letter;
}

interface CellUpdate {
  range: string;
  value: string;
}

/**
 * Diffs old vs new FortuneSheet data to produce a list of cell updates
 * for the Google Sheets API batchUpdate endpoint.
 */
export function diffSheetChanges(
  oldSheets: Sheet[],
  newSheets: Sheet[]
): CellUpdate[] {
  const updates: CellUpdate[] = [];

  for (const newSheet of newSheets) {
    const oldSheet = oldSheets.find((s) => s.name === newSheet.name);
    const oldDataMap = new Map<string, string>();

    if (oldSheet?.data) {
      for (let r = 0; r < oldSheet.data.length; r++) {
        for (let c = 0; c < (oldSheet.data[r]?.length ?? 0); c++) {
          const cell = oldSheet.data[r]?.[c];
          const val = cell?.v?.toString() ?? cell?.m?.toString() ?? '';
          if (val) oldDataMap.set(`${r},${c}`, val);
        }
      }
    }

    if (newSheet?.data) {
      for (let r = 0; r < newSheet.data.length; r++) {
        for (let c = 0; c < (newSheet.data[r]?.length ?? 0); c++) {
          const cell = newSheet.data[r]?.[c];
          const newVal = cell?.v?.toString() ?? cell?.m?.toString() ?? '';
          const key = `${r},${c}`;
          const oldVal = oldDataMap.get(key) ?? '';

          if (newVal !== oldVal) {
            const colLetter = colToLetter(c);
            const range = `'${newSheet.name}'!${colLetter}${r + 1}`;
            updates.push({ range, value: newVal });
          }
        }
      }
    }
  }

  return updates;
}
