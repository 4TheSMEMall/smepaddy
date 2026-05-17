"use client";

import { ArrowLeft } from "lucide-react";

import { SupplierForm } from "@/components/dashboard/suppliers/SupplierForm";

export function AddSupplierScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: () => void;
}) {
  return (
    <div className="mx-4 sm:mx-0">
      <div className="mb-6 flex items-center gap-10">
        <button className="grid size-9 place-items-center" onClick={onBack}>
          <ArrowLeft className="size-7" />
        </button>
        <h2 className="text-[31px] font-extrabold text-[#071122]">
          Add Supplier
        </h2>
      </div>
      <SupplierForm onCreated={onCreated} onCancel={onBack} />
    </div>
  );
}
