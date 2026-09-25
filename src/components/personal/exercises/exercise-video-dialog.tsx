'use client';

import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { getEmbedVideoUrl, isDirectVideoFile } from '@/lib/video';

interface ExerciseVideoDialogProps {
    exercise: { name: string; muscleGroup?: string | null; videoUrl?: string | null } | null;
    onOpenChange: (open: boolean) => void;
}

/** Plays one exercise video on demand (the lists only show thumbnails). */
export function ExerciseVideoDialog({ exercise, onOpenChange }: ExerciseVideoDialogProps) {
    const url = exercise?.videoUrl ?? null;
    const embed = getEmbedVideoUrl(url);
    const direct = isDirectVideoFile(url);

    return (
        <Dialog open={Boolean(exercise)} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl rounded-2xl border-border bg-card p-0">
                <DialogHeader className="px-5 pb-0 pt-4 text-left">
                    <DialogTitle className="pr-8 text-base font-bold">{exercise?.name}</DialogTitle>
                    {exercise?.muscleGroup && <DialogDescription>{exercise.muscleGroup}</DialogDescription>}
                </DialogHeader>
                <div className="px-5 pb-5">
                    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                        {embed ? (
                            <iframe
                                src={`${embed}${embed.includes('?') ? '&' : '?'}autoplay=1`}
                                title={`Vídeo de ${exercise?.name ?? 'exercício'}`}
                                className="h-full w-full"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        ) : direct && url ? (
                            <video controls autoPlay className="h-full w-full" preload="metadata">
                                <source src={url} />
                                Seu navegador não suporta a reprodução deste vídeo.
                            </video>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/80">
                                Este link não pode ser reproduzido aqui.
                                {url && (
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/20"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Abrir vídeo em nova aba
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
