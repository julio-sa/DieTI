# --- 1. IMPORTS ---
from fastapi import FastAPI, HTTPException, Query
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ConfigDict
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from unidecode import unidecode
import motor.motor_asyncio
import asyncio
import os
import re
import datetime

# --- 2. CONFIGURAÇÃO DO APP ---
app = FastAPI(
    title="TACO table with MongoDB API",
    description="API to consult nutritional information from TACO table per gram",
    version="2.0.0"
)

# Permitir frontend Angular
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "https://dieti-backend.onrender.com",
        "https://dieti.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

# Configuração do MongoDB
mongo_uri = os.getenv("MONGO_URI")
db_name = os.getenv("DB_NAME")
collection_taco = os.getenv("COLLECTION_NAME")
collection_daily = os.getenv("COLLECTION_NAME1")
collection_historical = os.getenv("COLLECTION_NAME2")
collection_daily_log = os.getenv("COLLECTION_NAME3")
collection_historical_log = os.getenv("COLLECTION_NAME4")
collection_recipes = os.getenv("COLLECTION_NAME5")

client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri)
db = client[db_name]
food_collection = db[collection_taco]
daily_intake_collection = db[collection_daily]
historical_intake_collection = db[collection_historical]
daily_log_intake_collection = db[collection_daily_log]
historical_log_intake_collection = db[collection_historical_log]
recipes_collection = db[collection_recipes]

# --- 3. MODELOS PYDANTIC ---
class NutritionalInfo(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={
            float: lambda v: float(f"{v:.4f}") if v is not None else None
        }
    )

    id: int = Field(alias="_id")
    description: str
    calorias_kcal: float | None = None
    proteinas_g: float | None = None
    gordura_g: float | None = None
    carbo_g: float | None = None
    date: str | None = None

class AddIntakeRequest(BaseModel):
    user_id: str
    calorias: float
    proteinas: float
    carbo: float
    gordura: float

