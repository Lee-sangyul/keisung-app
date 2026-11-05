import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "계성 스마트 | Keisung App", description: "학교생활을 더 편리하게 만드는 계성 스마트 개발 버전", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#173f85", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ko"><body>{children}</body></html>; }
