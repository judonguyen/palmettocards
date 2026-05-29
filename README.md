# PSA Submission Tracker

A web app that looks up a PSA card-grading submission by number and shows its
8-step grading progress (and final grades once the order has shipped).

## How it works
- **`index.html`** + **`app.js`** — the browser UI. Reads `?sub=` from the URL,
  calls the API below, and renders the progress steps and graded cards.
- **`api/track.js`** — a Vercel **serverless function** that calls the PSA public
  API server-side. The PSA API token is read from the `PSA_TOKEN` environment
  variable, so it is never exposed in the browser or committed to the repo.

## Configuration
Set the PSA API token as an environment variable in Vercel (Project → Settings →
Environment Variables):

```
PSA_TOKEN = <your PSA public API token>
```

> Originally built as a Salesforce Marketing Cloud CloudPages (SSJS) page; the
> server logic was ported to a Vercel serverless function so it runs on Vercel.
