import React, { useEffect, useRef, useState, useCallback } from 'react'
import { interpolate } from 'flubber'

interface MorphingLoaderProps {
  size?: number
  color?: string
  duration?: number
  loop?: boolean
  pauseMs?: number
}

// All subpaths normalized: CW winding, start at topmost point, padded to 5 subpaths each.
// Traced from reference icons via potrace, coordinates in 100x100 viewBox.

const DOT =
  'M 50,50 C 50,50 50,50 50,50 C 50,50 50,50 50,50 C 50,50 50,50 50,50 C 50,50 50,50 50,50 Z'

const DIFFUSER_SUBS = [
  'M 49.5,62.33 L 51.5,62.33 L 52.2,65.8 C 54.2,74.58 57.5,83.89 60.5,89.59 C 60.8,90.34 60.82,90.43 60.5,90.91 C 59.9,91.95 56.5,93.7 55.5,93.36 C 55.1,93.2 54.2,89.46 53.2,84.37 C 52.9,82.67 52.6,81.85 52.8,83.1 C 52.85,83.48 52.95,86.03 53.05,88.77 C 53.2,93.68 53.2,93.75 52.85,94.13 C 52.5,94.47 50.5,95.06 49.8,94.99 C 49.65,94.97 49.2,94.88 48.7,94.77 C 46.8,94.45 46.9,94.77 47.15,88.89 C 47.45,82.28 47.43,82.21 46.8,85.26 C 46.5,86.69 45.9,89.09 45.5,90.59 L 44.8,93.31 L 43.9,93.29 C 43.0,93.25 40.8,92.29 39.9,91.59 C 39.2,91.02 39.1,90.54 39.5,89.7 C 42.5,83.26 45.5,75.15 47.8,66.37 L 48.8,62.33 L 49.5,62.33 Z',
  'M 50.29,50.75 L 57.96,50.75 L 58.53,51.31 C 59.1,51.88 59.1,51.88 59.01,55.65 C 58.92,59.01 58.87,59.49 58.51,59.76 C 57.83,60.24 42.8,60.19 42.09,59.69 C 41.32,59.15 41.32,51.66 42.09,51.11 C 42.52,50.79 43.7,50.75 50.29,50.75 Z',
  'M 50.02,5.0 L 66.04,5.0 L 67.13,5.68 C 67.88,6.14 68.41,6.68 68.75,7.39 L 69.27,8.41 L 69.29,26.71 L 69.29,45.0 L 68.77,46.0 C 68.47,46.55 67.79,47.32 67.27,47.68 L 66.29,48.36 L 50.38,48.41 C 36.51,48.45 34.33,48.41 33.65,48.11 C 32.6,47.66 31.9,46.98 31.31,45.87 C 30.81,44.96 30.81,44.87 30.74,27.36 C 30.65,8.32 30.67,8.07 31.85,6.64 C 33.28,4.89 32.1,5.0 50.02,5.0 Z',
  DOT,
  DOT,
]

const AEROSOL_SUBS = [
  'M 50.69,80.46 L 59.74,80.41 L 59.74,86.57 C 59.74,95.42 60.24,94.95 51.06,95.0 C 46.73,95.02 44.36,94.95 43.78,94.75 C 41.63,94.02 41.43,93.27 41.53,86.17 L 41.61,80.54 L 50.69,80.46 Z',
  'M 54.24,88.17 C 56.14,88.17 57.09,90.37 55.76,91.69 C 54.29,93.14 51.99,92.22 51.99,90.17 C 51.99,89.34 53.31,88.17 54.24,88.17 Z',
  'M 50.39,70.68 L 67.54,70.68 L 67.37,71.36 C 66.59,74.43 64.39,76.64 61.02,77.66 C 59.34,78.19 44.48,78.36 40.93,77.91 C 39.03,77.66 36.88,76.59 35.5,75.19 C 34.43,74.06 32.88,71.28 33.13,70.88 C 33.18,70.76 40.96,70.68 50.39,70.68 Z',
  'M 50.14,5.0 L 64.89,5.0 L 66.37,5.75 C 67.29,6.23 68.17,6.9 68.67,7.58 C 70.32,9.75 70.25,8.35 70.25,38.84 L 70.25,66.46 L 69.27,67.43 L 68.29,68.41 L 50.21,68.38 C 40.26,68.38 31.88,68.28 31.6,68.16 C 31.33,68.06 30.83,67.66 30.48,67.28 L 29.85,66.61 L 29.78,38.77 C 29.73,11.45 29.73,10.88 30.23,9.58 C 30.85,7.9 32.2,6.48 33.98,5.65 L 35.35,5.0 L 50.14,5.0 Z',
  DOT,
]

