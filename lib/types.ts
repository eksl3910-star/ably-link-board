export type LinkDoc = {
  url: string;
  title: string;
  image: string | null;
  domain: string;
  status: "pending" | "consumed";
  createdBy: string;
  createdAt: number;
};
