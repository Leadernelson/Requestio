import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, '../public')));

// Debounce cache (in-memory)
const cache = new Map();

function decodeConfig(config) {
    try {
        return JSON.parse(Buffer.from(config, 'base64').toString());
    } catch (e) {
        return null;
    }
}

// CORS Headers for Stremio
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');
    next();
});

app.get('/:config/manifest.json', (req, res) => {
    const { config } = req.params;
    const decoded = decodeConfig(config);
    const hasValidConfig = decoded && decoded.t && decoded.c;

    const manifest = {
        id: 'com.family.requestbot',
        version: '1.0.4',
        name: "Demande d'ajout",
        description: 'Demander des films et séries à l\'administrateur.',
        resources: ['stream'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        behaviorHints: {
            configurable: true,
            configurationRequired: !hasValidConfig
        }
    };
    res.send(manifest);
});

app.get('/:config/configure', (req, res) => {
    res.redirect('/configure.html');
});

app.get('/:config/stream/:type/:id', (req, res) => {
    const { config, type, id } = req.params;
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    
    const cleanId = id.replace('.json', '');
    const triggerUrl = `${protocol}://${host}/${config}/trigger/${type}/${cleanId}`;
    
    const stream = {
        name: "Demande d'ajout",
        title: "📥 Envoie une demande d'ajout",
        url: triggerUrl,
        behaviorHints: {
            notWebReady: false
        }
    };

    res.send({ streams: [stream] });
});

app.get('/:config/trigger/:type/:id', async (req, res) => {
    const { config, type, id } = req.params;
    const decoded = decodeConfig(config);
    const host = req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    
    console.log(`Triggered request for ${id}`);

    if (!decoded || !decoded.t || !decoded.c) {
        return res.status(400).send('Configuration invalide');
    }

    const cacheKey = `${config}:${id}`;
    const now = Date.now();
    
    // Local Success Video URL (served by Vercel)
    const successVideoUrl = `${protocol}://${host}/success.mp4`;

    // Check cache
    if (cache.has(cacheKey) && now - cache.get(cacheKey) < 30000) { // 30s debounce
        return res.redirect(successVideoUrl);
    }
    cache.set(cacheKey, now);

    try {
        let title = id;
        try {
            const imdbId = id.split(':')[0];
            const metaRes = await fetch(`https://cinemeta-live.strem.io/meta/${type}/${imdbId}.json`, { timeout: 2000 });
            const metaData = await metaRes.json();
            if (metaData && metaData.meta) {
                title = metaData.meta.name;
                if (id.includes(':')) {
                    const parts = id.split(':');
                    title += ` (S${parts[1]}E${parts[2]})`;
                }
            }
        } catch (e) {}

        const message = `🎬 <b>Nouvelle Demande</b>\n\n<b>Titre:</b> ${title}\n<b>Type:</b> ${type}\n<b>ID:</b> <code>${id}</code>\n\n<a href="https://www.imdb.com/title/${id.split(':')[0]}">Ouvrir IMDb</a>`;
        
        const telegramUrl = `https://api.telegram.org/bot${decoded.t}/sendMessage`;
        await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: decoded.c,
                text: message,
                parse_mode: 'HTML'
            }),
            timeout: 3000
        });

    } catch (err) {
        console.error("Error sending notification:", err);
    }

    // FINAL FIX FOR ANDROID TV: 
    // Redirect to the perfectly hosted local video on Vercel
    res.redirect(successVideoUrl);
});

app.get('/', (req, res) => {
    res.redirect('/configure.html');
});

export default app;