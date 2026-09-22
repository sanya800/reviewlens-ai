# ReviewLens AI – deployment update

This version includes:

- OCR cleanup for product/review screenshots, including common marketplace metadata such as `Review for`, variant fields, ratings, and UI labels.
- Cleaner review grouping from OCR so wrapped lines are merged into review text instead of becoming separate reviews.
- Per-review aspect extraction, so an aspect is shown only when the review itself mentions it. This prevents one review from creating unrelated aspects for the whole dataset.
- More consistent authenticity explanations. High-risk/needs-review results now include a model-risk explanation instead of saying there is no strong signal.
- The Hugging Face Transformer sentiment pipeline uses the `text-classification` task and the installed `@huggingface/transformers` package, matching the working production build.

## Deploy

1. Replace the files in your local ReviewLens project with this ZIP's contents.
2. Run `npm install`.
3. Run `npm run build` and confirm it succeeds.
4. Commit and push to `main`:

```powershell
git add .
git commit -m "Improve OCR aspects and authenticity analysis"
git push origin main
```

Render should redeploy automatically.
