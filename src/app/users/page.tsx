import UsersDashboard from "./users-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · Docker GUI" };

export default function UsersPage() {
  return <UsersDashboard />;
}
