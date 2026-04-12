
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { updateStream } from '@/services/flussonic';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Power, PowerOff, RotateCcw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { StreamDetails, ProtocolOptions } from '@/services/flussonic-types';

interface Props {
  streamName: string;
  onSuccess?: () => void;
  streamDetails: StreamDetails | null;
}

const ALL_PROTOCOLS = [
  'hls', 'rtmp', 'srt', 'webrtc', 'dash', 'jpeg', 'mss', 'api',
  'm4f', 'm4s', 'mseld', 'shoutcast', 'tshttp', 'cmaf', 'player',
  'whitelist', 'rtsp'
];

export function ToggleAllProtocols({ streamName, onSuccess, streamDetails }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const getAuthContext = useCallback(() => {
    const userId = sessionStorage.getItem('userId');
    const sessionId = sessionStorage.getItem('activeSessionId');
    if (!userId || !sessionId) return null;
    return { userId, sessionId };
  }, []);

  const handleAction = async (mode: 'enable' | 'disable' | 'default') => {
    const auth = getAuthContext();
    if (!auth) {
        toast({ variant: 'destructive', title: 'שגיאת אימות' });
        return;
    }

    if (!streamDetails) {
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן לבצע פעולה. פרטי השידור חסרים.' });
        return;
    }

    setLoading(mode);
    
    const protocolOptions: ProtocolOptions = {};
    if (mode !== 'default') {
        ALL_PROTOCOLS.forEach(protocol => {
            protocolOptions[protocol] = mode === 'enable' ? {} : null;
        });
    }
    
    const fullUpdate: Partial<StreamDetails> = {
        name: streamDetails.name,
        static: streamDetails.static,
        inputs: streamDetails.inputs || [],
        dvr: streamDetails.dvr || undefined,
        pushes: streamDetails.pushes || [],
        thumbnails: streamDetails.thumbnails || undefined,
        logo: streamDetails.logo || {},
        comment: streamDetails.comment || '',
        protocol_options: protocolOptions,
    };

    const result = await updateStream(auth, streamName, fullUpdate);

    if (result.success) {
      toast({ title: `הפעולה בוצעה בהצלחה`, description: `כל הפרוטוקולים עודכנו למצב '${{
        enable: 'פועל',
        disable: 'כבוי',
        default: 'ברירת מחדל'
      }[mode]}'.` });
      if (onSuccess) {
          setTimeout(onSuccess, 500);
      }
    } else {
      toast({ variant: 'destructive', title: 'שגיאה בעדכון פרוטוקולים', description: result.error });
    }
    setLoading(null);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
         <Tooltip>
          <TooltipTrigger asChild>
            <Button disabled={!!loading} onClick={() => handleAction('enable')}>
             {loading === 'enable' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Power className="ml-2 h-4 w-4" />}
                הפעל הכל
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>הפעל את כל פרוטוקולי הפלט הזמינים</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
             <Button disabled={!!loading} variant="destructive" onClick={() => handleAction('disable')}>
                {loading === 'disable' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <PowerOff className="ml-2 h-4 w-4" />}
                כבה הכל
            </Button>
          </TooltipTrigger>
           <TooltipContent>
            <p>כבה את כל פרוטוקולי הפלט</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
           <TooltipTrigger asChild>
             <Button disabled={!!loading} variant="outline" onClick={() => handleAction('default')}>
                 {loading === 'default' ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RotateCcw className="ml-2 h-4 w-4" />}
                אפס לברירת מחדל
            </Button>
          </TooltipTrigger>
           <TooltipContent>
            <p>הסר הגדרות פרוטוקולים ספציפיות וחזור לברירת המחדל של השרת</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
