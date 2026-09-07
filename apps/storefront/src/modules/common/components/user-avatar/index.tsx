"use client";

import { cn } from "@lib/util/cn";
import { useState } from "react";

// Avatar circular con fallback a iniciales. Cada instancia tiene su propio
// estado de error: si la URL muere (objeto borrado en S3, metadata huérfano),
// onError nos lleva a las iniciales en vez de mostrar el ícono roto del navegador.
type UserAvatarProps = {
  avatarUrl?: string;
  initials: string;
  alt: string;
  size: number;
  className?: string;
};

const UserAvatar = ({
  avatarUrl,
  initials,
  alt,
  size,
  className,
}: UserAvatarProps) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (avatarUrl && !imgFailed) {
    return (
      <img
        alt={alt}
        className={cn("shrink-0 rounded-full object-cover", className)}
        height={size}
        onError={() => setImgFailed(true)}
        src={avatarUrl}
        style={{ width: size, height: size }}
        width={size}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[--mc-green-soft] font-semibold text-[--primary-color]",
        className
      )}
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;
