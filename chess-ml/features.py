import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
import joblib
import os

def encode(df):
    os.makedirs("models", exist_ok=True)
    
    move_cols = [f"move_{i}" for i in range(10)]
    
    # One LabelEncoder per move position
    # This is the key design decision — position 0 and position 5
    # have completely different vocabularies
    move_encoders = {}
    
    X = np.zeros((len(df), 10), dtype=int)
    
    for i, col in enumerate(move_cols):
        le = LabelEncoder()
        X[:, i] = le.fit_transform(df[col])
        move_encoders[i] = le
        print(f"Position {i}: {len(le.classes_)} unique moves")
    
    # Encode the labels
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(df["opening_shortname"])
    
    print(f"\nFeature matrix shape: {X.shape}")
    print(f"Number of classes: {len(label_encoder.classes_)}")
    
    # Save encoders
    joblib.dump(move_encoders, "models/move_encoders.pkl")
    joblib.dump(label_encoder, "models/label_encoder.pkl")
    np.save("processed/X.npy", X)
    np.save("processed/y.npy", y)
    
    print("Saved encoders and feature matrix")
    return X, y, move_encoders, label_encoder

if __name__ == "__main__":
    df = pd.read_csv("processed/games_parsed.csv")
    encode(df)