import { getJson } from "@/lib/api";

export type CurrentAccountResponse = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    phone: string | null;
    status: string;
  };
  business: {
    id: string;
    businessName: string;
    businessType: string;
    location: string | null;
  } | null;
};

export function getCurrentAccount(token: string) {
  return getJson<CurrentAccountResponse>("/me", token);
}
