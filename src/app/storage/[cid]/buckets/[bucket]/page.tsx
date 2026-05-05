import BucketDetailView from "./bucket-detail-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bucket · Docker GUI" };

export default function BucketDetailPage({
  params
}: {
  params: { cid: string; bucket: string };
}) {
  return <BucketDetailView connectionId={params.cid} bucket={decodeURIComponent(params.bucket)} />;
}
