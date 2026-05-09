import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static(path.join(__dirname, '../public')));

// Debounce cache (in-memory) - Note: Vercel functions are ephemeral, so this is per-instance.
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
        version: '1.0.0',
        name: "Demande d'ajout",
        description: 'Request missing movies and shows from the administrator.',
        resources: ['stream'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        behaviorHints: {
            configurable: true,
            configurationRequired: !hasValidConfig // Only require config if it's missing
        }
    };
    res.send(manifest);
});

// Fix for Stremio's "Configure" button path
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
    
    if (!decoded || !decoded.t || !decoded.c) {
        return res.status(400).send('Invalid configuration');
    }

    const cacheKey = `${config}:${id}`;
    const now = Date.now();
    if (cache.has(cacheKey) && now - cache.get(cacheKey) < 300000) {
        return res.redirect('https://cdn.jsdelivr.net/gh/stremio/stremio-addon-helloworld@master/assets/success.mp4');
    }
    cache.set(cacheKey, now);

    let title = id;
    try {
        const imdbId = id.split(':')[0];
        const metaRes = await fetch(`https://cinemeta-live.strem.io/meta/${type}/${imdbId}.json`);
        const metaData = await metaRes.json();
        if (metaData && metaData.meta) {
            title = metaData.meta.name;
            if (id.includes(':')) {
                const parts = id.split(':');
                title += ` (S${parts[1]}E${parts[2]})`;
            }
        }
    } catch (e) {
        console.error('Metadata fetch failed', e);
    }

    const message = `🎬 <b>New Content Request</b>\n\n<b>Title:</b> ${title}\n<b>Type:</b> ${type}\n<b>ID:</b> <code>${id}</code>\n\n<a href="https://www.imdb.com/title/${id.split(':')[0]}">Open in IMDb</a>`;
    
    try {
        const telegramUrl = `https://api.telegram.org/bot${decoded.t}/sendMessage`;
        await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: decoded.c,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: false
            })
        });
    } catch (e) {
        console.error('Telegram notification failed', e);
    }

    res.redirect('https://cdn.jsdelivr.net/gh/stremio/stremio-addon-helloworld@master/assets/success.mp4');
});

// Root redirect to configure
app.get('/', (req, res) => {
    res.redirect('/configure.html');
});

export default app;