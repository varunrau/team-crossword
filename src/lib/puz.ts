export type Cell = {
  row: number;
  col: number;
  index: number;
  isBlock: boolean;
  solution: string; // uppercase letter or '.' for block
};

export type ClueEntry = {
  number: number;
  clue: string;
  cells: Cell[]; // cells that belong to this entry, in order
};

export type ParsedPuz = {
  width: number;
  height: number;
  title: string;
  author: string;
  copyright: string;
  grid: Cell[]; // length = width * height, row-major
  cluesRaw: string[]; // raw clues in Across-then-Down order
  across: ClueEntry[];
  down: ClueEntry[];
};

// Minimal .puz parser sufficient for rendering and clues.
// Spec reference: https://code.google.com/archive/p/puz/wikis/FileFormat.wiki
// We intentionally ignore checksums and extensions; we just locate width/height,
// read solution + fill grids, and the string section.
export function parsePuz(buf: ArrayBuffer): ParsedPuz {
  const dv = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // Standard offsets per spec
  const OFFSET_WIDTH = 0x2c; // 44
  const OFFSET_HEIGHT = 0x2d; // 45
  const OFFSET_NUM_CLUES = 0x2e; // 46-47 (LE)

  const width = dv.getUint8(OFFSET_WIDTH);
  const height = dv.getUint8(OFFSET_HEIGHT);
  const numClues = dv.getUint16(OFFSET_NUM_CLUES, true);

  if (!width || !height) {
    throw new Error("Invalid .puz: missing width/height");
  }

  const gridSize = width * height;

  // After header (at 0x34) comes the solution then the fill (each gridSize bytes)
  const OFFSET_SOLUTION = 0x34; // 52
  const OFFSET_FILL = OFFSET_SOLUTION + gridSize;

  if (bytes.length < OFFSET_FILL + gridSize) {
    throw new Error("Invalid .puz: truncated grid data");
  }

  const solBytes = bytes.slice(OFFSET_SOLUTION, OFFSET_SOLUTION + gridSize);
  // const fillBytes = bytes.slice(OFFSET_FILL, OFFSET_FILL + gridSize); // Not strictly needed

  // Strings start right after fillBytes and are NUL-terminated: title, author, copyright,
  // then numClues clues, then optional notepad.
  let cursor = OFFSET_FILL + gridSize;
  const readNullTerminated = (): string => {
    const start = cursor;
    while (cursor < bytes.length && bytes[cursor] !== 0) cursor++;
    if (cursor >= bytes.length) throw new Error("Invalid .puz: unterminated string");
    const slice = bytes.slice(start, cursor);
    cursor++; // skip NUL
    // Decode as latin-1; .puz files commonly use CP1252/latin1 for basic chars.
    const str = new TextDecoder("latin1").decode(slice);
    return str;
  };

  const title = readNullTerminated();
  const author = readNullTerminated();
  const copyright = readNullTerminated();

  const cluesRaw: string[] = [];
  for (let i = 0; i < numClues; i++) {
    cluesRaw.push(readNullTerminated());
  }
  // Optional notepad (ignored)
  // const notepad = cursor < bytes.length && bytes[cursor] !== 0 ? readNullTerminated() : "";

  // Build cell grid
  const grid: Cell[] = new Array(gridSize);
  for (let i = 0; i < gridSize; i++) {
    const row = Math.floor(i / width);
    const col = i % width;
    const ch = String.fromCharCode(solBytes[i]);
    const isBlock = ch === ".";
    grid[i] = {
      row,
      col,
      index: i,
      isBlock,
      solution: isBlock ? "." : ch.toUpperCase(),
    };
  }

  // Number and split clues: across first (scan order), then down.
  const acrossStarts: number[] = [];
  const downStarts: number[] = [];

  const isBlockAt = (r: number, c: number): boolean => {
    if (r < 0 || r >= height || c < 0 || c >= width) return true; // treat out of bounds as blocks
    return grid[r * width + c].isBlock;
  };

  // Determine starts
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      if (grid[idx].isBlock) continue;
      const startsAcross = c === 0 || isBlockAt(r, c - 1);
      const startsDown = r === 0 || isBlockAt(r - 1, c);
      if (startsAcross) acrossStarts.push(idx);
      if (startsDown) downStarts.push(idx);
    }
  }

  // Assign numbers in scan order
  const numbering: Map<number, number> = new Map(); // cellIndex -> number
  let nextNum = 1;
  let ai = 0;
  let di = 0;
  // Interleave numbering by scan of grid; numbers are assigned to any start (either across or down)
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      if (grid[idx].isBlock) continue;
      const startsAcross = ai < acrossStarts.length && acrossStarts[ai] === idx;
      const startsDown = di < downStarts.length && downStarts[di] === idx;
      if (startsAcross || startsDown) {
        numbering.set(idx, nextNum++);
        if (startsAcross) ai++;
        if (startsDown) di++;
      }
    }
  }

  // Build across entries (scan left-to-right, top-to-bottom)
  const across: ClueEntry[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      if (grid[idx].isBlock) continue;
      const startsAcross = c === 0 || isBlockAt(r, c - 1);
      if (!startsAcross) continue;
      const number = numbering.get(idx)!;
      const cells: Cell[] = [];
      let cc = c;
      while (cc < width && !isBlockAt(r, cc)) {
        cells.push(grid[r * width + cc]);
        cc++;
      }
      across.push({ number, clue: "", cells });
    }
  }

  // Build down entries (scan top-to-bottom, left-to-right)
  const down: ClueEntry[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      if (grid[idx].isBlock) continue;
      const startsDown = r === 0 || isBlockAt(r - 1, c);
      if (!startsDown) continue;
      const number = numbering.get(idx)!;
      const cells: Cell[] = [];
      let rr = r;
      while (rr < height && !isBlockAt(rr, c)) {
        cells.push(grid[rr * width + c]);
        rr++;
      }
      down.push({ number, clue: "", cells });
    }
  }

  // Assign clues to entries: across first, then down, in order
  if (cluesRaw.length < across.length + down.length) {
    // Some themed puzzles might have extras; we just guard for safety.
    throw new Error("Invalid .puz: not enough clues for grid");
  }
  let clueIdx = 0;
  for (let i = 0; i < across.length; i++) {
    across[i].clue = cluesRaw[clueIdx++] || "";
  }
  for (let i = 0; i < down.length; i++) {
    down[i].clue = cluesRaw[clueIdx++] || "";
  }

  return {
    width,
    height,
    title,
    author,
    copyright,
    grid,
    cluesRaw,
    across,
    down,
  };
}

