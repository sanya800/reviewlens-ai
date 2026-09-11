"""Train the bundled educational fake-review ML model.
TF-IDF word features + Logistic Regression. Replace this tiny dataset with a
larger labeled dataset for research/production work.
"""
from pathlib import Path
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

real = [
"The size is accurate and the material feels solid. I have used it for two weeks and it still looks good.",
"Packaging was secure and the product arrived on time. Quality is better than expected for the price.",
"I bought this for my desk. The finish is clean and it feels sturdy. Good value.",
"The fabric is soft and the fit is comfortable. The color matches the photos.",
"Sound is clear and the battery lasts most of the day. Setup was easy.",
"The seller answered my question and the return was straightforward. Product works as described.",
"After a month the build is still strong. It is slightly heavy but otherwise useful.",
"The taste is fresh and the ingredients are clearly listed. Delivery was quick.",
"The screen is bright and performance is smooth for normal use. Camera is decent in daylight.",
"The item is smaller than I expected, but the material and finish are good.",
"It arrived safely packed. The design is simple and attractive.",
"I compared the dimensions before buying and they were correct. Worth the price.",
]
fake = [
"Amazing best product!!! Buy now guaranteed!!!", "Wow perfect excellent must buy today!!!",
"Best best best. Amazing quality. Definitely recommend to everyone!!!", "Five stars. Nice product. Thank you seller!!!",
"Excellent product amazing product perfect product wow!!!", "Use my code and buy today, guaranteed best deal!!!",
"Worst fake fraud waste money!!!", "Perfect perfect perfect. No issues. Best ever!!!",
"Awesome!!! Must buy!!!", "Good good good good product!!!", "Absolutely perfect and amazing, highly recommended!!!",
"Buy now best price guaranteed, trust me!!!",
]
texts=real+fake
y=[0]*len(real)+[1]*len(fake)
vocab=['amazing','best','buy','cheap','code','comfortable','definitely','excellent','experience','fake','good','great','guaranteed','honestly','love','must','nice','perfect','product','quality','recommend','seller','service','smooth','thank','today','trust','value','verified','waste','worst','wow']
vec=TfidfVectorizer(vocabulary=vocab, lowercase=True, ngram_range=(1,1), sublinear_tf=True)
X=vec.fit_transform(texts)
clf=LogisticRegression(C=2.0, max_iter=2000, random_state=42).fit(X,y)
# IDF is needed for inference; fixed vocabulary preserves stable feature order.
out={"vocabulary":vocab,"idf":vec.idf_.tolist(),"coefficients":clf.coef_[0].tolist(),"intercept":float(clf.intercept_[0]),"training_examples":len(texts)}
Path('model.json').write_text(json.dumps(out,indent=2))
print(json.dumps({"training_examples":len(texts),"intercept":out['intercept']}))
