import os
import json
import subprocess
import pandas as pd
from universal_analyst import AnalystEngine, CyberpunkTheme

def create_mock_data():
    data = [
        {"category": "Alpha", "value": 150},
        {"category": "Beta", "value": 220},
        {"category": "Gamma", "value": 80},
        {"category": "Delta", "value": 310},
        {"category": "Epsilon", "value": 190},
        {"category": "Zeta", "value": 260}
    ]
    with open("test_data.json", "w") as f:
        json.dump(data, f)
    
    config = {
        "data_path": "test_data.json",
        "plot_type": "bar",
        "x": "category",
        "y": "value",
        "title": "Cyberpunk Migration Test"
    }
    with open("test_config.json", "w") as f:
        json.dump(config, f)

def test_engine():
    print("--- Testing AnalystEngine ---")
    engine = AnalystEngine()
    df = engine.load_data("test_data.json")
    print(f"Loaded DataFrame shape: {df.shape}")
    
    config = {"x": "category", "y": "value", "plot_type": "bar", "title": "Test Plot"}
    df = engine.process_data(df, config)
    print("Data processed successfully.")
    
    output_path = "test_plot_output.png"
    engine.create_plot(df, config, output_path)
    if os.path.exists(output_path):
        print(f"SUCCESS: {output_path} generated.")
    else:
        print(f"FAILURE: {output_path} not found.")

def test_cli():
    print("\n--- Testing CLI Execution ---")
    try:
        result = subprocess.run(["python", "universal_analyst.py", "test_config.json"], 
                              capture_output=True, text=True, check=True)
        print(result.stdout)
        if os.path.exists("plot_output.png"):
            print("SUCCESS: CLI generated plot_output.png")
    except subprocess.CalledProcessError as e:
        print(f"FAILURE: CLI failed with error:\n{e.stderr}")

if __name__ == "__main__":
    create_mock_data()
    test_engine()
    test_cli()
    print("\nVerification Complete.")