const SPRAY_SUBS = [
  'M 45.22,79.08 C 50.41,79.08 50.34,79.06 51.57,80.97 C 53.46,83.91 57.27,85.71 62.22,85.95 C 66.93,86.16 67.19,86.4 67.19,90.28 C 67.19,93.24 66.89,94.09 65.66,94.61 C 64.21,95.2 33.48,95.09 32.46,94.47 C 31.54,93.9 31.2,92.88 31.2,90.45 C 31.2,87.25 31.87,86.18 34.61,84.88 C 36.03,84.22 38.21,82.06 38.88,80.64 C 39.56,79.2 40.06,79.08 45.22,79.08 Z',
  'M 68.38,70.32 C 69.04,70.98 69.02,71.08 67.55,72.78 C 65.23,75.53 64.14,77.56 62.7,81.8 L 62.06,83.7 L 61.01,83.74 C 60.45,83.77 59.88,83.74 59.74,83.7 C 59.62,83.67 58.91,83.44 58.2,83.22 C 57.49,83.01 56.54,82.56 56.11,82.23 L 55.31,81.64 L 56.37,80.52 C 56.94,79.93 57.94,78.54 58.58,77.42 C 61.13,73.02 66.89,68.83 68.38,70.32 Z',
  'M 49.15,5.01 C 56.21,4.97 61.09,5.04 61.89,5.18 C 64.47,5.68 66.08,6.89 67.17,9.21 L 67.79,10.53 L 67.86,26.4 C 67.93,43.35 67.86,45.05 66.82,49.13 C 65.51,54.15 63.03,58.34 58.62,62.88 C 54.91,66.72 54.88,66.72 54.88,72.09 C 54.88,75.1 54.79,76.48 54.6,76.66 C 54.17,77.09 39.89,77.07 39.54,76.66 C 39.4,76.48 39.25,74.37 39.21,71.5 C 39.14,66.01 39.07,65.8 36.67,62.03 C 32.27,55.14 32.1,53.79 32.2,28.53 L 32.27,10.53 L 32.86,9.35 C 33.67,7.69 35.02,6.29 36.48,5.65 L 37.72,5.09 L 49.15,5.01 Z',
  DOT,
  DOT,
]

const BURNER_SUBS = [
  'M 49.73,5.0 C 78.3,4.97 87.5,7.53 91.9,16.69 C 97.68,28.81 94.72,44.84 83.2,63.76 C 79.12,70.42 78.5,71.64 78.01,73.48 C 77.05,77.25 78.2,79.42 83.56,83.89 C 92.06,90.95 89.6,92.89 70.09,94.46 C 65.79,94.83 42.5,95.15 37.58,94.92 C 18.46,94.07 11.47,92.56 11.47,89.24 C 11.47,88.45 12.35,87.5 18.0,82.15 C 22.9,77.52 22.86,74.96 17.74,66.55 C 5.36,46.32 2.11,29.34 8.25,16.63 C 9.86,13.28 13.57,9.76 16.69,8.65 C 23.91,5.99 32.75,5.0 49.73,5.0 Z',
  'M 68.94,86.94 C 78.63,87.63 86.38,89.37 83.92,90.29 C 83.62,90.42 79.09,90.33 73.8,90.16 C 67.89,89.93 56.1,89.87 43.32,90.0 C 31.86,90.1 20.99,90.29 19.18,90.39 C 17.38,90.49 15.8,90.49 15.67,90.33 C 12.75,87.37 45.46,85.27 68.94,86.94 Z',
  'M 57.45,14.33 C 72.59,15.71 79.35,21.16 79.22,31.93 C 79.09,43.0 67.99,57.15 55.11,62.64 C 49.1,65.2 43.85,63.69 35.61,56.99 C 22.9,46.68 17.87,33.74 22.63,23.69 C 26.11,16.36 39.81,12.69 57.45,14.33 Z',
  'M 39.38,25.26 C 33.18,24.64 27.53,23.13 27.07,21.95 C 25.1,16.79 66.68,15.51 72.32,20.53 C 73.97,22.05 73.08,22.87 68.48,24.05 C 63.88,25.23 46.38,25.99 39.38,25.26 Z',
  DOT,
]

