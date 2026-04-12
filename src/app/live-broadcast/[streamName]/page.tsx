
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Video, Mic, Power, ArrowRight, VideoOff, AlertTriangle, Loader2, SwitchCamera, Maximize, Minimize, RefreshCw, ChevronDown, Settings, Tv, ZoomIn, ScreenShare, ScreenShareOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getFlussonicConnectionDetails } from '@/services/flussonic';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';


const AudioMeter = ({ level }: { level: number }) => {
    const getBarColor = (value: number) => {
        if (value > 90) return 'bg-red-500';
        if (value > 75) return 'bg-yellow-400';
        return 'bg-green-500';
    };

    return (
        <div className="relative w-full h-2 bg-muted/50 rounded-full overflow-hidden">
            <div
                className={cn("absolute top-0 left-0 h-full rounded-full transition-[width]", getBarColor(level))}
                style={{ width: `${level}%` }}
            />
        </div>
    );
};

type QualityLevel = 'auto' | '1080p' | '720p' | '480p';

const qualityConstraints: Record<QualityLevel, MediaTrackConstraints> = {
    'auto': { width: { ideal: 1280 }, height: { ideal: 720 } },
    '1080p': { width: { exact: 1920 }, height: { exact: 1080 } },
    '720p': { width: { exact: 1280 }, height: { exact: 720 } },
    '480p': { width: { exact: 640 }, height: { exact: 480 } },
};

const qualityBitrates: Record<QualityLevel, number> = {
    'auto': 1_500_000,
    '1080p': 3_000_000,
    '720p': 1_500_000,
    '480p': 800_000,
};


const qualityLabels: Record<QualityLevel, string> = {
  'auto': 'אוטומטי',
  '1080p': 'גבוהה (1080p)',
  '720p': 'בינונית (720p)',
  '480p': 'נמוכה (480p)',
};


// Helper to get stream with fallback to ideal constraints if exact fails
async function getStreamWithFallback(c: MediaStreamConstraints) {
  try { return await navigator.mediaDevices.getUserMedia(c); }
  catch {
    // Try without exact, with ideal
    const v = (c.video as any) || {};
    const relaxed: MediaStreamConstraints = { 
        video: { 
            width: { ideal: v?.width?.exact || 1280 }, 
            height: { ideal: v?.height?.exact || 720 },
            deviceId: v.deviceId,
        }, 
        audio: c.audio 
    };
    return await navigator.mediaDevices.getUserMedia(relaxed);
  }
}

// Helper to create a mixed audio track from mic and screen audio
async function createMixedAudioTrack(micStream?: MediaStream, screenStream?: MediaStream) {
  const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = ac.createMediaStreamDestination();

  const add = (s?: MediaStream) => {
    const t = s?.getAudioTracks()[0];
    if (!t) return;
    const src = ac.createMediaStreamSource(new MediaStream([t]));
    const gain = ac.createGain();
    gain.gain.value = 1.0; 
    src.connect(gain).connect(dest);
  };

  add(micStream);
  add(screenStream);

  // Return the single mixed audio track, or null if no audio tracks were added
  return dest.stream.getAudioTracks()[0] || null;
}


