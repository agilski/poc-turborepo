"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => setEmail(data.email))
      .catch(() => router.push("/signin"));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <span className={styles.brand}>
            <span className={styles.brandMark}>&#10022;</span>
            App
          </span>
          <button className={styles.logoutButton} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Welcome to your workspace</p>
          {email && <p className={styles.email}>{email}</p>}
        </div>
      </main>
    </div>
  );
}
