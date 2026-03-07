export type UserWithoutPassword = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithPassword = UserWithoutPassword & {
  password: string;
};
