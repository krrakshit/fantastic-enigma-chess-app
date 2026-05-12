import pandas as pd
import os

def parse(filepath):
    df = pd.read_csv(filepath)
    
    # Keep only what we need
    df = df[["moves", "opening_shortname"]]
    
    # Drop games with less than 10 half-moves
    df["move_count"] = df["moves"].str.split().str.len()
    df = df[df["move_count"] >= 10].drop(columns=["move_count"])
    
    # Extract first 10 half-moves from each game
    def extract_moves(move_string):
        all_moves = move_string.strip().split()
        return all_moves[:10]
    
    df["moves_list"] = df["moves"].apply(extract_moves)
    
    # Expand into 10 separate columns
    for i in range(10):
        df[f"move_{i}"] = df["moves_list"].apply(lambda m: m[i])
    
    df = df.drop(columns=["moves", "moves_list"])
    
    print(f"Total games after cleaning: {len(df)}")
    print(f"Unique openings: {df['opening_shortname'].nunique()}")
    
    # Make sure processed folder exists before writing
    os.makedirs("processed", exist_ok=True)
    
    df.to_csv("processed/games_parsed.csv", index=False)
    print("Saved to processed/games_parsed.csv")
    return df

if __name__ == "__main__":
    parse("./data/chess_games.csv")