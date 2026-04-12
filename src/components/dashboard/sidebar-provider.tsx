"use client"

import * as React from "react"
import {
  SidebarProvider as BaseSidebarProvider,
} from "@/components/ui/sidebar"

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!open)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <BaseSidebarProvider open={open} onOpenChange={setOpen} defaultOpen={true}>
        {children}
    </BaseSidebarProvider>
  )
}
