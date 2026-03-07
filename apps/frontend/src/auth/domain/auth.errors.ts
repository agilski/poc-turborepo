import { AppError } from "@/src/shared/domain/errors";

export class InvalidCredentialsError extends AppError {
  constructor(message = "Invalid credentials") {
    super(message, "INVALID_CREDENTIALS");
  }
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor(message = "Email already registered") {
    super(message, "EMAIL_ALREADY_REGISTERED");
  }
}

export class NotAuthenticatedError extends AppError {
  constructor() {
    super("Not authenticated", "NOT_AUTHENTICATED");
  }
}

export class AuthServiceUnavailableError extends AppError {
  constructor() {
    super("Something went wrong", "AUTH_SERVICE_UNAVAILABLE");
  }
}
