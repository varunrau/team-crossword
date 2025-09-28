"use client";

import { useRef } from "react";
import styles from "./page.module.css";
import Crossword, { type CrosswordHandle } from "@/components/Crossword/Crossword";

export default function Home() {
  const crosswordRef = useRef<CrosswordHandle>(null);
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.headerRow}>
          <h1>Team Crossword</h1>
          <button
            className={styles.headerBtn}
            type="button"
            onClick={() => crosswordRef.current?.checkPuzzle()}
          >
            Check Puzzle
          </button>
        </div>
        <Crossword ref={crosswordRef} />
      </main>
    </div>
  );
}
