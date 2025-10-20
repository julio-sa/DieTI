# --- 1. IMPORTS ---
from fastapi import FastAPI, HTTPException, Query
from pydantic import Field
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from unidecode import unidecode
from passlib.context import CryptContext
import motor.motor_asyncio
import asyncio
import os
import re
import datetime
import random
import string
import Levenshtein as lev

# --- 2. CONFIGURAÇÃO DO APP ---
app = FastAPI(
    title="TACO table with MongoDB API",
    description="API to consult nutritional information from TACO table per gram",
    version="2.0.0"
)

EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

load_dotenv()

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
users_collection = db["users"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. MODELOS PYDANTIC ---
class NutritionalInfo(BaseModel):
    id: int = Field(alias="_id")
    description: str
    calorias_kcal: Optional[float] = None
    proteinas_g: Optional[float] = None
    gordura_g: Optional[float] = None
    carbo_g: Optional[float] = None
    date: str = None

    class Config:
        allow_population_by_field_name = True
        json_encoders = {
            float: lambda v: float(f"{v:.4f}") if v is not None else None
        }

class AddIntakeRequest(BaseModel):
    user_id: str
    calorias: float
    proteinas: float
    carbo: float
    gordura: float

# --- 4. FUNÇÕES AUXILIARES (TODAS ANTES DAS ROTAS) ---
def normalize_text(text: str) -> str:
    """
    Normaliza texto: remove acentos, converte para minúsculas,
    substitui pontuação por espaço, e reduz múltiplos espaços.
    """
    text = unidecode(text).lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)  # Substitui por espaço
    text = re.sub(r'\s+', ' ', text).strip()   # Reduz espaços
    return text

def is_fuzzy_match(query: str, text: str, max_distance: int = 2) -> bool:
    """
    Verifica se 'query' é um match aproximado de 'text'.
    Ex: 'btata' ~ 'batata'
    """
    distance = lev.distance(query, text[:len(query) + 2])  # Compara prefixo expandido
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
    """
    Converte qualquer valor para float, evitando NaN e None.
    """
    if value is None:
        return default
    try:
        f = float(value)
        return f if not (f != f) else default  # Checa NaN
    except (TypeError, ValueError):
        return default

# --- 5. ENDPOINTS (APÓS TODAS AS FUNÇÕES) ---
@app.get("/search/combined")
async def search_combined(q: str = Query(..., min_length=2)):
    """
    Busca combinada em TACO e Receitas
    Resultados: 1º os que começam com o termo, 2º os que contêm
    """
    normalized_query = normalize_text(q.strip())

    # Buscar em paralelo
    taco_task = asyncio.create_task(search_in_taco_results(normalized_query))
    recipes_task = asyncio.create_task(search_in_recipes_results(normalized_query))

    taco_results, recipe_results = await asyncio.gather(taco_task, recipes_task)

    # Combina todos os resultados
    results = taco_results + recipe_results

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"Nenhum alimento ou prato encontrado para '{q}'"
        )

    # Ordena: palavras que começam com o termo vêm primeiro
    try:
        results.sort(key=lambda x: not normalize_text(x["description"]).startswith(normalized_query))
    except Exception as e:
        print(f"[ERROR] Falha ao ordenar: {e}")
        pass

    return results

@app.get("/taco_table/{food_id}", response_model=NutritionalInfo, summary="Search food by code", tags=["Food"])
async def search_by_code(food_id: int):
    food = await food_collection.find_one({"_id": food_id})
    if food:
        return food
    else:
        raise HTTPException(status_code=404, detail=f"Food with code '{food_id}' not found.")

@app.get("/intake/today")
async def get_today_intake(user_id: str):
    today = datetime.datetime.now().strftime("%Y-%m-%d")

    # Tenta encontrar o registro de hoje
    intake = await daily_intake_collection.find_one({
        "user_id": user_id,
        "date": today
    })

    if not intake:
        # Retorna consumo zerado para hoje
        return {
            "calorias": 0,
            "proteinas": 0,
            "carbo": 0,
            "gordura": 0,
            "date": today
        }

    # Remove _id para serialização
    intake.pop("_id", None)
    return intake

