import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export type UserPayload = {
  id: string;
  phone_e164_norm: string;
  nickname: string | null;
};

export function signAccess(user: UserPayload) {
  return jwt.sign({ sub: user.id, user }, SECRET, { expiresIn: "30m" });
}

export function verifyAccess(token: string): { user: UserPayload } {
  return jwt.verify(token, SECRET) as any;
}
