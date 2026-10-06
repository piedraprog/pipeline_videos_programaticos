import { z } from 'zod';

const safeName = z.string().min(1).max(64).regex(/^[a-z0-9][a-z0-9-]*$/, 'Use lowercase letters, numbers, and hyphens.');

export const CaptureActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('navigate'), url: z.string().url() }),
  z.object({ type: z.literal('click'), selector: z.string().min(1) }),
  z.object({ type: z.literal('scroll'), selector: z.string().min(1) }),
  z.object({ type: z.literal('screenshot'), selector: z.string().min(1).optional() }),
]);

export const VideoPlanSchema = z.object({
  projectName: safeName,
  title: z.string().trim().min(1).max(80).default('Product demo'),
  subtitle: z.string().trim().max(120).default('A closer look at the experience'),
  visual: z.object({
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#67e8c1'),
    backgroundStyle: z.enum(['aurora', 'midnight', 'warm']).default('aurora'),
  }).default({ accentColor: '#67e8c1', backgroundStyle: 'aurora' }),
  baseUrl: z.string().url(),
  viewport: z.object({ width: z.number().int().positive().default(1080), height: z.number().int().positive().default(1920) }).default({ width: 1080, height: 1920 }),
  fps: z.number().int().min(1).max(60).default(30),
  scenes: z.array(z.object({
    id: safeName,
    title: z.string().trim().min(1).max(60).optional(),
    caption: z.string().trim().max(100).optional(),
    durationFrames: z.number().int().positive(),
    actions: z.array(CaptureActionSchema).min(1),
  })).min(1),
}).superRefine((plan, ctx) => {
  const ids = new Set<string>();
  for (const [index, scene] of plan.scenes.entries()) {
    if (ids.has(scene.id)) ctx.addIssue({ code: 'custom', path: ['scenes', index, 'id'], message: `Duplicate scene id "${scene.id}".` });
    ids.add(scene.id);
    if (!scene.actions.some((action) => action.type === 'screenshot')) {
      ctx.addIssue({ code: 'custom', path: ['scenes', index, 'actions'], message: 'Each scene must include a screenshot action.' });
    }
  }
});

export const ManifestSchema = z.object({
  projectName: safeName,
  title: z.string().trim().min(1).max(80).default('Product demo'),
  subtitle: z.string().trim().max(120).default('A closer look at the experience'),
  visual: z.object({
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#67e8c1'),
    backgroundStyle: z.enum(['aurora', 'midnight', 'warm']).default('aurora'),
  }).default({ accentColor: '#67e8c1', backgroundStyle: 'aurora' }),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scenes: z.array(z.object({ id: safeName, title: z.string().trim().min(1).max(60).optional(), caption: z.string().trim().max(100).optional(), asset: z.string().min(1), durationFrames: z.number().int().positive() })).min(1),
});

export type VideoPlan = z.infer<typeof VideoPlanSchema>;
export type CaptureAction = z.infer<typeof CaptureActionSchema>;
export type VideoManifest = z.infer<typeof ManifestSchema>;
