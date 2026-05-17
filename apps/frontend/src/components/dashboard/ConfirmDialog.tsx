"use client";

import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  onClose,
  onDiscard,
}: {
  onClose: () => void;
  onDiscard: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-center bg-black/50 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-[768px] rounded-[24px] bg-white px-9 py-10 shadow-[0_2px_8px_rgba(15,23,42,0.22)]"
      >
        <h2 className="mb-3 text-[27px] font-extrabold">Discard saved draft?</h2>
        <p className="mb-7 text-[23px] leading-8 text-[#435064]">
          Your typed input will be cleared. This cannot be undone - you will need
          to re-enter the values if you change your mind.
        </p>
        <div className="grid grid-cols-2 gap-5">
          <Button variant="secondary" className="h-[72px] rounded-[18px]" onClick={onClose}>
            Keep
          </Button>
          <Button className="h-[72px] rounded-[18px]" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
