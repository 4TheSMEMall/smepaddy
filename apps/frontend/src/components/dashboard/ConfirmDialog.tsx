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
      className="fixed inset-0 z-40 grid place-items-end bg-black/50 px-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] sm:place-items-center sm:px-4 sm:pb-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.98, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-[520px] rounded-[24px] bg-white px-5 py-6 shadow-[0_20px_50px_rgba(15,23,42,0.22)] sm:px-7 sm:py-8"
      >
        <h2 className="mb-2 text-[22px] font-extrabold text-[#071122] sm:text-[25px]">Discard saved draft?</h2>
        <p className="mb-6 text-[16px] leading-6 text-[#435064] sm:text-[18px]">
          Your typed input will be cleared. This cannot be undone - you will need
          to re-enter the values if you change your mind.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" className="h-12 rounded-[14px] text-[16px]" onClick={onClose}>
            Keep
          </Button>
          <Button className="h-12 rounded-[14px] text-[16px]" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
