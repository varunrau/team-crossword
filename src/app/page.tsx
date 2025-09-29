"use client";

import { useRef, useState } from "react";
import styles from "./page.module.css";
import Crossword, { type CrosswordHandle } from "@/components/Crossword/Crossword";

export default function Home() {
  const crosswordRef = useRef<CrosswordHandle>(null);
  const [canStart, setCanStart] = useState(false);
  const [hasPuzzle, setHasPuzzle] = useState(false);
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <h1>Team Crossword</h1>
          {hasPuzzle && (
            <>
              <button
                className={styles.headerBtn}
                type="button"
                onClick={() => crosswordRef.current?.checkPuzzle()}
              >
                Check Puzzle
              </button>
              <button
                className={styles.startBtn}
                type="button"
                disabled={!canStart}
                onClick={() => crosswordRef.current?.start()}
              >
                Start
              </button>
            </>
          )}
        </div>
        <Crossword
          ref={crosswordRef}
          onCanStartChange={setCanStart}
          onPuzzleChange={setHasPuzzle}
        />
      </main>
    </div>
  );
}
