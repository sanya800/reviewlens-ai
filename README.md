# ReviewLens AI — NLP + ML Product Review Intelligence

ReviewLens analyzes product reviews and helps users make a buying decision. It accepts pasted reviews, product/review screenshots (OCR), and product URLs when a page permits automated access.

## What makes this a genuine NLP + ML project?

### 1. Transformer NLP sentiment analysis
The browser loads `Xenova/distilbert-base-uncased-finetuned-sst-2-english` through Hugging Face Transformers.js and classifies each review as positive or negative with a confidence score.

### 2. Supervised ML fake-review risk model
`training/train.py` trains a Logistic Regression classifier on TF-IDF text features. The generated vocabulary, IDF values, coefficients, and intercept are bundled in `training/model.json` and used for browser inference. The model produces a probability-like fake-review risk score and combines it with duplicate/unverified signals.

### 3. Aspect-based review analysis
The NLP layer extracts product-specific aspects from review text. Phone aspects such as camera/display only appear when those terms are actually present; décor, clothing, food, appliances and other products can surface different aspects.

### Important limitation
The included training set is intentionally small and educational. Fake-review detection should be described as **review-authenticity risk classification**, not proof that a person or review is fake. For a serious research version, replace the tiny dataset with a large labeled dataset and evaluate precision, recall, F1 and calibration.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Training the ML model again

```bash
python training/train.py
```

This requires scikit-learn in the Python environment used for training; it is not required to run the deployed Next.js app because the trained parameters are bundled as JSON.


## Dynamic aspect extraction
The UI never pre-populates phone or clothing aspects. Aspect cards are emitted only when a matching aspect term is actually present in the supplied review text.
