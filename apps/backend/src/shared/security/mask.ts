export function maskPhone(phone: string) {
  if (phone.length <= 6) return "***";
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

export function maskEmail(email: string) {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return "***";

  const visibleName =
    name.length <= 2 ? `${name.slice(0, 1)}***` : `${name.slice(0, 2)}***`;
  return `${visibleName}@${domain}`;
}
