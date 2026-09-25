import type { ReactNode } from "react";

export const metadata = {
  title: "Fußballmanager",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
