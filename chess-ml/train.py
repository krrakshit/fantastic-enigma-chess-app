import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib

def train():
    X = np.load("processed/X.npy")
    y = np.load("processed/y.npy")
    label_encoder = joblib.load("models/label_encoder.pkl")
    
    # Remove classes with less than 2 examples
    # stratify=y requires at least 2 samples per class
    unique, counts = np.unique(y, return_counts=True)
    valid_classes = unique[counts >= 2]
    mask = np.isin(y, valid_classes)
    X = X[mask]
    y = y[mask]
    print(f"Removed {(~mask).sum()} games from rare classes")
    print(f"Remaining games: {len(X)}")
    print(f"Remaining classes: {len(valid_classes)}")
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\nTraining samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")
    print(f"\nTraining Random Forest...")
    
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=30,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1,
        verbose=1
    )
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    print(f"\nTest Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    
    joblib.dump(model, "models/model.pkl")
    print("Model saved to models/model.pkl")

if __name__ == "__main__":
    train()