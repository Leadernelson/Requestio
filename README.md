# Stremio Request Addon

A custom Stremio addon for content requests, designed for easy deployment on Vercel.

## Features
- **Stateless Configuration:** Credentials are stored in the addon URL, not on the server.
- **Dummy Stream UI:** Provides a "Request" button directly in the Stremio stream list.
- **Telegram Notifications:** Sends rich notifications with title, year, and IMDb links.
- **Metadata Resolution:** Uses Cinemeta to convert IMDb IDs into human-readable names.
- **Debouncing:** Prevents duplicate notification spam.

## Deployment

1.  Push this folder to a GitHub repository.
2.  Import the repository into [Vercel](https://vercel.com).
3.  Vercel will automatically detect the configuration and deploy it as a Serverless Function.

## Usage

1.  Open your deployed URL in a browser (e.g., `https://my-request-addon.vercel.app`).
2.  You will be redirected to the configuration page.
3.  Enter your **Telegram Bot Token** and **Chat ID**.
4.  Click **Install Addon**.
5.  Install the addon in Stremio.

Now, whenever you see a movie or show in Stremio that has no streams (or even if it does), you will see a "Family Request Bot" option. Clicking it will notify you on Telegram.

## Developer Note
This addon is built using Node.js and Express, utilizing Vercel's Serverless Functions. It is completely free to host on the Vercel Free Tier.