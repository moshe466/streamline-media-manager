
import { StreamActions } from '@/components/dashboard/stream-actions';
import { getStreams } from '@/services/flussonic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminStreamsPage() {
    let streams: Awaited<ReturnType<typeof getStreams>> = [];
    let error: string | null = null;
    try {
        streams = await getStreams();
    } catch (e) {
        console.error("Failed to fetch streams for admin page:", e);
        error = e instanceof Error ? e.message : "An unknown error occurred while fetching streams.";
    }

    return <StreamActions streams={streams} error={error} userType="admin" />;
}
