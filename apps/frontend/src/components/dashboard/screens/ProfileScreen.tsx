import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Copy,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Share2,
  Sprout,
  UserRound,
  Users,
} from "lucide-react";

import { PaddyCoinIcon } from "@/components/PaddyCoinIcon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WalletInfo } from "@/lib/coinApi";

export function ProfileScreen({
  onBack,
  wallet,
}: {
  onBack: () => void;
  wallet?: WalletInfo | null;
}) {
  return (
    <div className="mx-4 space-y-6 sm:mx-0">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <button className="grid size-9 place-items-center" onClick={onBack}>
            <ArrowLeft className="size-7" />
          </button>
          <h2 className="text-[29px] font-extrabold leading-none text-[#071122] sm:text-[31px]">
            My Profile
          </h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-12 rounded-2xl px-4 text-[21px] font-semibold"
        >
          <Edit3 className="size-5" />
          Edit
        </Button>
      </div>

      <Card className="px-6 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="grid size-24 shrink-0 place-items-center rounded-full bg-[#e9efff] text-[#2563eb]">
            <UserRound className="size-12" strokeWidth={2.6} />
          </div>
          <div>
            <h3 className="text-[28px] font-extrabold leading-tight text-[#050b18]">
              Abraham Michael
            </h3>
            <p className="mt-2 flex items-center gap-2 text-[21px] leading-6 text-[#4b5565]">
              <Phone className="size-5" />
              09060402750
            </p>
            <p className="mt-1 flex items-center gap-2 break-all text-[21px] leading-6 text-[#4b5565]">
              <Mail className="size-5 shrink-0" />
              csharpdevelopers334@gmail.com
            </p>
          </div>
        </div>
      </Card>

      <Card className="px-6 py-8">
        <SectionHeading icon={<Building2 className="size-6" />} title="Business Info" />
        <InfoRow label="Name" value="Mikama Services" />
        <InfoRow label="Type" value="Fashion & Clothing" />
      </Card>

      <Card className="px-6 py-8">
        <SectionHeading icon={<MapPin className="size-6" />} title="Location" />
        <p className="mt-5 text-[22px] text-[#374151]">satellite town, Lagos</p>
      </Card>

      <Card className="px-6 py-8">
        <SectionHeading icon={<PaddyCoinIcon className="size-6" />} title="Paddy Coins" />
        <div className="mt-7 grid grid-cols-3 gap-3 text-center">
          <Stat
            value={
              <span className="inline-flex items-center justify-center gap-1.5">
                <PaddyCoinIcon className="size-7" />
                {wallet?.balance ?? 0}
              </span>
            }
            label="Balance"
            color="#f59e0b"
          />
          <Stat
            value={
              <span className="inline-flex items-center justify-center gap-2">
                <Sprout className="size-6 text-[#8cc84b]" />
                {wallet?.levelTitle ?? "Starter"}
              </span>
            }
            label={`Level ${wallet?.level ?? 1}`}
            color="#050b18"
          />
          <Stat value={wallet?.streak ?? 0} label="Day Streak" color="#050b18" />
        </div>
        {wallet && wallet.nextLevelAt !== null && (
          <div className="mt-5 rounded-[14px] bg-[#fffdf3] px-4 py-3">
            <div className="mb-1.5 flex justify-between text-[15px] font-semibold">
              <span className="text-[#64748b]">Next: {nextLevelTitle(wallet.level)}</span>
              <span className="text-[#d57a00]">{wallet.totalEarned} / {wallet.nextLevelAt} coins</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#fde8a9]">
              <div
                className="h-full rounded-full bg-[#f59e0b] transition-all"
                style={{ width: `${Math.min(100, Math.round((wallet.totalEarned / wallet.nextLevelAt) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <Card className="px-6 py-8">
        <SectionHeading icon={<Users className="size-6" />} title="Refer a Friend" />
        <p className="mt-5 text-[19px] leading-7 text-[#334155] sm:text-[20px]">
          Share your link and earn{" "}
          <span className="inline-flex items-center gap-1 font-semibold text-[#d98900]">
            <PaddyCoinIcon className="size-5" />
            50
          </span>{" "}
          Paddy Coins for every friend who signs up!
        </p>
        <div className="mt-4 truncate rounded-[12px] bg-[#f6f8fb] px-5 py-4 text-[21px] text-[#334155]">
          https://smepaddy-production.up.railway.app/login?ref=QXJ5...
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="h-[72px] rounded-[18px] text-[22px] font-semibold"
          >
            <Copy />
            Copy Link
          </Button>
          <Button className="h-[72px] rounded-[18px] text-[22px] font-semibold">
            <Share2 />
            Share
          </Button>
        </div>
        <div className="mt-8 grid grid-cols-3 text-center">
          <Stat value="0" label="Referred" color="#1557df" />
          <Stat value="0" label="Completed" color="#00a76b" />
          <Stat
            value={
              <span className="inline-flex items-center justify-center gap-1.5">
                <PaddyCoinIcon className="size-6" />
                0
              </span>
            }
            label="Coins Earned"
            color="#d98900"
          />
        </div>
      </Card>

      <Card className="px-6 py-8">
        <SectionHeading icon={<CalendarDays className="size-6" />} title="Account" />
        <div className="mt-3 flex items-center justify-between gap-4 text-[22px]">
          <span className="text-[#374151]">Member since</span>
          <span className="font-medium text-[#050b18]">24/04/2026</span>
        </div>
      </Card>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <h3 className="flex items-center gap-3 text-[24px] font-bold text-[#050b18]">
      <span className="text-[#1557df]">{icon}</span>
      {title}
    </h3>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-5 flex items-center justify-between gap-4 text-[22px]">
      <span className="text-[#374151]">{label}</span>
      <span className="text-right font-medium text-[#050b18]">{value}</span>
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <div>
      <p
        style={{ color }}
        className="text-[30px] font-semibold leading-none sm:text-[31px]"
      >
        {value}
      </p>
      <p className="mt-2 text-[18px] text-[#374151] sm:text-[19px]">{label}</p>
    </div>
  );
}

function nextLevelTitle(currentLevel: number): string {
  const titles: Record<number, string> = { 1: "Hustler", 2: "Boss", 3: "Big Boss", 4: "Mogul" };
  return titles[currentLevel] ?? "Mogul";
}
