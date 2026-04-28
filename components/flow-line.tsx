"use client"

import { useEffect, useRef, useState } from "react"

export function FlowLine() {
  const [scrollProgress, setScrollProgress] = useState(0)
  const pathRef = useRef<SVGPathElement>(null)
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = window.scrollY / scrollHeight
      setScrollProgress(progress)
    }
    
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-0">
      <svg
        className="absolute top-0 left-0 w-full"
        style={{ height: "100%" }}
        viewBox="0 0 1000 5000"
        preserveAspectRatio="xMidYMin slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradient for the line */}
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00C853" stopOpacity="0.05" />
            <stop offset="10%" stopColor="#00C853" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#00E676" stopOpacity="0.2" />
            <stop offset="90%" stopColor="#00C853" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00C853" stopOpacity="0.05" />
          </linearGradient>
          
          {/* Subtle glow filter */}
          <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Traveling pulse gradient */}
          <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop 
              offset={`${Math.max(0, scrollProgress * 100 - 5)}%`} 
              stopColor="#00C853" 
              stopOpacity="0" 
            />
            <stop 
              offset={`${scrollProgress * 100}%`} 
              stopColor="#00E676" 
              stopOpacity="0.5" 
            />
            <stop 
              offset={`${Math.min(100, scrollProgress * 100 + 5)}%`} 
              stopColor="#00C853" 
              stopOpacity="0" 
            />
          </linearGradient>
        </defs>
        
        {/* Single continuous flowing path */}
        <path
          ref={pathRef}
          d="M 500 0
             C 600 200, 750 300, 700 500
             S 300 700, 350 900
             C 400 1100, 650 1200, 600 1400
             S 250 1600, 300 1800
             C 350 2000, 700 2100, 650 2300
             S 300 2500, 350 2700
             C 400 2900, 650 3000, 600 3200
             S 250 3400, 300 3600
             C 350 3800, 700 3900, 650 4100
             S 350 4300, 400 4500
             C 450 4700, 550 4800, 500 5000"
          stroke="url(#lineGradient)"
          strokeWidth="1.5"
          fill="none"
          filter="url(#softGlow)"
          strokeLinecap="round"
        />
        
        {/* Pulse overlay that follows scroll */}
        <path
          d="M 500 0
             C 600 200, 750 300, 700 500
             S 300 700, 350 900
             C 400 1100, 650 1200, 600 1400
             S 250 1600, 300 1800
             C 350 2000, 700 2100, 650 2300
             S 300 2500, 350 2700
             C 400 2900, 650 3000, 600 3200
             S 250 3400, 300 3600
             C 350 3800, 700 3900, 650 4100
             S 350 4300, 400 4500
             C 450 4700, 550 4800, 500 5000"
          stroke="url(#pulseGradient)"
          strokeWidth="2"
          fill="none"
          filter="url(#softGlow)"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
