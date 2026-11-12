export interface BaseEntity {
  id: number;
  createdAt: Date;
  createdById: number | null;
  updatedAt: Date;
  updatedById: number | null;
  deletedAt: Date | null;
  deletedById: number | null;
}
export type ActionState = { error?: string };
export type Search = Promise<Record<string, string | string[] | undefined>>;
