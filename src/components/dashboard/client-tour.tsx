
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '../ui/button';
import { Headphones, Loader2 } from 'lucide-react';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { getTourData } from '@/services/storage';

const TOUR_PAGE_PATH = '/tour';

export function ClientTour() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.clientId as string;
  const [isLoading, setIsLoading] = useState(false);
  const [isTourEnabled, setIsTourEnabled] = useState(false);

  useEffect(() => {
    // Fetch the tour status when the component mounts
    const fetchTourStatus = async () => {
      const data = await getTourData();
      setIsTourEnabled(data.isEnabled);
    };
    fetchTourStatus();
  }, []);

  const handleStartTourClick = () => {
    setIsLoading(true);
    const tourPath = `/client/${clientId}${TOUR_PAGE_PATH}`;
    router.push(tourPath);
  };

  // If the tour is not enabled, don't render the button at all
  if (!isTourEnabled) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleStartTourClick} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Headphones className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>סיור וירטואלי</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
