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
  clueOrder: "across-down" | "down-across" | "interleaved-ad" | "interleaved-da";
};

export type ParseOptions = {
  clueOrder?: "across-down" | "down-across" | "interleaved-ad" | "interleaved-da";
};

// Minimal .puz parser sufficient for rendering and clues.
// Spec reference: https://code.google.com/archive/p/puz/wikis/FileFormat.wiki
// We intentionally ignore checksums and extensions; we just locate width/height,
// read solution + fill grids, and the string section.
export function parsePuz(buf: ArrayBuffer, opts: ParseOptions = {}): ParsedPuz {
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
    if (cursor >= bytes.length)
      throw new Error("Invalid .puz: unterminated string");
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
    const c = readNullTerminated();
    console.log("clue", c);
    cluesRaw.push(c);
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

  const isBlockAt = (r: number, c: number): boolean => {
    if (r < 0 || r >= height || c < 0 || c >= width) return true; // treat out of bounds as blocks
    return grid[r * width + c].isBlock;
  };

  console.log(grid);

  // Build entries and numbers in a single scan to ensure exact order
  const across: ClueEntry[] = [];
  const down: ClueEntry[] = [];
  type Start = { number: number; startsAcross: boolean; startsDown: boolean; acrossIndex?: number; downIndex?: number };
  const starts: Start[] = [];
  let nextNum = 1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const idx = r * width + c;
      if (grid[idx].isBlock) continue;
      const sa = c === 0 || isBlockAt(r, c - 1);
      const sd = r === 0 || isBlockAt(r - 1, c);
      if (!sa && !sd) continue;
      const num = nextNum++;
      const s: Start = { number: num, startsAcross: sa, startsDown: sd };
      if (sa) {
        const cells: Cell[] = [];
        let cc = c;
        while (cc < width && !isBlockAt(r, cc)) {
          cells.push(grid[r * width + cc]);
          cc++;
        }
        s.acrossIndex = across.length;
        across.push({ number: num, clue: "", cells });
      }
      if (sd) {
        const cells: Cell[] = [];
        let rr = r;
        while (rr < height && !isBlockAt(rr, c)) {
          cells.push(grid[rr * width + c]);
          rr++;
        }
        s.downIndex = down.length;
        down.push({ number: num, clue: "", cells });
      }
      starts.push(s);
    }
  }

  // Assign clues based on requested order (default to interleaved A->D,
  // which is common among modern generators; override via opts)
  const order = opts.clueOrder || "interleaved-ad";
  let clueIdx = 0;
  const take = () => (clueIdx < cluesRaw.length ? cluesRaw[clueIdx++] : "");
  if (order === "across-down") {
    for (let i = 0; i < across.length; i++) across[i].clue = take();
    for (let i = 0; i < down.length; i++) down[i].clue = take();
  } else if (order === "down-across") {
    for (let i = 0; i < down.length; i++) down[i].clue = take();
    for (let i = 0; i < across.length; i++) across[i].clue = take();
  } else if (order === "interleaved-ad") {
    for (const s of starts) {
      if (s.startsAcross && s.acrossIndex != null) across[s.acrossIndex].clue = take();
      if (s.startsDown && s.downIndex != null) down[s.downIndex].clue = take();
    }
  } else if (order === "interleaved-da") {
    for (const s of starts) {
      if (s.startsDown && s.downIndex != null) down[s.downIndex].clue = take();
      if (s.startsAcross && s.acrossIndex != null) across[s.acrossIndex].clue = take();
    }
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
    clueOrder: order,
  };
}
