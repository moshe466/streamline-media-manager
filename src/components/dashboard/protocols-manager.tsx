'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StreamDetails, ProtocolOptions } from '@/services/flussonic-types';

interface ProtocolsManagerProps {
  streamDetails: StreamDetails | null;
  protocols: ProtocolOptions;
  permissions: {
    canManageProtocols: boolean;
  } | null;
  onProtocolsChange: (updated: ProtocolOptions) => void;
  showAllProtocols?: boolean;
  allowProtocolToggle?: boolean;
}

export function ProtocolsManager({ 
  streamDetails, 
  protocols, 
  permissions, 
  onProtocolsChange,
  showAllProtocols = false,
  allowProtocolToggle = false,
}: ProtocolsManagerProps) {
  if (!permissions?.canManageProtocols) return null;

  const availableProtocols = [
    'hls', 'rtmp', 'srt', 'webrtc', 'dash', 'jpeg', 'mss', 'api', 'm4f', 'm4s', 'mseld', 'shoutcast', 'tshttp', 'cmaf', 'player', 'whitelist', 'rtsp'
  ];
  
  const activeProtocolsMap = streamDetails?.protocols as Record<string, boolean> | undefined;
  const activeProtocols = activeProtocolsMap ? Object.keys(activeProtocolsMap).filter(p => activeProtocolsMap[p] === true) : [];
  
  let protocolsToShow = showAllProtocols ? availableProtocols : activeProtocols;

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex justify-end">פרוטוקולי פלט</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {protocolsToShow.map((protocolKey) => {
          const currentValue = streamDetails?.protocol_options?.[protocolKey];

          let status: 'on' | 'off' | 'default' = 'default';
          if (currentValue === null) {
            status = 'off';
          } else if (typeof currentValue === 'object' || currentValue === true) {
            status = 'on';
          }
          
          const isActuallyOn = activeProtocolsMap?.[protocolKey] === true;

          const handleChange = (newStatus: typeof status) => {
            const updatedProtocols: ProtocolOptions = {
              ...streamDetails?.protocol_options,
            };

            if (newStatus === 'default') {
              delete updatedProtocols[protocolKey];
            } else {
              updatedProtocols[protocolKey] = newStatus === 'on' ? {} : null;
            }

            onProtocolsChange(updatedProtocols);
          };
          
          if(!allowProtocolToggle && !isActuallyOn) return null;

          return (
            <Card key={protocolKey} className="bg-muted/30">
              <CardHeader className="p-3 flex-row justify-between items-center">
                <Badge
                  className={cn(
                    status === 'on' && 'bg-green-600 text-white',
                    status === 'off' && 'bg-red-600 text-white',
                    status === 'default' && 'bg-gray-400 text-white',
                     !isActuallyOn && 'bg-gray-500 text-white'
                  )}
                >
                  { isActuallyOn ? {
                    on: 'פעיל',
                    off: 'כבוי',
                    default: 'ברירת מחדל',
                  }[status] : 'כבוי' }
                </Badge>
                <CardTitle className="text-base">{protocolKey.toUpperCase()}</CardTitle>
              </CardHeader>
              {allowProtocolToggle && (
                <CardContent className="flex gap-2 p-3">
                  <Button
                    size="sm"
                    variant={status === 'on' ? 'default' : 'outline'}
                    onClick={() => handleChange('on')}
                  >
                    פועל
                  </Button>
                  <Button
                    size="sm"
                    variant={status === 'off' ? 'default' : 'outline'}
                    onClick={() => handleChange('off')}
                  >
                    כבוי
                  </Button>
                  <Button
                    size="sm"
                    variant={status === 'default' ? 'default' : 'outline'}
                    onClick={() => handleChange('default')}
                  >
                    ברירת מחדל
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
