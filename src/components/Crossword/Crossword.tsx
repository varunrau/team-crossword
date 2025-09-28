"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Crossword.module.css";
import type { ParsedPuz } from "@/lib/puz";
import { parsePuz } from "@/lib/puz";

type Props = {
  className?: string;
};

type Team = {
  id: number;
  name: string;
  color: string; // hex
};

export default function Crossword(props: Props) {
  const [puz, setPuz] = useState<ParsedPuz | null>(null);
  const [cells, setCells] = useState<string[]>([]); // user-entered letters per cell, length width*height
  const inputRefs = useRef<HTMLInputElement[]>([]);
  const [mode, setMode] = useState<"across" | "down">("across");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Array<"unchecked" | "correct" | "incorrect">>([]);
  const [owners, setOwners] = useState<Array<number | null>>([]); // which team entered the cell

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState("#2d7ff9");
  const [nextTeamId, setNextTeamId] = useState(1);
  const [showTeamInputs, setShowTeamInputs] = useState(true);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [cellSize, setCellSize] = useState<number>(40);
  const gridAreaRef = useRef<HTMLDivElement | null>(null);
  const teamBarRef = useRef<HTMLDivElement | null>(null);

  const setCaretToEnd = (el: HTMLInputElement | null) => {
    if (!el) return;
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch (_) {
      // no-op for unsupported inputs
    }
  };

  const focusCell = (i: number) => {
    const el = inputRefs.current[i];
    if (el) {
      el.focus();
      setCaretToEnd(el);
    }
  };

  const maps = useMemo(() => {
    if (!puz) return { cellToAcross: new Map<number, number>(), cellToDown: new Map<number, number>() };
    const cellToAcross = new Map<number, number>();
    puz.across.forEach((entry, i) => {
      entry.cells.forEach((cell) => cellToAcross.set(cell.index, i));
    });
    const cellToDown = new Map<number, number>();
    puz.down.forEach((entry, i) => {
      entry.cells.forEach((cell) => cellToDown.set(cell.index, i));
    });
    return { cellToAcross, cellToDown };
  }, [puz]);

  const numberMap = useMemo(() => {
    const m = new Map<number, number>();
    if (!puz) return m;
    puz.across.forEach((e) => {
      const idx = e.cells[0]?.index;
      if (typeof idx === "number") m.set(idx, e.number);
    });
    puz.down.forEach((e) => {
      const idx = e.cells[0]?.index;
      if (typeof idx === "number" && !m.has(idx)) m.set(idx, e.number);
    });
    return m;
  }, [puz]);

  const goToClue = useCallback(
    (dir: "across" | "down", clueIndex: number) => {
      if (!puz) return;
      const arr = dir === "across" ? puz.across : puz.down;
      if (arr.length === 0) return;
      const norm = ((clueIndex % arr.length) + arr.length) % arr.length;
      const target = arr[norm];
      const firstCellIdx = target.cells[0]?.index;
      if (typeof firstCellIdx === "number") {
        setMode(dir);
        setActiveIndex(firstCellIdx);
        focusCell(firstCellIdx);
      }
    },
    [puz],
  );

  const onFile = useCallback(async (f: File) => {
    const buf = await f.arrayBuffer();
    const parsed = parsePuz(buf);
    setPuz(parsed);
    // Initialize user cells: empty for non-blocks, '' for block (kept unused)
    const initial = parsed.grid.map((cell) => (cell.isBlock ? "" : ""));
    setCells(initial);
    setStatus(parsed.grid.map((cell) => (cell.isBlock ? "unchecked" : "unchecked")));
    setOwners(parsed.grid.map(() => null));
    inputRefs.current = [];
  }, []);

  // Resize cells to fill most of the viewport while respecting clues column
  const computeCellSize = useCallback(() => {
    if (!puz) return;
    const vh = typeof window !== "undefined" ? window.innerHeight : 900;
    const rectTop = gridAreaRef.current?.getBoundingClientRect().top ?? 0;
    const teamH = teamBarRef.current?.getBoundingClientRect().height ?? 0;
    const verticalPadding = 8; // small breathing room
    const availableH = Math.max(120, Math.floor(vh - rectTop - teamH - verticalPadding));
    const sizeByH = Math.floor(availableH / puz.height);

    // Available width equals the left column width
    const leftWidth = gridAreaRef.current?.clientWidth ?? (typeof window !== "undefined" ? window.innerWidth - 420 : 800);
    const sizeByW = Math.floor(leftWidth / puz.width);

    // Allow larger cells to better fill the screen
    const size = Math.max(28, Math.min(128, Math.min(sizeByH, sizeByW)));
    setCellSize(size);
  }, [puz]);

  // Recompute when puzzle loads and on resize
  useEffect(() => {
    computeCellSize();
  }, [computeCellSize]);

  useEffect(() => {
    const onResize = () => computeCellSize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeCellSize]);

  useEffect(() => {
    // Recompute after team bar layout changes (adding/removing inputs)
    const t = setTimeout(() => computeCellSize(), 0);
    return () => clearTimeout(t);
  }, [teams.length, showTeamInputs, computeCellSize]);

  const handleFileChange = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
    (e) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
  [onFile]);

  const setRef = (idx: number) => (el: HTMLInputElement | null) => {
    if (el) inputRefs.current[idx] = el;
  };

  const onCellChange = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    // Disallow edits on correct cells
    if (status[idx] === "correct") return;
    const v = (e.target.value || "").toUpperCase().replace(/[^A-Z]/g, "");
    setCells((prev) => {
      const next = prev.slice();
      next[idx] = v.slice(0, 1);
      return next;
    });
    setOwners((prev) => {
      const copy = prev.slice();
      copy[idx] = v ? selectedTeamId : null;
      return copy;
    });
    // If this cell was marked incorrect, require deletion first to clear
    setStatus((prev) => {
      if (!prev.length) return prev;
      if (prev[idx] === "incorrect") {
        const copy = prev.slice();
        const newVal = v.slice(0, 1);
        if (newVal === "") {
          copy[idx] = "unchecked";
        } else {
          // keep marked incorrect until user deletes
          copy[idx] = "incorrect";
        }
        return copy;
      }
      return prev;
    });
    // Auto-advance based on mode
    if (v.length >= 1 && puz) {
      const w = puz.width;
      const h = puz.height;
      const r = Math.floor(idx / w);
      const c = idx % w;
      let nextIndex = idx;
      if (mode === "across") {
        let nc = c + 1;
        while (nc < w && puz.grid[r * w + nc].isBlock) nc++;
        if (nc < w) nextIndex = r * w + nc;
      } else {
        let nr = r + 1;
        while (nr < h && puz.grid[nr * w + c].isBlock) nr++;
        if (nr < h) nextIndex = nr * w + c;
      }
      if (nextIndex !== idx) {
        focusCell(nextIndex);
        setActiveIndex(nextIndex);
      } else {
        // ensure caret stays at end even if we didn't move
        focusCell(idx);
      }
    }
  };

  const onCellKeyDown = (idx: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!puz) return;
    const w = puz.width;
    const h = puz.height;
    const r = Math.floor(idx / w);
    const c = idx % w;

    // Prevent editing correct (locked) cells
    if (status[idx] === "correct") {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        (e.key.length === 1 && /[a-zA-Z]/.test(e.key))
      ) {
        e.preventDefault();
        return;
      }
    }

    const move = (nr: number, nc: number) => {
      if (nr < 0 || nr >= h || nc < 0 || nc >= w) return;
      const nidx = nr * w + nc;
      if (puz.grid[nidx].isBlock) return;
      focusCell(nidx);
      setActiveIndex(nidx);
    };

    // Toggle direction on Space
    if (e.key === " " || e.key === "Spacebar" || e.code === "Space") {
      e.preventDefault();
      setMode((m) => (m === "across" ? "down" : "across"));
      return;
    }

    switch (e.key) {
      case "Tab": {
        e.preventDefault();
        if (!puz) return;
        if (mode === "across") {
          const iAcross = maps.cellToAcross.get(idx) ?? 0;
          const next = iAcross + 1;
          if (next < puz.across.length) {
            goToClue("across", next);
          } else {
            // Wrap to first Down clue after last Across
            goToClue("down", 0);
          }
        } else {
          const iDown = maps.cellToDown.get(idx) ?? 0;
          const next = iDown + 1;
          if (next < puz.down.length) {
            goToClue("down", next);
          } else {
            // Wrap to first Across clue after last Down
            goToClue("across", 0);
          }
        }
        return;
      }
      case "ArrowRight":
        e.preventDefault();
        setMode("across");
        for (let nc = c + 1; nc < w; nc++) {
          if (!puz.grid[r * w + nc].isBlock) return move(r, nc);
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        setMode("across");
        for (let nc = c - 1; nc >= 0; nc--) {
          if (!puz.grid[r * w + nc].isBlock) return move(r, nc);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        setMode("down");
        for (let nr = r + 1; nr < h; nr++) {
          if (!puz.grid[nr * w + c].isBlock) return move(nr, c);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        setMode("down");
        for (let nr = r - 1; nr >= 0; nr--) {
          if (!puz.grid[nr * w + c].isBlock) return move(nr, c);
        }
        break;
      case "Backspace":
        // if empty, back up
        if (!cells[idx]) {
          e.preventDefault();
          if (mode === "across") {
            for (let nc = c - 1; nc >= 0; nc--) {
              const nidx = r * w + nc;
              if (!puz.grid[nidx].isBlock) {
                focusCell(nidx);
                setActiveIndex(nidx);
                setCells((prev) => {
                  const next = prev.slice();
                  next[nidx] = "";
                  return next;
                });
                setStatus((prev) => {
                  const copy = prev.slice();
                  copy[nidx] = "unchecked";
                  return copy;
                });
                setOwners((prev) => {
                  const copy = prev.slice();
                  copy[nidx] = null;
                  return copy;
                });
                break;
              }
            }
          } else {
            for (let nr = r - 1; nr >= 0; nr--) {
              const nidx = nr * w + c;
              if (!puz.grid[nidx].isBlock) {
                focusCell(nidx);
                setActiveIndex(nidx);
                setCells((prev) => {
                  const next = prev.slice();
                  next[nidx] = "";
                  return next;
                });
                setStatus((prev) => {
                  const copy = prev.slice();
                  copy[nidx] = "unchecked";
                  return copy;
                });
                setOwners((prev) => {
                  const copy = prev.slice();
                  copy[nidx] = null;
                  return copy;
                });
                break;
              }
            }
          }
        }
        break;
      case "Delete":
        e.preventDefault();
        if (status[idx] !== "correct") {
          setCells((prev) => {
            const next = prev.slice();
            next[idx] = "";
            return next;
          });
          setStatus((prev) => {
            const copy = prev.slice();
            copy[idx] = "unchecked";
            return copy;
          });
          setOwners((prev) => {
            const copy = prev.slice();
            copy[idx] = null;
            return copy;
          });
        }
        break;
      default:
        break;
    }
  };

  const checkPuzzle = useCallback(() => {
    if (!puz) return;
    const w = puz.width;
    const size = w * puz.height;
    setStatus((prev) => {
      const next: Array<"unchecked" | "correct" | "incorrect"> = new Array(size);
      for (let i = 0; i < size; i++) {
        const cell = puz.grid[i];
        if (cell.isBlock) {
          next[i] = "unchecked";
          continue;
        }
        const val = (cells[i] || "").toUpperCase();
        if (!val) {
          next[i] = "unchecked";
        } else if (val === cell.solution) {
          next[i] = "correct";
        } else {
          next[i] = "incorrect";
        }
      }
      return next;
    });
  }, [puz, cells]);

  const scores = useMemo(() => {
    const map = new Map<number, number>();
    teams.forEach((t) => map.set(t.id, 0));
    status.forEach((s, i) => {
      if (s === "correct") {
        const owner = owners[i];
        if (owner != null) map.set(owner, (map.get(owner) || 0) + 1);
      }
    });
    return map; // teamId -> score
  }, [teams, status, owners]);

  const getTeamColor = (teamId: number | null) => {
    if (teamId == null) return "var(--foreground)";
    return teams.find((t) => t.id === teamId)?.color || "var(--foreground)";
  };

  const getCellTextStyle = (i: number): React.CSSProperties => {
    const st = status[i];
    if (st === "incorrect") return { color: "#d22" };
    const color = getTeamColor(owners[i] ?? null);
    if (st === "correct") return { color, opacity: 0.6 };
    return { color };
  };

  const gridStyle = useMemo(() => {
    if (!puz) return {} as React.CSSProperties;
    return {
      gridTemplateColumns: `repeat(${puz.width}, var(--cell-size))`,
      ["--cell-size"]: `${cellSize}px`,
    } as React.CSSProperties;
  }, [puz, cellSize]);

  const isRowHighlighted = useCallback(
    (cellIndex: number) => {
      if (!puz || activeIndex == null) return false;
      if (mode !== "across") return false;
      const w = puz.width;
      return Math.floor(cellIndex / w) === Math.floor(activeIndex / w);
    },
    [puz, activeIndex, mode],
  );

  const isColHighlighted = useCallback(
    (cellIndex: number) => {
      if (!puz || activeIndex == null) return false;
      if (mode !== "down") return false;
      const w = puz.width;
      return cellIndex % w === activeIndex % w;
    },
    [puz, activeIndex, mode],
  );

  return (
    <div className={props.className}>
      <div className={styles.uploader}>
        <div
          className={`${styles.dropZone} ${dragActive ? styles.dropActive : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const files = Array.from(e.dataTransfer?.files || []);
            const file = files.find((f) => f.name.toLowerCase().endsWith(".puz")) || files[0];
            if (file) onFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Click or drag a .puz file to upload"
        >
          Click or drag a .puz file here
        </div>
        <input
          ref={fileInputRef}
          className={styles.hidden}
          type="file"
          accept=".puz,application/octet-stream"
          suppressHydrationWarning
          onChange={handleFileChange}
        />
      </div>

      {!puz ? null : (
        <div className={styles.container}>
          <div className={styles.gridWrapper} ref={gridAreaRef}>
            <div className={styles.meta}>
              <div><strong>{puz.title || "Untitled"}</strong></div>
              <div>{puz.author}</div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={checkPuzzle}>
                Check Puzzle
              </button>
            </div>
            <div className={styles.grid} style={gridStyle}>
              {puz.grid.map((cell, i) =>
                cell.isBlock ? (
                  <div key={i} className={styles.block} />
                ) : (
                  <div
                    key={i}
                    className={`${styles.cell} ${isRowHighlighted(i) ? styles.rowHighlight : ""} ${isColHighlighted(i) ? styles.colHighlight : ""}`}
                  >
                    {numberMap.has(i) ? (
                      <span className={styles.cellNum}>{numberMap.get(i)}</span>
                    ) : null}
                    <input
                      ref={setRef(i)}
                      className={`${styles.cellInput} ${status[i] === "incorrect" ? styles.incorrect : ""}`}
                      style={getCellTextStyle(i)}
                      inputMode="text"
                      pattern="[A-Za-z]"
                      autoCapitalize="characters"
                      autoComplete="off"
                      autoCorrect="off"
                      maxLength={1}
                      value={cells[i] ?? ""}
                      readOnly={status[i] === "correct"}
                      onFocus={(e) => {
                        setActiveIndex(i);
                        setCaretToEnd(e.currentTarget);
                      }}
                      onClick={(e) => {
                        setActiveIndex(i);
                        setCaretToEnd(e.currentTarget);
                      }}
                      onChange={onCellChange(i)}
                      onKeyDown={onCellKeyDown(i)}
                    />
                  </div>
                ),
              )}
            </div>
            
          </div>

          <div className={styles.clues}>
            <div className={styles.cluesColumns}>
              <div className={styles.clueColumn}>
                <div className={styles.clueSectionTitle}>Across</div>
                <ul className={styles.clueList}>
                  {puz.across.map((a) => (
                    <li key={`A${a.number}`} className={styles.clueItem}>
                      <strong>{a.number}.</strong> {a.clue}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.clueColumn}>
                <div className={styles.clueSectionTitle}>Down</div>
                <ul className={styles.clueList}>
                  {puz.down.map((d) => (
                    <li key={`D${d.number}`} className={styles.clueItem}>
                      <strong>{d.number}.</strong> {d.clue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      {puz ? (
        <div className={styles.teamBar} ref={teamBarRef}>
          <div className={styles.teamsRow}>
            {teams.map((t) => {
              const selected = t.id === selectedTeamId;
              const score = scores.get(t.id) || 0;
              return (
                <div
                  key={t.id}
                  className={`${styles.teamItem} ${selected ? styles.teamSelected : ""}`}
                  onClick={() => {
                    if (selected) {
                      setEditingTeamId(t.id);
                    } else {
                      setSelectedTeamId(t.id);
                      setEditingTeamId(null);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (editingTeamId === t.id) return; // don't hijack keys while editing
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (selected) {
                        setEditingTeamId(t.id);
                      } else {
                        setSelectedTeamId(t.id);
                        setEditingTeamId(null);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const next = e.relatedTarget as Node | null;
                    if (!next || !e.currentTarget.contains(next)) {
                      setEditingTeamId(null);
                    }
                  }}
                >
                  {editingTeamId === t.id ? (
                    <>
                      <input
                        type="color"
                        value={t.color}
                        onChange={(e) =>
                          setTeams((prev) => prev.map((tm) => (tm.id === t.id ? { ...tm, color: e.target.value } : tm)))
                        }
                        aria-label={`Color for ${t.name}`}
                      />
                      <input
                        type="text"
                        className={styles.addTeamInput}
                        value={t.name}
                        onChange={(e) =>
                          setTeams((prev) => prev.map((tm) => (tm.id === t.id ? { ...tm, name: e.target.value } : tm)))
                        }
                        aria-label={`Name for ${t.name}`}
                      />
                      <button
                        type="button"
                        className={styles.addTeamBtn}
                        onClick={() => setEditingTeamId(null)}
                      >
                        Save
                      </button>
                      <span className={styles.teamScore}>{score}</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.dot} style={{ background: t.color }} />
                      <span className={`${styles.teamName} ${selected ? styles.teamNameSelected : ""}`}>{t.name}</span>
                      <span className={styles.teamScore}>{score}</span>
                    </>
                  )}
                </div>
              );
            })}
            {showTeamInputs ? (
              <form
                className={styles.addTeamForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newTeamName.trim() || `Team ${nextTeamId}`;
                  const team: Team = { id: nextTeamId, name, color: newTeamColor };
                  setTeams((prev) => [...prev, team]);
                  setSelectedTeamId(team.id);
                  setNextTeamId((n) => n + 1);
                  setNewTeamName("");
                }}
              >
                <input
                  type="color"
                  value={newTeamColor}
                  onChange={(e) => setNewTeamColor(e.target.value)}
                  aria-label="Team color"
                />
                <input
                  type="text"
                  className={styles.addTeamInput}
                  placeholder="Team name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
                <button type="submit" className={styles.addTeamBtn}>Add Team</button>
                <button
                  type="button"
                  className={styles.addTeamBtn}
                  disabled={teams.length < 2}
                  onClick={() => setShowTeamInputs(false)}
                >
                  Start
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
