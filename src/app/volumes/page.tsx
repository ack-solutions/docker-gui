import VolumesDashboard from "./volumes-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Volumes · Docker GUI" };

export default function VolumesPage() {
  return <VolumesDashboard />;
}
