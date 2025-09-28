import styles from "./page.module.css";
import Crossword from "@/components/Crossword/Crossword";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Team Crossword</h1>
        <p>Upload a .puz file to view and solve.</p>
        <Crossword />
      </main>
    </div>
  );
}
