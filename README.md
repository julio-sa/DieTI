# DieTI — Alimente sua Saúde  
> **PT-BR primeiro** •  **EN** version below

[English version ↓](#dieti--feed-your-health)

---

## ✨ Visão Geral

**DieTI** é uma **PWA (Progressive Web App)** focada em **monitorar macronutrientes** de forma simples e rápida, com **experiência mobile-first**. O projeto está organizado em **frontend (Angular SPA)** e **backend (Node.js + Next.js)**, com **MongoDB** como banco de dados. Integra dados nutricionais a partir da base **TACO** (Tabela Brasileira de Composição de Alimentos).

> Este repositório compõe um projeto acadêmico (TCC) e está em evolução contínua.

---

## 🔗 Sumário

- [Visão Geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [Funcionalidades](#-funcionalidades)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Como Rodar (Dev)](#-como-rodar-dev)
  - [Backend (Next.js + Node)](#backend-nextjs--node)
  - [Frontend (Angular)](#frontend-angular)
  - [Carga da Base TACO (opcional)](#carga-da-base-taco-opcional)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Roadmap](#-roadmap)
- [Contribuição](#-contribuição)
- [Licença](#-licença)
- [English Version](#dieti--feed-your-health)

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                         DieTI (PWA)                         │
│                                                             │
│  Frontend (Angular SPA)  ⇄  Backend API (Next.js + Node)    │
│         UI/UX mobile-first            REST/Routes           │
│                                                             │
│                       MongoDB (Atlas/local)                 │
│                 Coleções: alimentos, usuários, registros    │
│                                                             │
│        Integrações: Base TACO / scripts de importação       │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Funcionalidades

- **Cadastro de alimentos e porções** com base na **TACO**.  
- **Cálculo de macros** (kcal, proteínas, gorduras, carboidratos) por dia/período.  
- **Dashboard** com visão diária e por intervalo de datas.  
- **PWA**: instala no celular; cache básico para navegação offline.  
- **Autenticação** (em andamento) e **CRUD** das entradas.

> Observação: alguns itens podem estar em desenvolvimento conforme os commits.

---

## 📁 Estrutura do Repositório

```
DieTI/
├─ backend/           # Next.js + Node (API, rotas, autenticação, etc.)
├─ frontend/          # Angular SPA (UI/UX, PWA)
├─ scripts/           # (opcional) utilidades, importadores, etc.
└─ README.md
```

> A estrutura pode evoluir; verifique os commits mais recentes.

---

## 🧪 Como Rodar (Dev)

### Backend (Next.js + Node)

1. **Pré-requisitos**  
   - Node.js LTS (>= 18)  
   - MongoDB (Atlas ou local)

2. **Instalação**
   ```bash
   cd backend
   npm install
   ```

3. **Configuração de ambiente**  
   Crie um `.env` na pasta `backend` com, por exemplo:
   ```env
   MONGO_URI=mongodb+srv://usuario:senha@cluster/DieTI
   DB_NAME=dieti
   JWT_SECRET=uma_chave_segura
   PORT=3000
   ```

4. **Rodando**
   ```bash
   npm run dev
   ```
   API disponível em `http://localhost:3000` (ajuste conforme seus scripts).

---

### Frontend (Angular)

1. **Pré-requisitos**
   - Node.js LTS (>= 18)
   - Angular CLI (global): `npm i -g @angular/cli` (opcional)

2. **Instalação**
   ```bash
   cd frontend
   npm install
   ```

3. **Configuração de ambiente**  
   Ajuste `environment.ts`/variáveis para apontar para a API do backend, por exemplo:
   ```ts
   export const environment = {
     production: false,
     apiBaseUrl: 'http://localhost:3000'
   };
   ```

4. **Rodando**
   ```bash
   npm start
   # ou
   ng serve
   ```
   Acesse `http://localhost:4200`.

> Como o projeto é **PWA**, ao abrir no celular você poderá **instalar o app** a partir do navegador.

---

### Carga da Base TACO (opcional)

Se desejar popular o banco com a base TACO a partir de uma planilha:

1. Coloque o arquivo (ex.: `Taco-4a-Edicao.xlsx`) na raiz ou pasta indicada pelo script.  
2. Crie um `.env` para o script (conforme o código Python/Node que você usar):
   ```env
   MONGO_URI=...
   DB_NAME=dieti
   COLLECTION_NAME=taco_table
   ```
3. Execute o script de importação correspondente que mapeia as colunas **TACO** → **DieTI** (por ex., `_id`, `description`, `calorias_kcal`, `proteinas_g`, `gordura_g`, `carboidratos_g`).

> Dica: normalize unidades e casas decimais antes de inserir.

---

## 🔐 Variáveis de Ambiente

**Backend (.env)**  
```env
MONGO_URI=
DB_NAME=
JWT_SECRET=
PORT=3000
```

**Frontend (environment)**  
```ts
apiBaseUrl= // URL da API (ex.: http://localhost:3000)
```

**Scripts TACO (opcional)**  
```env
MONGO_URI=
DB_NAME=
COLLECTION_NAME=taco_table
```

---

## 🗺 Roadmap

- [ ] Autenticação completa (login/registro/recuperação).  
- [ ] CRUD de refeições com UI refinada.  
- [ ] Filtros por período + gráficos comparativos.  
- [ ] Melhorias PWA (cache dinâmico/estratégias offline).  
- [ ] Testes automatizados (unit e e2e).  
- [ ] CI/CD (lint, build, deploy).  

---

## 🤝 Contribuição

1. Faça um fork do repositório.  
2. Crie uma branch a partir de `main`: `feat/minha-feature`.  
3. Abra um PR descrevendo claramente a mudança e como testar.

Issues e sugestões são bem-vindas!

---

## 📜 Licença


---

# DieTI — Feed Your Health
> **English version**

---

## ✨ Overview

**DieTI** is a **Progressive Web App** to **track macronutrients** with a **mobile-first** UX. The project is split into a **frontend (Angular SPA)** and a **backend (Node.js + Next.js)** using **MongoDB**. It integrates the Brazilian **TACO food composition database** for nutrition data.

> This repository is part of a graduation project and is under active development.

---

## 🔗 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture-1)
- [Features](#-features)
- [Repository Structure](#-repository-structure)
- [Getting Started (Dev)](#-getting-started-dev)
  - [Backend (Next.js + Node)](#backend-nextjs--node-1)
  - [Frontend (Angular)](#frontend-angular-1)
  - [Loading the TACO Dataset (optional)](#loading-the-taco-dataset-optional)
- [Environment Variables](#-environment-variables)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         DieTI (PWA)                         │
│                                                             │
│  Frontend (Angular SPA)  ⇄  Backend API (Next.js + Node)    │
│         Mobile-first UI              REST/Routes            │
│                                                             │
│                       MongoDB (Atlas/local)                 │
│                 Collections: foods, users, records          │
│                                                             │
│     Integrations: TACO dataset / import scripts             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Features

- **Food & portion logging** using **TACO** nutrition data.  
- **Macro calculations** (kcal, protein, fat, carbs) per day/period.  
- **Dashboard** with daily and date-range views.  
- **PWA**: installable on mobile; basic offline caching.  
- **Auth** (in progress) and **CRUD** for entries.

---

## 📁 Repository Structure

```
DieTI/
├─ backend/           # Next.js + Node (API, routes, auth, etc.)
├─ frontend/          # Angular SPA (UI/UX, PWA)
├─ scripts/           # (optional) utilities, importers, etc.
└─ README.md
```

(Exact layout may evolve; check latest commits.)

---

## 🧪 Getting Started (Dev)

### Backend (Next.js + Node)

1. **Prerequisites**  
   - Node.js LTS (>= 18)  
   - MongoDB (Atlas or local)

2. **Install**
   ```bash
   cd backend
   npm install
   ```

3. **Environment**
   Create `backend/.env`:
   ```env
   MONGO_URI=mongodb+srv://user:pass@cluster/DieTI
   DB_NAME=dieti
   JWT_SECRET=a_secure_secret
   PORT=3000
   ```

4. **Run**
   ```bash
   npm run dev
   ```
   API on `http://localhost:3000` (adjust to your scripts).

---

### Frontend (Angular)

1. **Prerequisites**
   - Node.js LTS (>= 18)
   - Angular CLI: `npm i -g @angular/cli` (optional)

2. **Install**
   ```bash
   cd frontend
   npm install
   ```

3. **Environment**
   Point to your backend:
   ```ts
   export const environment = {
     production: false,
     apiBaseUrl: 'http://localhost:3000'
   };
   ```

4. **Run**
   ```bash
   npm start
   # or
   ng serve
   ```
   Open `http://localhost:4200`.

---

### Loading the TACO Dataset (optional)

1. Place the spreadsheet (e.g., `Taco-4a-Edicao.xlsx`) where the import script expects it.  
2. Provide an `.env` for the script:
   ```env
   MONGO_URI=...
   DB_NAME=dieti
   COLLECTION_NAME=alimentos
   ```
3. Run the import script that maps TACO columns into DieTI fields (e.g., `_id`, `description`, `calorias_kcal`, `proteinas_g`, `gordura_g`, `carboidratos_g`).

---

## 🔐 Environment Variables

**Backend (.env)**  
```env
MONGO_URI=
DB_NAME=
JWT_SECRET=
PORT=3000
```

**Frontend (environment)**  
```ts
apiBaseUrl= // ex: http://localhost:3000
```

**TACO import (optional)**  
```env
MONGO_URI=
DB_NAME=
COLLECTION_NAME=taco_table
```

---

## 🗺 Roadmap

- [ ] Full auth (sign-up/sign-in/password recovery)  
- [ ] Meals CRUD with refined UX  
- [ ] Range filters + comparative charts  
- [ ] PWA improvements (dynamic caching/offline strategies)  
- [ ] Automated tests (unit & e2e)  
- [ ] CI/CD (lint, build, deploy)

---

## 🤝 Contributing

1. Fork the repo  
2. Create a feature branch from `main`: `feat/my-feature`  
3. Open a PR with clear testing steps

All suggestions are welcome!

---

## 📜 License