# --- 4. FUNÇÕES AUXILIARES ---
def normalize_text(text: str) -> str:
    text = unidecode(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def levenshtein_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if len(a) == 0:
        return len(b)
    if len(b) == 0:
        return len(a)

    previous_row = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current_row = [i]
        for j, cb in enumerate(b, start=1):
            insert_cost = previous_row[j] + 1
            delete_cost = current_row[j - 1] + 1
            replace_cost = previous_row[j - 1] + (ca != cb)
            current_row.append(min(insert_cost, delete_cost, replace_cost))
        previous_row = current_row
    return previous_row[-1]

def is_fuzzy_match(query: str, text: str, max_distance: int = 2) -> bool:
    distance = levenshtein_distance(query, text[:len(query) + 2])
    return distance <= max_distance

async def search_in_taco_results(normalized_query: str):
    cursor = food_collection.find({})
    all_foods = await cursor.to_list(length=1000)
    results = []

    for food in all_foods:
        description = food.get("description", "")
        normalized_desc = normalize_text(description)

        if normalized_query in normalized_desc or is_fuzzy_match(normalized_query, normalized_desc):
            results.append({
                "_id": str(food["_id"]),
                "description": description,
                "type": "taco",
                "calorias_kcal": safe_float(food.get("calorias_kcal")),
                "proteinas_g": safe_float(food.get("proteinas_g")),
                "carbo_g": safe_float(food.get("carbo_g")),
                "gordura_g": safe_float(food.get("gordura_g"))
            })

    return results

async def search_in_recipes_results(normalized_query: str):
    cursor = recipes_collection.find({})
    all_recipes = await cursor.to_list(length=1000)
    results = []

    for recipe in all_recipes:
        normalized_name = normalize_text(recipe["name"])
        if normalized_query in normalized_name or is_fuzzy_match(normalized_query, normalized_name):
            results.append({
                "_id": str(recipe["_id"]),
                "description": recipe["name"],
                "type": "recipe",
                "calorias_kcal": safe_float(recipe.get("calorias")),
                "proteinas_g": safe_float(recipe.get("proteinas")),
                "carbo_g": safe_float(recipe.get("carbo")),
                "gordura_g": safe_float(recipe.get("gordura"))
            })

    return results

async def update_daily_intake(user_id: str, date: str):
    cursor = daily_log_intake_collection.find({"user_id": user_id, "date": date})
    total = {"calorias": 0.0, "proteinas": 0.0, "carbo": 0.0, "gordura": 0.0}
    async for item in cursor:
        total["calorias"] += item.get("calorias") or 0.0
        total["proteinas"] += item.get("proteinas") or 0.0
        total["carbo"] += item.get("carbo") or 0.0
        total["gordura"] += item.get("gordura") or 0.0
    await daily_intake_collection.update_one(
        {"user_id": user_id, "date": date},
        {"$set": total},
        upsert=True
    )

async def update_historical_intake(user_id: str, date: str):
    cursor = daily_log_intake_collection.find({"user_id": user_id, "date": date})
    total = {"calorias": 0.0, "proteinas": 0.0, "carbo": 0.0, "gordura": 0.0}
    async for item in cursor:
        total["calorias"] += item.get("calorias") or 0.0
        total["proteinas"] += item.get("proteinas") or 0.0
        total["carbo"] += item.get("carbo") or 0.0
        total["gordura"] += item.get("gordura") or 0.0
    await historical_intake_collection.update_one(
        {"user_id": user_id, "date": date},
        {"$set": total},
        upsert=True
    )

def safe_float(value, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        f = float(value)
        return f if not (f != f) else default
    except (TypeError, ValueError):
        return default

# --- 5. ENDPOINTS FUNCIONAIS ---

@app.get("/search/combined")
async def search_combined(q: str = Query(..., min_length=2)):
    normalized_query = normalize_text(q.strip())
    taco_task = asyncio.create_task(search_in_taco_results(normalized_query))
    recipes_task = asyncio.create_task(search_in_recipes_results(normalized_query))
    taco_results, recipe_results = await asyncio.gather(taco_task, recipes_task)
    results = taco_results + recipe_results

    if not results:
        raise HTTPException(status_code=404, detail=f"Nenhum alimento ou prato encontrado para '{q}'")

    try:
        results.sort(key=lambda x: not normalize_text(x["description"]).startswith(normalized_query))
    except Exception as e:
        print(f"[ERROR] Falha ao ordenar: {e}")

    return results

@app.get("/taco_table/{food_id}", response_model=NutritionalInfo)
async def search_by_code(food_id: int):
    food = await food_collection.find_one({"_id": food_id})
    if food:
        return food
    else:
        raise HTTPException(status_code=404, detail=f"Food with code '{food_id}' not found.")

@app.get("/intake/today")
async def get_today_intake(user_id: str):
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    intake = await daily_intake_collection.find_one({"user_id": user_id, "date": today})
    if not intake:
        return {"calorias": 0, "proteinas": 0, "carbo": 0, "gordura": 0, "date": today}
    intake.pop("_id", None)
    return intake

@app.post("/intake/add")
async def add_intake(request: AddIntakeRequest):
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    result = await daily_intake_collection.update_one(
        {"user_id": request.user_id, "date": today},
        {"$inc": {
            "calorias": request.calorias,
            "proteinas": request.proteinas,
            "carbo": request.carbo,
            "gordura": request.gordura
        }},
        upsert=True
    )
    return {"message": "Intake updated successfully"}

@app.get("/food/daily")
async def get_daily_food(user_id: str):
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    cursor = daily_log_intake_collection.find({"user_id": user_id, "date": today})
    foods = await cursor.to_list(length=100)
    for food in foods:
        food["_id"] = str(food["_id"])
    return foods

@app.post("/food/add")
async def add_food(food: dict):
    user_id = food.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")

    today = datetime.datetime.now().strftime("%Y-%m-%d")
    date = food.get("date") or today

    calorias = float(food.get("calorias") or 0.0)
    proteinas = float(food.get("proteinas") or 0.0)
    carbo = float(food.get("carbo") or 0.0)
    gordura = float(food.get("gordura") or 0.0)

    doc = {
        "user_id": user_id,
        "description": food["description"],
        "grams": food["grams"],
        "calorias": calorias,
        "proteinas": proteinas,
        "carbo": carbo,
        "gordura": gordura,
        "date": date
    }

    # salva no log do dia (sempre)
    await daily_log_intake_collection.insert_one(doc)

    # se for registro retroativo (data != hoje), já salva no histórico também
    if date != today:
        await historical_log_intake_collection.insert_one(doc)

    # recalcula totais
    await update_daily_intake(user_id, date)
    await update_historical_intake(user_id, date)

    return {"msg": "Food added"}


@app.put("/food/update/{food_id}")
async def update_food(food_id: str, updates: dict):
    if not ObjectId.is_valid(food_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    if "_id" in updates:
        del updates["_id"]

    # ✅ Valida campos obrigatórios
    if "grams" in updates and (updates["grams"] <= 0):
        raise HTTPException(status_code=400, detail="Grams must be greater than 0")

    result = await daily_log_intake_collection.update_one(
        {"_id": ObjectId(food_id)},
        {"$set": updates}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Food not found")

    # ✅ Atualiza totais diários
    food = await daily_log_intake_collection.find_one({"_id": ObjectId(food_id)})
    if food:
        await update_historical_intake(food["user_id"], food["date"])

    return {"msg": "Updated"}

@app.delete("/food/delete/{food_id}")
async def delete_food(food_id: str):
    if not ObjectId.is_valid(food_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    food = await daily_log_intake_collection.find_one({"_id": ObjectId(food_id)})
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    user_id = food["user_id"]
    today = food["date"]
    await daily_log_intake_collection.delete_one({"_id": ObjectId(food_id)})
    cursor = daily_log_intake_collection.find({"user_id": user_id, "date": today})
    total = {"calorias": 0, "proteinas": 0, "carbo": 0, "gordura": 0}
    async for item in cursor:
        total["calorias"] += item["calorias"]
        total["proteinas"] += item["proteinas"]
        total["carbo"] += item["carbo"]
        total["gordura"] += item["gordura"]
    await daily_intake_collection.update_one(
        {"user_id": user_id, "date": today},
        {"$set": total},
        upsert=True
    )
    await update_historical_intake(user_id, today)
    return {"msg": "Deleted and totals recalculated"}

@app.get("/intake/history")
async def get_history(user_id: str, days: int = 7):
    cutoff_date = (datetime.datetime.now() - datetime.timedelta(days=days)).strftime("%Y-%m-%d")
    cursor = historical_intake_collection.find({
        "user_id": user_id,
        "date": {"$gte": cutoff_date}
    }).sort("date", 1).limit(days)
    history = await cursor.to_list(length=days)
    for item in history:
        item.pop("_id", None)
    return history


@app.get("/food/history/{date}")
async def get_historical_food(user_id: str, date: str):
    # valida formato
    try:
        datetime.datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    today = datetime.datetime.now().strftime("%Y-%m-%d")

    # 1) se for hoje -> lê do diário (é onde /food/add grava)
    if date == today:
      cursor = daily_log_intake_collection.find({"user_id": user_id, "date": date})
      foods = await cursor.to_list(length=100)
    else:
      # 2) se for dia passado -> tenta primeiro no histórico
      cursor = historical_log_intake_collection.find({"user_id": user_id, "date": date})
      foods = await cursor.to_list(length=100)

      # 3) fallback: se não achou no histórico (ex.: cron não rodou),
      # tenta no diário mesmo assim
      if not foods:
        cursor = daily_log_intake_collection.find({"user_id": user_id, "date": date})
        foods = await cursor.to_list(length=100)

    # sempre devolver lista, nunca erro
    if not foods:
        return []

    for food in foods:
        food["_id"] = str(food["_id"])

    return foods


@app.post("/recipes/save")
async def save_recipe(recipe: dict):
    user_id = recipe.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID é obrigatório")

    # Garante que o user_id esteja no documento
    recipe["user_id"] = user_id

    result = await recipes_collection.insert_one(recipe)
    return {"inserted_id": str(result.inserted_id)}

@app.get("/recipes/list")
async def list_recipes(user_id: str = Query(..., description="ID do usuário")):
    if not user_id:
        raise HTTPException(status_code=400, detail="Parâmetro user_id é obrigatório")

    cursor = recipes_collection.find({"user_id": user_id})
    recipes = await cursor.to_list(length=100)

    for r in recipes:
        r["_id"] = str(r["_id"])

    return recipes

@app.put("/recipes/update/{recipe_id}")
async def update_recipe(recipe_id: str, recipe: dict):
    if not ObjectId.is_valid(recipe_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    # Verifica se o recipe_id existe e pertence ao user_id
    stored_recipe = await recipes_collection.find_one({"_id": ObjectId(recipe_id)})
    if not stored_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Extrai user_id da requisição (deve vir no body ou token)
    requesting_user_id = recipe.get("user_id")
    if not requesting_user_id:
        raise HTTPException(status_code=400, detail="User ID é obrigatório para atualização")

    # Valida propriedade
    if stored_recipe["user_id"] != requesting_user_id:
        raise HTTPException(status_code=403, detail="Acesso negado: você não é o dono desta receita")

    # Atualiza apenas os campos permitidos
    update_data = {
        "name": recipe.get("name"),
        "ingredients": recipe.get("ingredients"),
        "calorias": recipe.get("calorias"),
        "proteinas": recipe.get("proteinas"),
        "carbo": recipe.get("carbo"),
        "gordura": recipe.get("gordura")
    }

    result = await recipes_collection.update_one(
        {"_id": ObjectId(recipe_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {"msg": "Updated"}

@app.delete("/recipes/delete/{recipe_id}")
async def delete_recipe(recipe_id: str, user_id: str = Query(...)):
    if not ObjectId.is_valid(recipe_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    # Verifica se a receita existe
    recipe = await recipes_collection.find_one({"_id": ObjectId(recipe_id)})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Valida se pertence ao usuário
    if recipe["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Acesso negado: você não é o dono desta receita")

    result = await recipes_collection.delete_one({"_id": ObjectId(recipe_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {"msg": "Deleted"}

@app.post("/cron/rollover")
async def rollover_daily_food():
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    user_ids_processed = set()
    cursor = daily_log_intake_collection.find({"date": yesterday})
    moved = 0
    async for food in cursor:
        await historical_log_intake_collection.insert_one(food)
        await daily_log_intake_collection.delete_one({"_id": food["_id"]})
        user_ids_processed.add(food["user_id"])
        moved += 1
    for user_id in user_ids_processed:
        await update_historical_intake(user_id, yesterday)
    return {"message": "Rollover completed", "moved": moved}

@app.get("/")
async def root():
    return {
        "status": "ok",
        "name": "DieTI TACO API",
        "docs": "/docs",
        "redoc": "/redoc"
    }