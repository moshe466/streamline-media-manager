import { NextResponse } from 'next/server';
import { getStreams } from '@/services/flussonic';
import { getClientById } from '@/services/clients';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const clientId = body.clientId as string | undefined;
    const fallbackSelectedStreams = Array.isArray(body.selectedStreams) ? body.selectedStreams : [];
    const fallbackGridColumns = Number(body.gridColumns || 2);

    if (!clientId) {
      return NextResponse.json({
        ok: true,
        onlineStreams: [],
        gridColumns: fallbackGridColumns,
      });
    }

    const [client, allStreams] = await Promise.all([
      getClientById(clientId),
      getStreams().catch(() => []),
    ]);

    if (!client) {
      return NextResponse.json({
        ok: false,
        onlineStreams: [],
        gridColumns: fallbackGridColumns,
        error: 'client_not_found',
      });
    }

    const currentSettings = client.multiviewSettings;
    const selectedStreams =
      currentSettings?.selectedStreams?.length
        ? currentSettings.selectedStreams
        : fallbackSelectedStreams;

    const gridColumns = currentSettings?.gridColumns || fallbackGridColumns;

    const allowedStreams = client.permissions?.hasAllStreamsAccess
      ? selectedStreams
      : selectedStreams.filter((name: string) =>
          Object.keys(client.permissions?.allowedStreams || {}).includes(name)
        );

    const onlineStreams = allowedStreams.filter((name: string) =>
      allStreams.some((stream: any) => stream.name === name && stream.status === 'online')
    );

    return NextResponse.json({
      ok: true,
      onlineStreams,
      gridColumns,
      checkedAt: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, onlineStreams: [], error: (error as Error).message },
      { status: 500 }
    );
  }
}
