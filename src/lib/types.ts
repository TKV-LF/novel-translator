export type SessionUser = {
  id: string;
  username: string;
};

export type SessionData = {
  user?: SessionUser;
  isLoggedIn: boolean;
  expiresAt?: number;
};

export type GenreKey =
  | "kiem_hiep"
  | "tu_tien"
  | "do_thi"
  | "ngon_tinh"
  | "huyen_huyen"
  | "lich_su"
  | "quan_su";

export const GENRES: { key: GenreKey; label: string }[] = [
  { key: "kiem_hiep", label: "Kiếm Hiệp" },
  { key: "tu_tien", label: "Tu Tiên" },
  { key: "do_thi", label: "Đô Thị" },
  { key: "ngon_tinh", label: "Ngôn Tình" },
  { key: "huyen_huyen", label: "Huyền Huyễn" },
  { key: "lich_su", label: "Lịch Sử" },
  { key: "quan_su", label: "Quân sự" },
];
