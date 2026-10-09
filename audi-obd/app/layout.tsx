import "./globals.css";
export const metadata = { title: "TT Coder", description: "OBD coding for the 2020 Audi TT 8S" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0d10" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
