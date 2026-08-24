# Root Hub

Læg disse filer i repository-rooten:

- `index.html`
- `style.css`
- `pages.js`
- `app.js`

## Struktur

```text
ROOT/
├─ index.html
├─ style.css
├─ pages.js
├─ app.js
├─ mtg/
│  ├─ index.html
│  └─ oracle/
├─ dnd/
├─ tools/
└─ blog/
```

## Tilføj en ny side

Du redigerer normalt kun `pages.js`.

```js
{
  title: "Text Tools",
  description: "Ryd, sortér og konvertér tekst.",
  href: "./tools/text/",
  category: "Tools",
  icon: "Tx",
  badge: "Ny"
}
```

Når objektet er tilføjet, dukker kortet automatisk op på hubben.


Cloudflare:
https://dash.cloudflare.com/1172514ace9255dbf57db5e5e019001c/workers/services/view/familienlykke-api/production
