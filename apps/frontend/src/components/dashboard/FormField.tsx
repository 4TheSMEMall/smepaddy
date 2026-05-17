export function FormField({ label, value }: { label: string; value: string }) {
  return (
    <label className="mb-5 block">
      <span className="mb-3 block text-[25px] font-semibold">{label}</span>
      <input
        className="h-[72px] w-full rounded-[11px] border border-[#cfd7e2] bg-transparent px-5 text-[24px] text-[#27364a] outline-none"
        defaultValue={value}
      />
    </label>
  );
}
