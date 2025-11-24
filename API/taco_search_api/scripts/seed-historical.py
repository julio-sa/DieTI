#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed de histórico (365 dias) a partir da coleção de alimentos (taco_table / TACO).
- Para cada dia D nos últimos N dias (default 365):
  - escolhe K (~10) alimentos aleatórios
  - sorteia grams (30..300 g)
  - calcula macros por item (valores na coleção base estão por GRAMA)
  - insere todos os itens do dia em historical_food_log
  - upsert do total do dia em historical_intake

Requer:
  pip install motor python-dotenv

Ambiente esperado (iguais aos da sua API):
  MONGO_URI
  DB_NAME
  COLLECTION_NAME            -> coleção dos alimentos base (ex.: "taco_table")
  COLLECTION_NAME2           -> historical_intake
  COLLECTION_NAME4           -> historical_food_log
  (opcional) USER_ID         -> user alvo (default: "690e80cd7115ce452cd22688")
  (opcional) SEED_DAYS       -> qtd de dias (default: 365)
  (opcional) ITEMS_PER_DAY   -> itens por dia (default: 10)
  (opcional) GRAMS_MIN       -> mínimo de gramas (default: 30)
  (opcional) GRAMS_MAX       -> máximo de gramas (default: 300)
"""

import os
import asyncio
import random
import datetime
from decimal import Decimal, ROUND_HALF_UP

import motor.motor_asyncio
from bson import ObjectId
from dotenv import load_dotenv

# -----------------------
# Utils numéricos
# -----------------------
def f2(x: float) -> float:
    """Arredonda para 2 casas (modo 'comercial')."""
    return float(Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

def f1(x: float) -> float:
    """Arredonda para 1 casa."""
    return float(Decimal(x).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))

def coerce_float(v, default=0.0) -> float:
    try:
        if v is None:
            return default
        f = float(v)
        if f != f:  # NaN
            return default
        return f
    except Exception:
        return default

# -----------------------
# Main
# -----------------------
async def main():
    load_dotenv()

    mongo_uri = os.getenv("MONGO_URI")
    db_name   = os.getenv("DB_NAME")

    # coleções (mesmas envs da sua API)
    coll_food_name        = os.getenv("COLLECTION_NAME",  "taco_table")          # base de alimentos
    coll_hist_intake_name = os.getenv("COLLECTION_NAME2", "historical_intake")   # totais por dia
    coll_hist_log_name    = os.getenv("COLLECTION_NAME4", "historical_food_log") # itens por dia

    # parâmetros
    user_id     = os.getenv("USER_ID", "690e80cd7115ce452cd22688")
    seed_days   = int(os.getenv("SEED_DAYS", "365"))
    items_day   = int(os.getenv("ITEMS_PER_DAY", "10"))
    grams_min   = int(os.getenv("GRAMS_MIN", "30"))
    grams_max   = int(os.getenv("GRAMS_MAX", "300"))
    random_seed = os.getenv("RANDOM_SEED")
    if random_seed is not None:
        random.seed(int(random_seed))

    if not mongo_uri or not db_name:
        raise RuntimeError("Defina MONGO_URI e DB_NAME no ambiente (.env).")

    client = motor.motor_asyncio.AsyncIOMotorClient(mongo_uri)
    db = client[db_name]

    food_coll        = db[coll_food_name]
    hist_intake_coll = db[coll_hist_intake_name]
    hist_log_coll    = db[coll_hist_log_name]

    # Carrega um pool de alimentos (pode limitar se desejar)
    print("Carregando alimentos da coleção base...")
    foods_cursor = food_coll.find({}, {"_id": 1, "description": 1,
                                       "calorias_kcal": 1, "proteinas_g": 1,
                                       "carbo_g": 1, "gordura_g": 1})
    foods = await foods_cursor.to_list(length=5000)
    if len(foods) < items_day:
        raise RuntimeError(f"Poucos alimentos ({len(foods)}) < ITEMS_PER_DAY ({items_day}).")

    print(f"Total de alimentos disponíveis: {len(foods)}")

    today = datetime.date.today()

    # Para evitar explosionar/duplicar dados, opcionalmente limpamos o período antes (comente se não quiser)
    # ATENÇÃO: isso apaga SEU histórico desse user no range!
    start_date = today - datetime.timedelta(days=seed_days-1)
    print(f"Limpando histórico de {start_date} a {today} para user_id={user_id}...")
    await hist_log_coll.delete_many({
        "user_id": user_id,
        "date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": today.strftime("%Y-%m-%d")}
    })
    await hist_intake_coll.delete_many({
        "user_id": user_id,
        "date": {"$gte": start_date.strftime("%Y-%m-%d"), "$lte": today.strftime("%Y-%m-%d")}
    })

    # Semear dia a dia
    print("Iniciando seed...")
    inserted_logs = 0
    upserts_totals = 0

    for delta in range(seed_days):
        the_date = today - datetime.timedelta(days=(seed_days - 1 - delta))
        date_str = the_date.strftime("%Y-%m-%d")

        # escolhe itens distintos para o dia
        day_foods = random.sample(foods, items_day)

        # acumula totais do dia
        t_cal = 0.0
        t_pro = 0.0
        t_carb = 0.0
        t_gor = 0.0

        # insere itens no historical_food_log
        bulk_logs = []
        for food in day_foods:
            grams = random.randint(grams_min, grams_max)

            cal_per_g  = coerce_float(food.get("calorias_kcal"), 0.0)
            pro_per_g  = coerce_float(food.get("proteinas_g"),   0.0)
            carb_per_g = coerce_float(food.get("carbo_g"),       0.0)
            gor_per_g  = coerce_float(food.get("gordura_g"),     0.0)

            cal  = cal_per_g  * grams
            pro  = pro_per_g  * grams
            carb = carb_per_g * grams
            gor  = gor_per_g  * grams

            t_cal += cal
            t_pro += pro
            t_carb += carb
            t_gor += gor

            log_doc = {
                "_id": ObjectId(),  # mantém compatível com seu endpoint
                "user_id": user_id,
                "description": food.get("description", "item"),
                "grams": grams,
                "calorias": f1(cal),       # uma casa fica legal no tooltip
                "proteinas": f2(pro),
                "carbo": f2(carb),
                "gordura": f2(gor),
                "date": date_str
            }
            bulk_logs.append(log_doc)

        if bulk_logs:
            await hist_log_coll.insert_many(bulk_logs)
            inserted_logs += len(bulk_logs)

        # upsert do total do dia em historical_intake
        total_doc = {
            "user_id": user_id,
            "date": date_str,
            "calorias": f1(t_cal),
            "proteinas": f2(t_pro),
            "carbo": f2(t_carb),
            "gordura": f2(t_gor),
        }
        await hist_intake_coll.update_one(
            {"user_id": user_id, "date": date_str},
            {"$set": total_doc},
            upsert=True
        )
        upserts_totals += 1

        if (delta + 1) % 30 == 0:
            print(f"  -> {delta + 1} dias semeados...")

    print(f"\nConcluído!\nItens inseridos em historical_food_log: {inserted_logs}")
    print(f"Totais upsertados em historical_intake: {upserts_totals}")

if __name__ == "__main__":
    asyncio.run(main())