const SHAPES = [DIFFUSER_SUBS, AEROSOL_SUBS, SPRAY_SUBS, BURNER_SUBS]
const MAX_SUBPATHS = 5

const MorphingLoader: React.FC<MorphingLoaderProps> = ({
  size = 64,
  color = 'hsl(var(--foreground))',
  duration = 1.2,
  loop = true,
  pauseMs = 500,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const animationRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const animateMorph = useCallback(
    (fromIndex: number, toIndex: number) => {
      const fromSubs = SHAPES[fromIndex]
      const toSubs = SHAPES[toIndex]

      const interpolators = fromSubs.map((fromPath, i) =>
        interpolate(fromPath, toSubs[i], { maxSegmentLength: 2 }),
      )

      const startTime = performance.now()
      const durationMs = duration * 1000

      const tick = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(elapsed / durationMs, 1)
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

        for (let i = 0; i < interpolators.length; i++) {
          const el = pathRefs.current[i]
          if (el) {
            el.setAttribute('d', interpolators[i](eased))
          }
        }

        if (t < 1) {
          animationRef.current = requestAnimationFrame(tick)
        } else {
          timeoutRef.current = setTimeout(() => {
            setCurrentIndex(toIndex)
          }, pauseMs)
        }
      }

      animationRef.current = requestAnimationFrame(tick)
    },
    [duration, pauseMs],
  )

  useEffect(() => {
    if (!loop && currentIndex >= SHAPES.length - 1) {
      return
    }

    const nextIndex = loop
      ? (currentIndex + 1) % SHAPES.length
      : currentIndex + 1

    animateMorph(currentIndex, nextIndex)

    return () => {
      cancelAnimationFrame(animationRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [currentIndex, animateMorph, loop])

  return (
    <div className='flex flex-col items-center justify-center gap-4'>
      <div
        className='flex items-center justify-center'
        style={{ width: size, height: size }}
      >
        <svg
          viewBox='0 0 100 100'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
          style={{ width: '100%', height: '100%' }}
        >
          <g transform='scale(1, -1) translate(0, -100)'>
            {Array.from({ length: MAX_SUBPATHS }).map((_, i) => (
              <path
                key={i}
                ref={(el) => {
                  pathRefs.current[i] = el
                }}
                d={SHAPES[0][i]}
                fill={color}
                fillRule='evenodd'
              />
            ))}
          </g>
        </svg>
      </div>
      <div
        className='text-center'
        style={{
          fontFamily: 'var(--font-roboto), Roboto, sans-serif',
          fontWeight: 'bold',
          color: '#2e7d32',
          opacity: 0.5,
        }}
      >
        <span>Cargando</span>
        <span className='dots'>
          <span className='dot' style={{ animationDelay: '0s' }}>
            .
          </span>
          <span className='dot' style={{ animationDelay: '0.2s' }}>
            .
          </span>
          <span className='dot' style={{ animationDelay: '0.4s' }}>
            .
          </span>
        </span>
        <style jsx>{`
          @keyframes bounce-dot {
            0%,
            60%,
            100% {
              transform: translateY(0);
            }
            30% {
              transform: translateY(-4px);
            }
          }
          .dot {
            display: inline-block;
            animation: bounce-dot 1.4s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  )
}

export default MorphingLoader
