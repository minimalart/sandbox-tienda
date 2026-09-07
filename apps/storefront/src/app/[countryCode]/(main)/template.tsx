"use client"

import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (children !== displayChildren) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setDisplayChildren(children)
        setIsAnimating(false)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [children, displayChildren])

  return (
    <div
      className={`transition-opacity duration-150 ease-in-out ${
        isAnimating ? "opacity-0" : "opacity-100"
      }`}
      style={{
        animation: isAnimating ? "none" : "fadeSlideIn 0.3s ease-out"
      }}
    >
      {displayChildren}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

