import pandas as pd
import pymongo
import os
from dotenv import load_dotenv

def import_to_mongo():
    load_dotenv()
    mongo_uri = os.getenv("MONGO_URI")
    db_name   = os.getenv("DB_NAME")
    collection_name = os.getenv("COLLECTION_NAME")

    if not all([mongo_uri, db_name, collection_name]):
        print("Error: variables MONGO_URI, DB_NAME, COLLECTION_NAME need to be filled.")
        return

    print("Connecting to MongoDB...")
    client = pymongo.MongoClient(mongo_uri)
    db = client[db_name]
    collection = db[collection_name]
    print("Successfully connected!")

    excel_path = "Taco-4a-Edicao.xlsx"
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found: {excel_path}")

    print(f"Reading Excel file '{excel_path}'...")
    # se der erro de engine, certifique-se de ter o openpyxl instalado:
    df = pd.read_excel(excel_path, engine="openpyxl")

    print("Columns found:", list(df.columns))

    necessary_columns = {
        "Número do Alimento": "_id",
        "Descrição dos alimentos": "description",
        "Energia": "calorias_kcal",
        "Proteína": "proteinas_g",
        "Lipídeos": "gordura_g",
        "Carboidrato": "carbo_g",
    }

    missing = [c for c in necessary_columns if c not in df.columns]
    if missing:
        raise ValueError(f"Missing expected columns in Excel: {missing}")

    df = df[list(necessary_columns.keys())].rename(columns=necessary_columns)
    df = df.dropna(subset=["_id"])
    df["_id"] = df["_id"].astype(int)

    columns_per_gram = ["calorias_kcal", "proteinas_g", "gordura_g", "carbo_g"]
    for col in columns_per_gram:
        df[col] = pd.to_numeric(df[col], errors="coerce") / 100.0

    df = df.where(pd.notna(df), None)

    data_to_insert = df.to_dict(orient="records")
    print(f"{len(data_to_insert)} records processed.")

    print("Cleaning existent collection...")
    collection.delete_many({})

    if data_to_insert:
        print("Appending new data to collection...")
        collection.insert_many(data_to_insert)
        print("Data successfully imported to MongoDB!!")
    else:
        print("No data to insert.")

if __name__ == "__main__":
    import_to_mongo()
