import { getJson, patchJson } from "@/lib/api";

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
    createdAt: string;
  } | null;
};

export function getCurrentAccount(token: string) {
  return getJson<CurrentAccountResponse>("/me", token);
}

export function updateBusiness(
  token: string,
  data: { businessName: string; businessType: string; location?: string },
) {
  return patchJson<{ business: NonNullable<CurrentAccountResponse["business"]> }>(
    "/business",
    data as Record<string, unknown>,
    token,
  );
}
