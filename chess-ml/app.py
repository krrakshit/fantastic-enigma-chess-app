from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# No CORS needed — this service is internal only
# Protected at network level via AWS Security Groups

model = joblib.load("models/model.pkl")
move_encoders = joblib.load("models/move_encoders.pkl")
label_encoder = joblib.load("models/label_encoder.pkl")

print("Model loaded successfully")

def encode_moves(moves):
    moves = list(moves[:10])
    while len(moves) < 10:
        moves.append("unknown")
    
    features = np.zeros((1, 10), dtype=int)
    
    for i, move in enumerate(moves):
        le = move_encoders[i]
        if move in le.classes_:
            features[0, i] = le.transform([move])[0]
        else:
            features[0, i] = 0
    
    return features

@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json()
    
    if not data or "moves" not in data:
        return jsonify({"error": "moves array required"}), 400
    
    moves = data["moves"]
    
    if len(moves) < 5:
        return jsonify({"error": "need at least 5 moves"}), 400
    
    features = encode_moves(moves)
    probabilities = model.predict_proba(features)[0]
    model_classes = model.classes_
    
    top3_prob_indices = np.argsort(probabilities)[::-1][:3]
    top3 = [
        {
            "opening": label_encoder.classes_[model_classes[idx]],
            "confidence": round(float(probabilities[idx]), 3)
        }
        for idx in top3_prob_indices
    ]
    
    best = top3[0]
    
    return jsonify({
        "opening": best["opening"],
        "confidence": best["confidence"],
        "top3": top3
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)