@app.post("/intake/add")
async def add_intake(request: AddIntakeRequest):
    today = datetime.datetime.now().strftime("%Y-%m-%d")

    # Atualiza ou cria o documento do dia
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
    try:
        today = datetime.datetime.now().strftime("%Y-%m-%d")

        cursor = daily_log_intake_collection.find({
            "user_id": user_id,
            "date": today
        })

        foods = await cursor.to_list(length=100)

        # ✅ Converte ObjectId para string
        for food in foods:
            food["_id"] = str(food["_id"])

        return foods  # Agora é serializável

    except Exception as e:
        print("Erro em /food/daily:", str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/food/add")
async def add_food(food: dict):
    user_id = food.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID is required")

    date = food.get("date") or datetime.datetime.now().strftime("%Y-%m-%d")

    # ✅ Converte null/None para 0.0
    calorias = float(food.get("calorias") or 0.0)
    proteinas = float(food.get("proteinas") or 0.0)
    carbo = float(food.get("carbo") or 0.0)
    gordura = float(food.get("gordura") or 0.0)

    result = await daily_log_intake_collection.insert_one({
        "user_id": user_id,
        "description": food["description"],
        "grams": food["grams"],
        "calorias": calorias,
        "proteinas": proteinas,
        "carbo": carbo,
        "gordura": gordura,
        "date": date
    })

    await update_daily_intake(user_id, date)
    await update_historical_intake(user_id, date)

    return {"msg": "Food added"}

@app.put("/food/update/{food_id}")
async def update_food(food_id: str, updates: dict):
    if not ObjectId.is_valid(food_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await daily_log_intake_collection.update_one(
        {"_id": ObjectId(food_id)},
        {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Food not found")

    food = await daily_log_intake_collection.find_one({"_id": ObjectId(food_id)})
    if food:
        await update_historical_intake(food["user_id"], food["date"])
    return {"msg": "Updated"}

@app.delete("/food/delete/{food_id}")
async def delete_food(food_id: str):
    if not ObjectId.is_valid(food_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    # Busca o alimento antes de apagar
    food = await daily_log_intake_collection.find_one({"_id": ObjectId(food_id)})
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")

    user_id = food["user_id"]
    today = food["date"]

    # Remove do log diário
    await daily_log_intake_collection.delete_one({"_id": ObjectId(food_id)})

    # ✅ Recalcula e atualiza DAILY_INTAKE (consumo do dia)
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

    # ✅ Atualiza o histórico SEMANAL (7 dias)
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
    try:
        datetime.datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    cursor = historical_log_intake_collection.find({"user_id": user_id, "date": date})
    foods = await cursor.to_list(length=100)

    if not foods:
        raise HTTPException(status_code=404, detail="No food found for this date")

    # ✅ Converte _id para string
    for food in foods:
        food["_id"] = str(food["_id"])

    return foods

@app.post("/recipes/save")
async def save_recipe(recipe: dict):
    result = await recipes_collection.insert_one(recipe)
    return {"inserted_id": str(result.inserted_id)}


@app.get("/recipes/list")
async def list_recipes():
    cursor = recipes_collection.find({})
    recipes = await cursor.to_list(length=100)

    for r in recipes:
        r["_id"] = str(r["_id"])

    return recipes


@app.put("/recipes/update/{recipe_id}")
async def update_recipe(recipe_id: str, recipe: dict):
    if not ObjectId.is_valid(recipe_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await recipes_collection.update_one(
        {"_id": ObjectId(recipe_id)},
        {"$set": recipe}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {"msg": "Updated"}


@app.delete("/recipes/delete/{recipe_id}")
async def delete_recipe(recipe_id: str):
    if not ObjectId.is_valid(recipe_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")

    result = await recipes_collection.delete_one({"_id": ObjectId(recipe_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {"msg": "Deleted"}

@app.post("/cron/rollover")
async def rollover_daily_food():
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    user_ids_processed = set()

    # Mover alimentos do dia anterior para histórico
    cursor = daily_log_intake_collection.find({"date": yesterday})
    moved = 0
    async for food in cursor:
        await historical_log_intake_collection.insert_one(food)
        await daily_log_intake_collection.delete_one({"_id": food["_id"]})
        user_ids_processed.add(food["user_id"])
        moved += 1

    # Garantir que o histórico esteja atualizado
    for user_id in user_ids_processed:
        await update_historical_intake(user_id, yesterday)

    return {"message": "Rollover completed", "moved": moved}

# Banco de dados simulado para códigos de recuperação
collection_reset_tokens = db["password_reset_tokens"]  # { email: { code: str, expires_at: datetime } }

@app.post("/auth/forgot-password")
async def forgot_password(request: dict):
    email = request.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email é obrigatório")

    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Email inválido")

    # ✅ Verifica se o usuário existe
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=400, detail="Email não registrado")

    code = ''.join(random.choices(string.digits, k=6))
    expires_at = datetime.datetime.now() + datetime.timedelta(minutes=15)

    # Salva no MongoDB
    await collection_reset_tokens.update_one(
        {"email": email},
        {"$set": {"code": code, "expires_at": expires_at}},
        upsert=True
    )

    print(f"Código de recuperação para {email}: {code}")
    return {"msg": "Código de recuperação enviado"}

@app.post("/auth/reset-password")
async def reset_password(request: dict):
    email = request.get("email")
    code = request.get("code")
    new_password = request.get("newPassword")

    if not email or not code or not new_password:
        raise HTTPException(status_code=400, detail="Todos os campos são obrigatórios")

    stored = await collection_reset_tokens.find_one({"email": email})
    if not stored:
        raise HTTPException(status_code=400, detail="Nenhum código solicitado para este email")

    if stored["code"] != code:
        raise HTTPException(status_code=400, detail="Código inválido")

    if datetime.datetime.now() > stored["expires_at"]:
        await collection_reset_tokens.delete_one({"email": email})
        raise HTTPException(status_code=400, detail="Código expirado")

    # ✅ Gera hash da nova senha
    hashed_password = pwd_context.hash(new_password)

    # ✅ Atualiza a senha do usuário
    result = await users_collection.update_one(
        {"email": email},
        {"$set": {"password": hashed_password}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=500, detail="Falha ao atualizar senha")

    # ✅ Remove o código usado
    await collection_reset_tokens.delete_one({"email": email})

    return {"msg": "Senha redefinida com sucesso"}