export default function BroadcastCapturePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const streamName = decodeURIComponent(params.streamName as string);
    const cameFrom = searchParams.get('from');
    const clientId = sessionStorage.getItem('userId'); 

    const videoRef = useRef<HTMLVideoElement>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const whipResourceUrlRef = useRef<string | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioProcessingRef = useRef<{
        audioContext: AudioContext;
        sourceNode: MediaStreamAudioSourceNode;
        gainNode: GainNode;
        analyserNode: AnalyserNode;
        destinationNode: MediaStreamAudioDestinationNode;
        animationFrameId: number | null;
    } | null>(null);

    const [isStreaming, setIsStreaming] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [focusPoint, setFocusPoint] = useState<{ x: number, y: number, active: boolean } | null>(null);
    
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
    const [quality, setQuality] = useState<QualityLevel>('auto');
    const [streamSource, setStreamSource] = useState<'camera' | 'screen'>('camera');
    const isMobile = useIsMobile();

    const [bitrate, setBitrate] = useState(0);
    const lastStatsRef = useRef<{ timestamp: number; bytesSent: number } | null>(null);
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Zoom state
    const [zoomSupport, setZoomSupport] = useState<{ min: number; max: number; step: number } | null>(null);
    const [currentZoom, setCurrentZoom] = useState(1);
    const touchStartDistanceRef = useRef(0);
    const lastZoomLevelRef = useRef(1);
    
    // UI Controls visibility state
    const [areControlsVisible, setAreControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const hideControls = useCallback(() => {
         if (isStreaming) {
            setAreControlsVisible(false);
        }
    }, [isStreaming]);

    const showAndResetTimer = useCallback(() => {
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        setAreControlsVisible(true);
        controlsTimeoutRef.current = setTimeout(hideControls, 4000);
    }, [hideControls]);

    useEffect(() => {
        showAndResetTimer();
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [showAndResetTimer]);


    const handleZoomChange = useCallback(async (newZoomValue: number) => {
        if (!mediaStreamRef.current || !zoomSupport) return;
        const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (!videoTrack) return;
        try {
            const clampedZoom = Math.max(zoomSupport.min, Math.min(zoomSupport.max, newZoomValue));
            // @ts-ignore
            await videoTrack.applyConstraints({ advanced: [{ zoom: clampedZoom }] });
            setCurrentZoom(clampedZoom);
        } catch (error) {
            console.error("Failed to apply zoom constraints:", error);
        }
    }, [zoomSupport]);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 2 && zoomSupport) {
            e.preventDefault();
            touchStartDistanceRef.current = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            lastZoomLevelRef.current = currentZoom;
        }
    };
    
    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 2 && zoomSupport) {
            e.preventDefault();
            const currentDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            const scale = currentDistance / touchStartDistanceRef.current;
            const newZoom = lastZoomLevelRef.current * scale;
            handleZoomChange(newZoom);
        }
    };
    
    const stopAudioProcessing = useCallback(() => {
        const processing = audioProcessingRef.current;
        if (!processing) return;

        if (processing.animationFrameId) {
            cancelAnimationFrame(processing.animationFrameId);
            processing.animationFrameId = null;
        }
        processing.sourceNode.disconnect();
        processing.gainNode.disconnect();
        processing.analyserNode.disconnect();
        setAudioLevel(0);
    }, []);

     const initializeStream = useCallback(async (deviceId: string, newQuality: QualityLevel) => {
        if (isStreaming) {
            console.log("Cannot initialize new stream while streaming.");
            return;
        }
        
        try {
            const videoConstraint = qualityConstraints[newQuality];
            const constraints: MediaStreamConstraints = {
                video: { ...videoConstraint, deviceId: { exact: deviceId } },
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            };
            
            const newStream = await getStreamWithFallback(constraints);

            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            
            mediaStreamRef.current = newStream;

            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            
            const videoTrack = newStream.getVideoTracks()[0];
            if (videoTrack) {
                // @ts-ignore
                const capabilities = videoTrack.getCapabilities?.();
                // @ts-ignore
                if (capabilities && capabilities.zoom) {
                    // @ts-ignore
                    setZoomSupport({ min: capabilities.zoom.min, max: capabilities.zoom.max, step: capabilities.zoom.step });
                    setCurrentZoom(1);
                } else {
                    setZoomSupport(null);
                }
            } else {
                 setZoomSupport(null);
            }
            
            if (!audioProcessingRef.current) {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioProcessingRef.current = {
                    audioContext,
                    sourceNode: audioContext.createMediaStreamSource(newStream),
                    gainNode: audioContext.createGain(),
                    analyserNode: audioContext.createAnalyser(),
                    destinationNode: audioContext.createMediaStreamDestination(),
                    animationFrameId: null,
                };
            } else {
                 stopAudioProcessing();
                 audioProcessingRef.current.sourceNode = audioProcessingRef.current.audioContext.createMediaStreamSource(newStream);
            }

            const { audioContext, sourceNode, gainNode, analyserNode, destinationNode } = audioProcessingRef.current;
            
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
    
            analyserNode.fftSize = 256;
            analyserNode.smoothingTimeConstant = 0.3;
    
            sourceNode.connect(gainNode);
            gainNode.connect(analyserNode);
            gainNode.connect(destinationNode);
    
            const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
            const draw = () => {
                const processing = audioProcessingRef.current;
                if (!processing) return;
                processing.animationFrameId = requestAnimationFrame(draw);
                processing.analyserNode.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
                setAudioLevel(Math.min(100, (average / 128) * 100));
            };
            draw();

            setHasCameraPermission(true);

        } catch (error) {
            console.error('Error initializing stream:', error);
            setHasCameraPermission(false);
            toast({ variant: 'destructive', title: 'שגיאת גישה למצלמה', description: 'יש לאפשר גישה למצלמה ולמיקרופון בהגדרות הדפדפן כדי להתחיל שידור.', duration: 10000 });
        }
    }, [isStreaming, toast, stopAudioProcessing]);


    const getPermissionsAndDevices = useCallback(async () => {
        try {
            const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setHasCameraPermission(true);

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            setVideoDevices(videoInputs);
            
            tempStream.getTracks().forEach(track => track.stop());

            if (videoInputs.length > 0) {
                setCurrentDeviceId(videoInputs[0].deviceId);
                await initializeStream(videoInputs[0].deviceId, quality);
            } else {
                 throw new Error("No video input devices found.");
            }
        } catch (error) {
            console.error('Error getting permissions and devices:', error);
            setHasCameraPermission(false);
        }
    }, [initializeStream, quality]);


    const handleQualityChange = (newQuality: QualityLevel) => {
        if (isStreaming) {
            toast({ variant: 'destructive', title: 'לא ניתן לשנות איכות בזמן שידור' });
            return;
        }
        if (currentDeviceId) {
            setQuality(newQuality);
            initializeStream(currentDeviceId, newQuality);
        }
    };

     const handleCameraSelect = (deviceId: string) => {
        if (isStreaming) {
            toast({ variant: 'destructive', title: 'לא ניתן לשנות מצלמה בזמן שידור' });
            return;
        }
        if (deviceId !== currentDeviceId) {
            setCurrentDeviceId(deviceId);
            initializeStream(deviceId, quality); 
        }
    };


    useEffect(() => {
        getPermissionsAndDevices();

        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        const handleDeviceChange = async () => {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        };
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        
        return () => {
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
            peerConnectionRef.current?.getSenders().forEach(s => s.track?.stop());
            peerConnectionRef.current?.close();
            peerConnectionRef.current = null;
            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            if (audioProcessingRef.current) {
                stopAudioProcessing();
                audioProcessingRef.current.audioContext.close();
            }
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isStreaming) {
                e.preventDefault();
                e.returnValue = ''; 
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isStreaming]);

    
     const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
        if (!mediaStreamRef.current) return;
        const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
        if (!videoTrack) return;
        // @ts-ignore
        const capabilities = videoTrack.getCapabilities?.();
        // @ts-ignore
        if (!capabilities?.focusMode?.includes('manual')) {
            console.warn("Focus control not supported by this camera.");
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setFocusPoint({ x: e.clientX, y: e.clientY, active: true });
        setTimeout(() => setFocusPoint(p => p ? { ...p, active: false } : null), 1000);
        // @ts-ignore
        videoTrack.applyConstraints({ advanced: [{ focusMode: 'manual', pointsOfInterest: [{ x, y }] }] })
            .catch(err => console.error("Failed to apply focus constraints:", err));
    };


    const handleFullscreenToggle = async () => {
        if (!mainContainerRef.current) return;
        if (!document.fullscreenElement) {
            try {
                await mainContainerRef.current.requestFullscreen();
                if (screen.orientation && 'lock' in screen.orientation) await (screen.orientation as any).lock('landscape');
            } catch (err) {
                 console.error("Fullscreen request failed:", err);
                 toast({ variant: 'destructive', title: "Fullscreen failed", description: "Could not enter fullscreen mode."});
            }
        } else {
            await document.exitFullscreen();
        }
    };
    
    const handleToggleScreenShare = async () => {
        if (isStreaming) {
            toast({ variant: 'destructive', title: 'לא ניתן לשנות מקור בזמן שידור' });
            return;
        }

        if (streamSource === 'screen') {
            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            await getPermissionsAndDevices();
            setStreamSource('camera');
            return;
        }

        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            
            const mixedAudioTrack = await createMixedAudioTrack(mediaStreamRef.current!, screenStream);

            mediaStreamRef.current?.getTracks().forEach(track => track.stop());
            
            const screenVideoTrack = screenStream.getVideoTracks()[0];
            
            screenVideoTrack.onended = () => {
                handleToggleScreenShare(); 
                 toast({ title: 'שיתוף המסך הופסק' });
            };
            
            const tracks = [screenVideoTrack, ...(mixedAudioTrack ? [mixedAudioTrack] : [])];
            mediaStreamRef.current = new MediaStream(tracks);

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStreamRef.current;
            }
            
            setStreamSource('screen');
            setZoomSupport(null); 

        } catch (error) {
            console.error("Error starting screen share:", error);
            toast({ variant: 'destructive', title: 'שגיאה בשיתוף מסך', description: 'לא ניתן היה להתחיל את שיתוף המסך.' });
        }
    };


    const handleVolumeChange = (value: number[]) => {
        if (audioProcessingRef.current?.gainNode) {
            audioProcessingRef.current.gainNode.gain.value = value[0];
        }
    };

    const handleToggleStream = async () => {
        if (isStreaming) {
             if (whipResourceUrlRef.current) {
                const { authHeader } = await getFlussonicConnectionDetails();
                fetch(whipResourceUrlRef.current, { method: 'DELETE', headers: { 'Authorization': authHeader } }).catch(() => {});
                whipResourceUrlRef.current = null;
            }
            if (peerConnectionRef.current) peerConnectionRef.current.close();
            peerConnectionRef.current = null;
            if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
            setIsStreaming(false);
            setBitrate(0);
            if(currentDeviceId) {
                await initializeStream(currentDeviceId, quality);
            }
            return;
        }
        if (!mediaStreamRef.current) {
            toast({ variant: 'destructive', title: 'אין מקור וידאו', description: 'לא ניתן להתחיל שידור ללא גישה למצלמה.' });
            return;
        }
        setIsConnecting(true);
        try {
            const instanceId = sessionStorage.getItem('instanceId') || 'default';
            const connectionDetails = await getFlussonicConnectionDetails(instanceId);
            const { authHeader, publicHost } = connectionDetails;
            const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
            
            const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
            peerConnectionRef.current = pc;

            const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
            const audioTrack = (streamSource === 'camera' && audioProcessingRef.current) 
                ? audioProcessingRef.current.destinationNode.stream.getAudioTracks()[0]
                : mediaStreamRef.current.getAudioTracks()[0];

            if (videoTrack) pc.addTrack(videoTrack, mediaStreamRef.current);
            if (audioTrack) {
                 const streamForAudio = streamSource === 'camera' 
                    ? audioProcessingRef.current!.destinationNode.stream 
                    : mediaStreamRef.current;
                pc.addTrack(audioTrack, streamForAudio);
            }

            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                const params = sender.getParameters();
                if (!params.encodings) {
                    params.encodings = [{}];
                }
                params.encodings[0].maxBitrate = qualityBitrates[quality];
                await sender.setParameters(params);
                if (sender.track) {
                    (sender.track as any).contentHint = 'motion';
                }
            }


            pc.oniceconnectionstatechange = () => {
                if(pc.iceConnectionState === 'connected') {
                    setIsConnecting(false); setIsStreaming(true);
                    toast({ title: 'שידור חי החל!', description: `אתה משדר כעת לערוץ ${streamName}` });
                    statsIntervalRef.current = setInterval(async () => {
                        if (!peerConnectionRef.current) return;
                        const stats = await peerConnectionRef.current.getStats();
                        let bytesSent = 0;
                        stats.forEach(report => { if (report.type === 'outbound-rtp' && report.kind === 'video') bytesSent = report.bytesSent; });
                        if (lastStatsRef.current) {
                            const timeDiff = Date.now() - lastStatsRef.current.timestamp;
                            const bytesDiff = bytesSent - lastStatsRef.current.bytesSent;
                            const newBitrate = Math.round((bytesDiff * 8) / timeDiff);
                            setBitrate(newBitrate);
                        }
                        lastStatsRef.current = { timestamp: Date.now(), bytesSent: bytesSent };
                    }, 1000);
                } else if (pc.iceConnectionState === 'failed') {
                    setIsConnecting(false); setIsStreaming(false);
                    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
                    toast({ variant: 'destructive', title: 'החיבור נכשל', description: 'לא ניתן היה להתחבר לשרת המדיה.' });
                } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'closed') {
                     setIsConnecting(false); setIsStreaming(false);
                     if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
                     if (isStreaming) toast({ title: 'השידור הופסק', variant: 'destructive' });
                }
            };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            // Build whipUrl dynamically using the resolved publicHost
            const whipUrl = `https://${publicHost}/whip/${streamName}`;
            
            const response = await fetch(whipUrl, {
                 method: 'POST', 
                 body: pc.localDescription?.sdp, 
                 headers: { 
                     'Authorization': authHeader, 
                     'Content-Type': 'application/sdp',
                     'Accept': 'application/sdp'
                }, 
            });
            if (!response.ok) { const errorBody = await response.text(); throw new Error(`Failed to connect to WHIP endpoint: ${response.status} ${response.statusText} - ${errorBody}`); }
            
            whipResourceUrlRef.current = response.headers.get('Location');
            const answer = await response.text();
            await pc.setRemoteDescription({ type: 'answer', sdp: answer });
        } catch (error) {
            console.error('Error starting WebRTC stream:', error);
            toast({ variant: 'destructive', title: 'שגיאה בהתחלת שידור', description: (error as Error).message });
            setIsConnecting(false); setIsStreaming(false);
        }
    };
    
    const backLink = cameFrom === 'client' && clientId
        ? `/client/${clientId}/live-broadcast/lobby`
        : '/live-broadcast/lobby';

    if (hasCameraPermission === null) {
        return ( <div className="flex h-screen w-full items-center justify-center bg-black text-white"><Loader2 className="h-8 w-8 animate-spin mr-2" />מבקש גישה למצלמה...</div> );
    }

    return (
        <div 
            ref={mainContainerRef} 
            className="h-screen w-screen bg-black text-white relative flex items-center justify-center"
            onClick={showAndResetTimer}
            onTouchStart={(e) => { showAndResetTimer(); handleTouchStart(e); }}
            onTouchMove={handleTouchMove}
        >
            <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover" 
                autoPlay 
                muted 
                playsInline 
            />
            {focusPoint?.active && ( <div className="absolute border-2 border-white rounded-full w-16 h-16 transition-opacity duration-1000 animate-pulse" style={{ left: focusPoint.x - 32, top: focusPoint.y - 32 }} /> )}

            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                 <div className="flex-1 flex justify-start">
                    {isStreaming ? (
                         <div className="flex items-center justify-start gap-2 text-red-500 animate-pulse">
                            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                            LIVE
                        </div>
                    ) : (
                         <Button asChild variant="outline" className="bg-black/30 border-white/20"><Link href={backLink}><ArrowRight className="ml-2 h-4 w-4" />חזור</Link></Button>
                    )}
                </div>
                <div className="flex-1 flex justify-end">
                     <div className="flex flex-col items-end gap-2 text-right">
                        <div className="text-center">
                            <h1 className="text-lg font-bold">שידור לערוץ: {streamName}</h1>
                        </div>
                        <div className="flex items-center gap-2">
                           {isStreaming ? (
                                <Badge variant="outline" className="text-white border-white/20 bg-black/30">
                                    <Tv className="ml-2 h-4 w-4"/>
                                    איכות: {qualityLabels[quality]}
                                </Badge>
                            ) : (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="bg-black/30 border-white/20" disabled={isStreaming}>
                                            <Settings className="h-5 w-5" />
                                            <span className="sr-only">הגדרות איכות</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="text-right">
                                        <DropdownMenuLabel>איכות שידור</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuRadioGroup value={quality} onValueChange={(v) => handleQualityChange(v as QualityLevel)}>
                                            <DropdownMenuRadioItem value="auto">{qualityLabels['auto']}</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="1080p">{qualityLabels['1080p']}</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="720p">{qualityLabels['720p']}</DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="480p">{qualityLabels['480p']}</DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                             {!isStreaming && streamSource === 'camera' && videoDevices.length > 1 && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="icon" className="bg-black/30 border-white/20" disabled={isStreaming}>
                                            <SwitchCamera className="h-5 w-5" />
                                            <span className="sr-only">החלף מצלמה</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="text-right">
                                        {videoDevices.map(device => (
                                            <DropdownMenuItem key={device.deviceId} onSelect={() => handleCameraSelect(device.deviceId)}>
                                                {device.label || `מצלמה ${videoDevices.indexOf(device) + 1}`}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                             )}
                            {!isMobile && (
                                 <Button variant="outline" size="icon" onClick={handleToggleScreenShare} className="bg-black/30 border-white/20" disabled={isStreaming}>
                                    {streamSource === 'screen' ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                                    <span className="sr-only">{streamSource === 'screen' ? 'Stop Sharing' : 'Share Screen'}</span>
                                </Button>
                            )}
                            <Button variant="outline" size="icon" onClick={handleFullscreenToggle} className="bg-black/30 border-white/20">{isFullscreen ? <Minimize className="h-5 w-5"/> : <Maximize className="h-5 w-5" />}<span className="sr-only">מסך מלא</span></Button>
                        </div>
                    </div>
                </div>
            </div>

            {hasCameraPermission === false && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-30">
                    <Card className="w-full max-w-md m-4 text-center text-foreground">
                        <CardHeader>
                            <div className="mx-auto bg-destructive/10 p-3 rounded-full"><VideoOff className="h-8 w-8 text-destructive" /></div>
                            <CardTitle className="mt-4">נדרשת גישה למצלמה ומיקרופון</CardTitle>
                        </CardHeader>
                        <CardContent><p className="text-muted-foreground">כדי לשדר מהמכשיר, עליך לאפשר לדפדפן גישה למצלמה ולמיקרופון. בדוק את הגדרות האתר בשורת הכתובת וודא שהגישה מאושרת.</p></CardContent>
                        <CardFooter><Button onClick={getPermissionsAndDevices} className="w-full"><RefreshCw className="ml-2 h-4 w-4"/>נסה שוב</Button></CardFooter>
                    </Card>
                </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col items-center z-10 w-full max-w-3xl mx-auto">
                 {hasCameraPermission && ( <div className="mb-4"><Button onClick={handleToggleStream} size="lg" className={cn("rounded-full h-16 w-48 text-lg", isStreaming ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700")} disabled={isConnecting}>{isConnecting ? (<Loader2 className="ml-2 h-4 w-4 animate-spin" />) : (<Power className="ml-2 h-5 w-5" />)}{isConnecting ? 'מתחבר...' : (isStreaming ? 'הפסק שידור' : 'התחל שידור')}</Button></div> )}
                <div className={cn("flex w-full flex-row items-center gap-4 transition-opacity duration-300", areControlsVisible ? "opacity-100" : "opacity-0")}>
                     {zoomSupport && (
                        <div className="p-2 bg-black/50 rounded-md flex items-center gap-2 w-1/2">
                           <ZoomIn className="h-4 w-4"/>
                           <Slider 
                                defaultValue={[1]} 
                                min={zoomSupport.min}
                                max={zoomSupport.max}
                                step={zoomSupport.step}
                                value={[currentZoom]}
                                onValueChange={(value) => handleZoomChange(value[0])}
                                className="flex-1"
                            />
                        </div>
                    )}
                    <div className="p-2 bg-black/50 rounded-md flex flex-col gap-2 w-1/2">
                        <div className="flex items-center gap-2">
                             <Mic className="h-4 w-4" />
                             <Slider defaultValue={[1]} max={2} step={0.1} onValueChange={handleVolumeChange} className="flex-1" />
                        </div>
                        <AudioMeter level={audioLevel} />
                    </div>
                </div>
                 <div className="p-2 mt-2 bg-black/50 rounded-md text-center w-full max-w-xs">
                    <span className="text-xs">מהירות הזרמה: {isStreaming ? `${bitrate} kbps` : '0 kbps'}</span>
                 </div>
            </div>
        </div>
    );
}
