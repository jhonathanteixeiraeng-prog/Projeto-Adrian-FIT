import http from 'http';
import fs from 'fs';
import { normalizeDietMeal } from './src/lib/diet-normalizer';

const PORT = 3000;

function json(res: http.ServerResponse, status: number, data: any) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true',
    });
    res.end(JSON.stringify(data));
}

function loadDietPlan() {
    const raw = JSON.parse(fs.readFileSync('./mock-diet-raw.json', 'utf-8'));
    if (!Array.isArray(raw) || raw.length === 0) return null;

    const title = raw[0].title;
    const meals = raw.map((r: any) =>
        normalizeDietMeal({
            id: r.name,
            name: r.name,
            time: r.time,
            notes: r.notes,
            foods: JSON.parse(r.foods),
        })
    );

    return {
        id: 'mock-plan-id',
        title,
        meals,
    };
}

const plan = loadDietPlan();

const server = http.createServer((req, res) => {
    const url = req.url || '/';

    if (req.method === 'OPTIONS') {
        return json(res, 204, {});
    }

    if (url === '/api/auth/csrf') {
        return json(res, 200, { csrfToken: 'mock-csrf-token' });
    }

    if (url === '/api/auth/callback/credentials' && req.method === 'POST') {
        return json(res, 200, { success: true });
    }

    if (url === '/api/auth/session') {
        return json(res, 200, {
            user: {
                id: 'cmlpn2m6o0000h7psr0u5psjn',
                name: 'Brenda',
                email: 'bassuncao155@gmail.com',
                role: 'STUDENT',
                studentId: 'cmlpn2m6q0002h7psnlmgt48f',
                personalId: null,
                personalTrainerName: null,
            }
        });
    }

    if (url === '/api/student/diet') {
        if (!plan) return json(res, 500, { success: false, error: 'No diet plan' });
        return json(res, 200, { success: true, data: plan });
    }

    if (url === '/api/student/diet/complete' && req.method === 'POST') {
        return json(res, 200, { success: true, mealId: 'mock', completed: true });
    }

    if (url === '/api/student/dashboard') {
        if (!plan) return json(res, 500, { success: false, error: 'No diet plan' });
        return json(res, 200, {
            success: true,
            data: {
                personal: { name: 'Personal', brandName: 'Fit Coach', avatar: null },
                workout: null,
                diet: plan,
                stats: { streak: 0, weeklyWorkouts: 0, weeklyGoal: 5, nextCheckin: 'Domingo' },
            }
        });
    }

    json(res, 404, { success: false, error: 'Not found' });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Mock server running at http://127.0.0.1:${PORT}`);
});
