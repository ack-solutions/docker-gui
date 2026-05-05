import TerminalView from "./terminal-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Terminal · Docker GUI" };

export default function TerminalPage({ params }: { params: { id: string } }) {
  return <TerminalView containerId={params.id} />;
}
