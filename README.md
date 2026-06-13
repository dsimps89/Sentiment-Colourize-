# Sentiment Colour Text Studio

Static GitHub-compatible HTML app for large-text formatting, sentiment colouring, and export.

## What it does

- Accepts very large pasted text.
- Formats text as paragraphs, sentence blocks, line-preserved text, or compact text.
- Applies word-level sentiment colouring using positive and negative lexicons.
- Supports colour metrics:
  - Positive / negative / neutral
  - Intensity
  - Local sentiment density
  - Random colour
  - Hybrid
- Supports scaling:
  - Linear
  - Square-root
  - Logarithmic
  - Binary
- Exports:
  - HTML
  - TXT
  - JSON
  - CSV
  - Print / Save as PDF

## Files

- `index.html`
- `style.css`
- `app.js`
- `assets/positive_words.json`
- `assets/negative_words.json`

## GitHub Pages

Upload the unzipped folder contents to a GitHub repository, then enable GitHub Pages.

## Note on very large files

The app is designed to process very large text, but browser memory still matters. The preview is limited by default for performance. Use **Render Full Preview** before full-colour HTML or PDF export.

## Lexicon note

The positive and negative word lists are based on the opinion lexicon files you uploaded.


## Fix notes

This version fixes the issue where the app could stay stuck on “Loading lexicons...” if the JSON files are in the repository root instead of `/assets`.

The app now checks both locations:

- `/assets/positive_words.json`
- `/assets/negative_words.json`
- `/positive_words.json`
- `/negative_words.json`

It also binds the buttons immediately, so text counting and formatting work even if lexicon loading fails.
