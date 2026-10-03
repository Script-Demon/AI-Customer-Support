import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Nimbus Support Desk", template: "%s · Nimbus Support Desk" },
  description: "AI-assisted customer support dashboard with ticketing, RAG knowledge base and analytics.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/40">
        <TooltipProvider>
          <div className="flex min-h-screen flex-col md:flex-row">
            <AppSidebar />
            <main className="min-w-0 flex-1">{children}</main>
          </div>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  )
}
