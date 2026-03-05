import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Adrian Santos FIT',
        short_name: 'Adrian FIT',
        description: 'Aplicativo de acompanhamento de treinos, dieta e evolução.',
        start_url: '/login',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#F88022',
        icons: [
            {
                src: '/icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any',
            },
            {
                src: '/favicon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any',
            },
        ],
    };
}
