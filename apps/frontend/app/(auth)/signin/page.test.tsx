import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignInPage from "./page";
import { loginUseCase } from "@/src/auth";
import { AppError } from "@/src/shared/domain/errors";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/src/auth", async () => {
  const { AppError } = await import("@/src/shared/domain/errors");
  return {
    loginUseCase: { execute: vi.fn() },
    AppError,
  };
});

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fillAndSubmit = async (email: string, password: string) => {
    const user = userEvent.setup();
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), email);
    await user.type(screen.getByLabelText(/password/i), password);
    await user.click(screen.getByRole("button", { name: /sign in/i }));
  };

  it("renders the sign in form", () => {
    render(<SignInPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("redirects to /dashboard on successful login", async () => {
    vi.mocked(loginUseCase.execute).mockResolvedValue(undefined);

    await fillAndSubmit("a@b.com", "secret");

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
  });

  it("displays error message when login fails with AppError", async () => {
    vi.mocked(loginUseCase.execute).mockRejectedValue(new AppError("Invalid credentials", "AUTH_ERROR"));

    await fillAndSubmit("a@b.com", "wrong");

    await waitFor(() => expect(screen.getByText("Invalid credentials")).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("displays fallback error message for unexpected errors", async () => {
    vi.mocked(loginUseCase.execute).mockRejectedValue(new Error("unexpected"));

    await fillAndSubmit("a@b.com", "secret");

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
  });
});
