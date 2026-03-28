import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
    title: "Adrian Santos | Personal Trainer",
    description: "Disciplina. Consistência. Alta Performance. Acompanhamento profissional para transformação física e mental.",
    keywords: ["personal trainer", "fitness", "treino personalizado", "dieta", "alta performance", "Adrian Santos"],
    authors: [{ name: "Adrian Santos Personal Trainer" }],
    manifest: "/manifest.webmanifest",
    icons: {
        icon: "/favicon.svg",
        apple: "/icon.svg",
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: "black",
        title: "Adrian FIT",
    },
    formatDetection: {
        telephone: false,
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#F88022" },
        { media: "(prefers-color-scheme: dark)", color: "#000000" },
    ],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" className="dark" suppressHydrationWarning>
            <body className="antialiased">
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
