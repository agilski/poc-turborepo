export type Credentials = {
  email: string;
  password: string;
};

export type RegisterData = Credentials & {
  name?: string;
};
