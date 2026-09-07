"use client";

import { motion, useInView } from "framer-motion";
import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type RevealProps = Omit<HTMLAttributes<HTMLElement>, "onDrag" | "onDragStart" | "onDragEnd"> & {
  as?: string;
  delay?: number;
  once?: boolean;
  children: ReactNode;
};

const Reveal = ({
  as = "div",
  children,
  delay = 0,
  once = true,
  className,
  ...rest
}: RevealProps) => {
  const Tag = as;
  const MotionComponent = motion.create(Tag);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  // Filtrar props que no son compatibles con framer-motion
  const { onDrag, onDragStart, onDragEnd, ...motionProps } = rest as any;

  const animateValue: { opacity: number; y: number } = hasAnimated ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 };
  const initialValue: { opacity: number; y: number } = { opacity: 0, y: 24 };

  // Usar as any para evitar problemas de inferencia de tipos complejos con motion(Tag)
  const MotionComponentAny = MotionComponent as any;

  return (
    <MotionComponentAny
      animate={animateValue}
      className={className}
      initial={initialValue}
      ref={ref}
      transition={{ duration: 0.42, delay: delay / 1000, ease: "easeOut" }}
      {...motionProps}
    >
      {children}
    </MotionComponentAny>
  );
};

export default Reveal;
