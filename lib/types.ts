export type Role = "admin" | "user";

export type TransferType =
  | "text"
  | "clipboard"
  | "image"
  | "video"
  | "file"
  | "folder";

export type RecipientStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "downloaded"
  | "expired";

export type Person = {
  id: string;
  displayName: string;
  online: boolean;
  favorite: boolean;
  isAdmin: boolean;
  avatarUpdatedAt: string | null;
};

export type TransferItem = {
  id: string;
  type: TransferType;
  title: string | null;
  text: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  status: "uploading" | "ready" | "failed";
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  senderId: string;
  senderName: string;
  senderAvatarUpdatedAt: string | null;
  myStatus: RecipientStatus | null;
  recipients: { id: string; displayName: string; status: RecipientStatus }[];
};

export type Me = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  autoAccept: "none" | "favs" | "all";
  avatarUpdatedAt: string | null;
};

export type StorageInfo = {
  used: number;
  limit: number;
  warn: number;
  free: number;
  percent: number;
};

export type AdminAlert = {
  id: string;
  kind: string;
  message: string;
  createdAt: string;
};

export type AppState = {
  me: Me;
  people: Person[];
  incoming: TransferItem[];
  sent: TransferItem[];
  pendingCount: number;
  storage: StorageInfo;
  adminAlerts: AdminAlert[];
};
