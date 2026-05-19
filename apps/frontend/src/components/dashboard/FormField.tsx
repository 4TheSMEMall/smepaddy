export function FormField({ label, value }: { label: string; value: string }) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-[16px] font-semibold text-[#071122] sm:mb-3 sm:text-[25px]">{label}</span>
      <input
        className="h-14 w-full rounded-[14px] border border-[#cfd7e2] bg-white px-4 text-[16px] text-[#27364a] outline-none focus:border-[#1557df] focus:ring-2 focus:ring-[#d7e4ff] sm:h-[72px] sm:rounded-[11px] sm:px-5 sm:text-[24px]"
        defaultValue={value}
      />
    </label>
  );
}
