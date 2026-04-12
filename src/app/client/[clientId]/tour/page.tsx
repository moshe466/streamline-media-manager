
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, X, Play, Pause, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { getTourData, type TourStep } from '@/services/storage';
import NextImage from 'next/image';
import { Logo } from '@/components/logo';
import Autoplay from "embla-carousel-autoplay"


export default function ClientTourPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = params.clientId as string;

    const [tourSteps, setTourSteps] = useState<TourStep[]>([]);
    const [musicUrl, setMusicUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);
    const [count, setCount] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const plugin = useRef(
        Autoplay({ delay: 40000, stopOnInteraction: true, stopOnMouseEnter: true })
    );

    const stopAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await getTourData();
                setTourSteps(data.steps);
                setCount(data.steps.length);
                setMusicUrl(data.musicUrl);
                if (data.musicUrl) {
                    audioRef.current = new Audio(data.musicUrl);
                    audioRef.current.loop = true;
                    audioRef.current.volume = 0.3;
                    
                    const playPromise = audioRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise
                          .then(() => setIsPlaying(true))
                          .catch(error => {
                            console.log("Autoplay was prevented. User interaction required.");
                        });
                    }
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את נתוני הסיור.' });
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
        
        // Cleanup function to stop audio when the component unmounts
        return () => {
            stopAudio();
        };
    }, [toast, stopAudio]);
    
    useEffect(() => {
        if (!api) return;
        
        const onSelect = () => {
            setCurrent(api.selectedScrollSnap() + 1);
        };
    
        api.on("select", onSelect);
        onSelect(); // Set initial value
    
        return () => {
            api.off("select", onSelect);
        };
    }, [api]);
    

    const toggleAudio = useCallback(() => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(err => console.error("Audio play failed:", err));
            }
            setIsPlaying(!isPlaying);
        }
    }, [isPlaying]);

    const handleSkipTour = () => {
        stopAudio();
        router.push(`/client/${clientId}/dashboard`);
    }
    
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-muted/20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-muted/20 text-right">
             <div className="absolute top-4 right-4 z-20">
                 <Button variant="outline" onClick={handleSkipTour}>
                     <X className="ml-2 h-4 w-4" />
                     דלג על הסיור
                 </Button>
            </div>
            
             <Carousel 
                setApi={setApi} 
                className="w-full max-w-4xl" 
                dir="rtl"
                plugins={[plugin.current]}
                onMouseEnter={plugin.current.stop}
                onMouseLeave={plugin.current.reset}
            >
                <CarouselContent>
                    {tourSteps.map((step) => (
                        <CarouselItem key={step.id}>
                            <Card className="shadow-2xl">
                                <CardContent className="flex flex-col lg:flex-row items-center justify-center p-0">
                                    <div className="w-full lg:w-3/5 aspect-video bg-black/80 relative flex items-center justify-center overflow-hidden lg:rounded-r-lg">
                                        {step.image ? (
                                            <NextImage src={step.image} alt={step.title} fill style={{objectFit: 'contain'}} data-ai-hint="screenshot interface" unoptimized />
                                        ) : (
                                            <Logo className="w-48 h-24 opacity-50"/>
                                        )}
                                    </div>
                                    <div className="w-full lg:w-2/5 p-8 flex flex-col justify-center">
                                         <CardTitle className="mb-4 text-2xl">{step.title}</CardTitle>
                                         <CardDescription className="text-base">{step.intro}</CardDescription>
                                    </div>
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6">
                    <CarouselPrevious className="static translate-y-0 h-12 w-12"><ArrowLeft className="h-6 w-6" /></CarouselPrevious>
                    <div className="py-2 text-center text-sm text-muted-foreground">
                        שלב {current} מתוך {count}
                    </div>
                    <CarouselNext className="static translate-y-0 h-12 w-12"><ArrowRight className="h-6 w-6" /></CarouselNext>
                </div>
                 {musicUrl && (
                     <div className="absolute top-4 left-4 z-20">
                         <Button variant="outline" size="icon" onClick={toggleAudio}>
                             {isPlaying ? <Pause className="h-5 w-5"/> : <Play className="h-5 w-5"/>}
                         </Button>
                     </div>
                 )}
            </Carousel>
        </main>
    );
}
