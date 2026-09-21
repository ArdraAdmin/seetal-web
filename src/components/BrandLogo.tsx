import Image from "next/image";

const SIZES = {
  sm: { className: "h-10 w-10", width: 80, height: 80 },
  md: { className: "h-14 w-14", width: 112, height: 112 },
  lg: { className: "h-20 w-20 sm:h-24 sm:w-24", width: 192, height: 192 },
} as const;

export function BrandLogo({
  size = "md",
  priority = false,
  className = "",
}: {
  size?: keyof typeof SIZES;
  priority?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <Image
      src="/brand/seetal-logo.png"
      alt="Seetal"
      width={s.width}
      height={s.height}
      priority={priority}
      className={`${s.className} rounded-full object-cover ${className}`}
    />
  );
}
