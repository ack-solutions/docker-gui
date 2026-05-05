import BucketsView from "./buckets-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buckets · Docker GUI" };

export default function BucketsPage({ params }: { params: { cid: string } }) {
  return <BucketsView connectionId={params.cid} />;
}
