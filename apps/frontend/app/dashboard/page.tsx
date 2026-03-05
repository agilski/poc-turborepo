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
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Dashboard</h1>
        {email && <p className={styles.email}>{email}</p>}
        <button className={styles.logoutButton} onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
