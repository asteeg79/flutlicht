import { redirect } from "next/navigation";

// Startseite ist /team; ohne Session leitet die Middleware auf /login.
export default function HomePage() {
  redirect("/team");
}
