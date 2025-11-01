export type User = {
  id: string;
  name: string;
  email?: string;
};

export type Post = {
  id: string;
  title: string;
  body: string;
  votes: number;
  createdAt: string;
  createdBy: User;
};
