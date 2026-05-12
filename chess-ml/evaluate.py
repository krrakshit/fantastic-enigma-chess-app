import numpy as np
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
import joblib

def evaluate():
    X = np.load("processed/X.npy")
    y = np.load("processed/y.npy")
    model = joblib.load("models/model.pkl")
    label_encoder = joblib.load("models/label_encoder.pkl")
    
    # Apply same rare class filter as train.py
    unique, counts = np.unique(y, return_counts=True)
    valid_classes = unique[counts >= 2]
    mask = np.isin(y, valid_classes)
    X = X[mask]
    y = y[mask]
    
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    y_pred = model.predict(X_test)
    
    print("=" * 60)
    print(f"Overall Accuracy: {accuracy_score(y_test, y_pred)*100:.2f}%")
    print("=" * 60)
    
    print("\nPer-class Report:")
    # Get only classes that actually appear in the test set
    classes_in_test = np.unique(y_test)
    target_names = label_encoder.classes_[classes_in_test]
    print(classification_report(
        y_test, y_pred,
        labels=classes_in_test,
        target_names=target_names
    ))
    
    print("\nFeature Importances (which move position matters most):")
    importances = model.feature_importances_
    for i, imp in enumerate(importances):
        bar = "█" * int(imp * 200)
        print(f"  move_{i}: {imp:.4f}  {bar}")

if __name__ == "__main__":
    evaluate()