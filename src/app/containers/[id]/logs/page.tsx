import LiveLogsView from "./live-logs-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live logs · Docker GUI" };

export default function LiveLogsPage({ params }: { params: { id: string } }) {
  return <LiveLogsView containerId={params.id} />;
}
