import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUpPage from "./page";
import { registerUseCase } from "@/src/auth";
import { AppError } from "@/src/shared/domain/errors";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/src/auth", async () => {
  const { AppError } = await import("@/src/shared/domain/errors");
  return {
    registerUseCase: { execute: vi.fn() },
    AppError,
  };
});

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fillAndSubmit = async (email: string, password: string, name?: string) => {
    const user = userEvent.setup();
    render(<SignUpPage />);
    if (name) await user.type(screen.getByLabelText(/name/i), name);
    await user.type(screen.getByLabelText(/email/i), email);
    await user.type(screen.getByLabelText(/password/i), password);
    await user.click(screen.getByRole("button", { name: /sign up/i }));
  };

  it("renders the sign up form", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("redirects to /dashboard on successful registration", async () => {
    vi.mocked(registerUseCase.execute).mockResolvedValue(undefined);

    await fillAndSubmit("a@b.com", "password123", "Alice");

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("displays error message when registration fails with AppError", async () => {
    vi.mocked(registerUseCase.execute).mockRejectedValue(
      new AppError("Email already registered", "EMAIL_ALREADY_REGISTERED")
    );

    await fillAndSubmit("a@b.com", "password123");

    await waitFor(() => expect(screen.getByText("Email already registered")).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("displays fallback error message for unexpected errors", async () => {
    vi.mocked(registerUseCase.execute).mockRejectedValue(new Error("unexpected"));

    await fillAndSubmit("a@b.com", "password123");

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
  });
});
