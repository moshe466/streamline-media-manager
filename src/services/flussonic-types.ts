
import { z } from 'zod';

export const StreamInfoSchema = z.object({
  name: z.string(),
  stats: z.object({
    alive: z.boolean().optional(),
    client_count: z.number().optional(),
  }).passthrough().optional(),
  comment: z.string().optional(),
  title: z.string().optional(),
}).passthrough();

export const FlussonicApiResponseSchema = z.object({
  streams: z.array(StreamInfoSchema),
}).passthrough();

export const StreamTrackSchema = z.object({
  content: z.enum(['video', 'audio', 'text', 'metadata', 'application']).optional(),
  codec: z.string().optional(),
  bitrate: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  avg_fps: z.number().optional(),
  sample_rate: z.number().optional(),
  channels: z.number().optional(),
  language: z.string().optional(),
}).passthrough();

export const MediaInfoSchema = z.object({
      tracks: z.array(StreamTrackSchema).optional(),
    }).passthrough();
    
export const StatsSchema = z.object({
    alive: z.boolean().optional(),
    bitrate: z.number().optional(),
    client_count: z.number().optional(),
    input_media_info: MediaInfoSchema.optional(),
    media_info: MediaInfoSchema.optional(),
  }).passthrough();
  
export const ProtocolOptionsSchema = z.record(z.any()).optional();

export const DvrOptionsSchema = z.union([
    z.object({
        profile: z.string().optional(),
    }).passthrough(),
    z.object({}).passthrough(),
  ]).nullable().optional();
  
export const StreamPushSchema = z.object({
    url: z.string(),
    comment: z.string().optional(),
}).passthrough();


const InputSchema = z.union([
    z.string(),
    z.object({ url: z.string().optional() }).passthrough()
]);

export const StreamDetailsSchema = z.object({
  name: z.string(),
  static: z.boolean().optional(),
  inputs: z.array(InputSchema).optional(),
  dvr: DvrOptionsSchema,
  thumbnails: z.object({
    enabled: z.boolean().or(z.string()).optional(),
  }).passthrough().optional(),
  pushes: z.array(StreamPushSchema).optional(),
  protocol_options: ProtocolOptionsSchema,
  stats: StatsSchema.optional(),
  comment: z.string().optional(),
  title: z.string().optional(),
  publish_enabled: z.boolean().optional(), // Added this line
}).passthrough();

export const DvrConfigSchema = z.object({
    name: z.string(),
    root: z.string().optional(),
}).passthrough();

export const DvrConfigsApiResponseSchema = z.object({
    dvrs: z.array(DvrConfigSchema),
}).passthrough();

export const LogoSchema = z.object({
    name: z.string(),
    content: z.string(),
    content_type: z.string(),
}).passthrough();

export const LogoApiResponseSchema = z.object({
    logos: z.array(LogoSchema),
}).passthrough();

export const PushStatusSchema = z.object({
  status: z.string(),
  name: z.string(),
  url: z.string(),
  bitrate: z.number().optional(),
  bytes: z.number().optional(), 
}).passthrough();

export const PushStatusesApiResponseSchema = z.array(PushStatusSchema);


export type FlussonicStream = {
  name: string;
  status: 'online' | 'offline';
  comment?: string;
  title?: string;
};

export type StreamDetails = z.infer<typeof StreamDetailsSchema>;
export type DvrConfig = z.infer<typeof DvrConfigSchema>;
export type Logo = z.infer<typeof LogoSchema>;
export type PushStatus = z.infer<typeof PushStatusSchema>;
export type StreamPush = z.infer<typeof StreamPushSchema>;
export type ProtocolOptions = z.infer<typeof ProtocolOptionsSchema>;
