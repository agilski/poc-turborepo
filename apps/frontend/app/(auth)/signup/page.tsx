"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerUseCase, AppError } from "@/src/auth";
import styles from "./signup.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      await registerUseCase.execute({
        email: formData.get("email") as string,
        password: formData.get("password") as string,
        name: (formData.get("name") as string) || undefined,
      });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sign Up</h1>
        <p className={styles.subtitle}>Create your account to get started</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">
            Name (optional)
          </label>
          <input
            className={styles.input}
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            placeholder="Min 8 characters"
            minLength={8}
            required
          />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
      <p className={styles.link}>
        Already have an account? <a href="/signin">Sign in</a>
      </p>
    </div>
  );
}
