import { redirect } from "next/navigation";

/**
 * Root route. Skeleton behavior: redirect to /login.
 * TODO(Wave 2): redirect to /dashboard when an authenticated session exists.
 */
export default function HomePage(): never {
  redirect("/login");
}
