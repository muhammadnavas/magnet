# Magnet

> **Capture. Understand. Remember.**
>
> An AI-powered personal second brain for developers and knowledge workers.

Magnet is a personal knowledge and productivity system designed to turn scattered information into searchable, connected, and useful knowledge.

Instead of keeping PDFs, notes, screenshots, GitHub repositories, error messages, tasks, and conversations in separate places, Magnet is designed to bring them together and make them available through semantic search and AI-powered retrieval.

---

## ✨ Vision

The goal of Magnet is simple:

> **Capture anything you learn or work on, let Magnet understand it, and retrieve it when you need it.**

Typical questions Magnet should eventually answer include:

- What did I learn about Docker recently?
- Show me everything related to my AI Interviewer project.
- Why did I previously get this FastAPI error?
- What have I learned about RAG?
- Which technologies have I been working with recently?
- What tasks are pending for a project?
- What knowledge am I missing for a particular project?

Magnet combines **personal knowledge management, RAG, project context, developer error memory, and task management** into one system.

---

## 🧠 Core Concept

Magnet is built around a continuous knowledge loop:

```text
Capture
   ↓
Understand
   ↓
Organize
   ↓
Index
   ↓
Retrieve
   ↓
Answer
   ↓
Act
```

For example:

```text
PDF / Note / GitHub / Screenshot / Error
                ↓
          Magnet ingestion
                ↓
       Extract & understand
                ↓
        Chunk the content
                ↓
          Generate embeddings
                ↓
       PostgreSQL + pgvector
                ↓
         Semantic retrieval
                ↓
              RAG
                ↓
       AI answer + citations
```

---

# 🚀 Features

## 📱 Mobile Application

Magnet uses an Expo React Native mobile application as the primary user interface.

Current application areas include:

- Home dashboard
- Knowledge library
- Ask AI
- Capture
- Tasks
- Profile / Settings
- Chat conversations
- Knowledge details
- Project details
- Light and dark themes
- Authentication state management
- Local secure token storage

The frontend is implemented using **JavaScript / JSX**, not TypeScript.

---

## 📥 Capture

The Capture experience is intended to be the primary entry point for adding information to Magnet.

Potential knowledge sources include:

- PDF documents
- Text and notes
- Screenshots and images
- URLs
- GitHub repositories and source files
- Developer errors
- Voice notes
- Other useful personal information

The ingestion system can then transform the captured information into structured and searchable knowledge.

---

## 📚 Knowledge Vault

The Knowledge section provides a centralized view of captured information.

Each knowledge item can eventually contain information such as:

- Title
- Source
- Content
- Summary
- Topics
- Technologies
- Project association
- Processing status
- Related knowledge
- Embeddings
- Metadata
- Citations / source references

The objective is not simply to store files, but to make the information inside those files useful.

---

## 🤖 Ask AI

Ask AI is Magnet's natural-language interface to the user's knowledge base.

Instead of relying only on general model knowledge, Magnet is designed to retrieve relevant personal knowledge before generating an answer.

Example:

```text
User:
What did I learn about Redis last week?

        ↓

Query embedding / search
        ↓

Relevant personal knowledge
        ↓

Context construction
        ↓

LLM
        ↓

Answer + citations
```

This is the core **Retrieval-Augmented Generation (RAG)** workflow.

---

## 🧩 Projects

Projects provide a way to group related knowledge and work.

A project can connect:

```text
Project
 ├── Documents
 ├── Notes
 ├── GitHub repositories
 ├── Technologies
 ├── Errors
 ├── Conversations
 └── Tasks
```

This enables project-aware questions such as:

> "What is left to finish on this project?"

or:

> "What problems have I previously encountered in this project?"

---

## 🐙 GitHub Integration

Magnet includes a GitHub integration direction for importing source code and repository information into the knowledge system.

The intended workflow is selective rather than blindly importing everything:

```text
Connect GitHub
      ↓
Select repository
      ↓
Select relevant content
      ↓
Import
      ↓
Process
      ↓
Index
      ↓
Ask questions about the code
```

This allows Magnet to provide context-aware assistance around personal projects and codebases.

---

## 🐛 Developer Error Memory

One of Magnet's key differentiating ideas is **Developer Error Memory**.

When a developer encounters an error, Magnet can store information such as:

```text
Error
 ├── Error message
 ├── Stack trace
 ├── Project
 ├── Environment
 ├── Context
 ├── Solution
 └── Embedding
```

When a similar error occurs later:

```text
New error
   ↓
Generate embedding
   ↓
Similarity search
   ↓
Find previous errors
   ↓
Retrieve previous solutions
   ↓
AI explanation
```

The goal is for Magnet to effectively remember how the developer solved problems in the past.

---

## ✅ Tasks

Magnet also includes task management so knowledge can lead to action.

Tasks can eventually be connected with:

- Projects
- Technologies
- Knowledge items
- Errors
- AI recommendations

This creates the broader workflow:

```text
Capture → Understand → Remember → Act
```

Task reminders can be handled on the mobile side while heavier processing remains suitable for backend workers.

---

# 🏗️ Architecture

Magnet follows a mobile + API + worker architecture.

```text
┌──────────────────────────────┐
│       Expo React Native      │
│          JavaScript/JSX     │
│                              │
│ Home | Knowledge | Ask AI    │
│ Capture | Tasks | Settings   │
└──────────────┬───────────────┘
               │ HTTPS / REST
               ▼
┌──────────────────────────────┐
│          FastAPI API         │
│                              │
│ Auth / Knowledge / Chat      │
│ Tasks / Projects / Search    │
└───────┬───────────┬──────────┘
        │           │
        │           ▼
        │     ┌───────────────┐
        │     │     Redis     │
        │     │ Queue / Cache │
        │     └───────┬───────┘
        │             │
        │             ▼
        │     ┌───────────────┐
        │     │ ARQ Worker    │
        │     │               │
        │     │ Extraction    │
        │     │ Chunking      │
        │     │ Embeddings    │
        │     │ Processing    │
        │     └───────┬───────┘
        │             │
        ▼             ▼
┌──────────────────────────────┐
│ PostgreSQL + pgvector        │
│                              │
│ Structured data + vectors    │
│ Knowledge / Tasks / Projects │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│        External Services     │
│                              │
│ Google Drive / LLM / GitHub │
└──────────────────────────────┘
```

---

# 🛠️ Technology Stack

## Frontend

- **Expo**
- **React Native**
- **JavaScript / JSX**
- **Expo Router**
- **NativeWind**
- **Zustand** for client state
- **TanStack Query** for server state
- **React Hook Form** where forms require it
- **Zod** for validation where applicable
- Expo SecureStore for sensitive local data
- Expo Notifications for task reminders / notifications

## Backend

- **Python**
- **FastAPI**
- **SQLAlchemy**
- **PostgreSQL**
- **pgvector**
- **Alembic**
- **Redis**
- **ARQ** for background jobs
- JWT-based authentication

## AI

The backend is designed around an abstraction that can support LLM and embedding providers without coupling the mobile application directly to provider credentials.

The AI layer is responsible for tasks such as:

- Summarization
- Topic extraction
- Classification
- Embeddings
- RAG answer generation
- Knowledge connections
- Error analysis
- AI recommendations

## Storage

Binary files such as documents and images can be stored externally, with Magnet keeping the searchable metadata, extracted content, relationships, and vectors in PostgreSQL.

Google Drive is one of the intended storage integrations.

## Infrastructure

- Docker
- Docker Compose
- PostgreSQL / pgvector container
- Redis container
- API container
- Worker container

---

# 📂 Project Structure

```text
Magnet/
│
├── app/                         # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.jsx           # Home
│   │   ├── knowledge.jsx       # Knowledge library
│   │   ├── ask.jsx             # Ask AI
│   │   ├── capture.jsx         # Capture
│   │   ├── tasks.jsx           # Tasks
│   │   └── profile.jsx         # Profile / settings
│   │
│   ├── chat/[id].jsx           # Chat detail
│   ├── knowledge/[id].jsx      # Knowledge detail
│   ├── projects/[id].jsx       # Project detail
│   └── _layout.jsx             # Root navigation/providers
│
├── components/                 # Reusable React Native components
├── constants/                  # Application configuration/constants
├── hooks/                      # React Query and application hooks
├── lib/                        # API and local storage helpers
├── store/                      # Zustand stores
├── assets/                     # Images, icons and other assets
│
├── backend/
│   ├── app/                    # FastAPI application
│   ├── alembic/                # Database migrations
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── README.md
│
├── docs/                       # Architecture/integration documentation
├── app.json                    # Expo configuration
├── eas.json                    # Expo Application Services configuration
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
└── README.md
```

---

# 🔄 Knowledge Processing Pipeline

A typical document processing flow is designed to work asynchronously.

```text
1. User uploads a document
          ↓
2. FastAPI creates knowledge record
          ↓
3. File is stored externally
          ↓
4. Processing job is queued in Redis
          ↓
5. ARQ worker picks up the job
          ↓
6. Content is extracted
          ↓
7. Text is cleaned and normalized
          ↓
8. Content is divided into chunks
          ↓
9. Embeddings are generated
          ↓
10. Chunks + vectors are stored
          ↓
11. Knowledge status becomes completed
          ↓
12. Content becomes available to search/RAG
```

Background processing prevents expensive operations such as document extraction and embedding generation from blocking normal API requests.

---

# 🔎 Retrieval and RAG

The intended retrieval architecture combines semantic similarity with structured metadata.

A simplified flow:

```text
User question
      ↓
Query understanding
      ↓
Query embedding
      ↓
Vector similarity search
      +
Metadata filtering
      ↓
Relevant chunks
      ↓
Context builder
      ↓
LLM
      ↓
Grounded answer
      ↓
Citations
```

Future retrieval improvements can include:

- Hybrid keyword + vector search
- Project-aware retrieval
- Technology/topic filters
- Recency-aware retrieval
- Conversation-aware retrieval
- Re-ranking
- Knowledge graph expansion

---

# 🕸️ Knowledge Graph Direction

Magnet can evolve beyond isolated documents into a connected knowledge graph.

Example relationships:

```text
Project ──uses──> Technology
   │
   ├──contains──> Document
   │
   ├──has──> Task
   │
   └──experienced──> Error

Document ──discusses──> Concept

Error ──solved_by──> Solution

Technology ──related_to──> Technology
```

These relationships can improve retrieval and enable higher-level insights about the user's knowledge.

---

# 🔐 Security Principles

Magnet should follow these principles throughout development:

- Never place LLM/API secrets in the mobile application.
- Store authentication tokens securely on the device.
- Use environment variables for server-side credentials.
- Keep private documents protected by authenticated APIs.
- Validate uploaded files and input data.
- Apply authorization checks to user-owned resources.
- Do not expose service-account credentials in source control.
- Use HTTPS in production.
- Rotate credentials if they are accidentally committed.

**Important:** local credential files such as Google service credentials or OAuth tokens should never be committed to Git. They should be ignored and supplied through secure environment/secret management.

---

# 🐳 Local Development

## Prerequisites

Install:

- Node.js
- npm
- Expo CLI / Expo tooling
- Python 3.x
- Docker Desktop
- Git

For the backend, Docker is recommended because PostgreSQL/pgvector and Redis are part of the development environment.

## Start the backend

From the backend directory:

```bash
cd backend
docker compose up --build
```

The backend exposes the FastAPI application and its API documentation according to the configured Docker environment.

FastAPI documentation is available through:

```text
/docs
/redoc
```

## Start the mobile application

From the repository root:

```bash
npm install
npx expo start
```

Then use the Expo development workflow to open the application on an emulator or physical device.

---

# ⚙️ Environment Configuration

Environment-specific configuration should be provided through environment variables rather than committed secrets.

The mobile application uses the configured backend API URL, for example:

```text
EXPO_PUBLIC_API_URL=<your-api-url>
```

Backend configuration should contain the required database, Redis, authentication, AI-provider, storage, and integration credentials through environment variables or a secure secret manager.

Do not commit real credentials to the repository.

---

# 🗃️ Database and Migrations

PostgreSQL is the primary structured data store.

pgvector is used for vector similarity search.

Alembic is used to version database schema changes.

The intended workflow is:

```text
Change SQLAlchemy model
        ↓
Create Alembic migration
        ↓
Review migration
        ↓
Run migration
        ↓
Test
```

Do not manually modify production schemas when a migration can represent the change.

---

# ⚡ Background Jobs

Long-running operations should be processed asynchronously.

Suitable worker jobs include:

- PDF extraction
- OCR
- Text processing
- Chunking
- Embedding generation
- GitHub imports
- URL processing
- Voice transcription
- Knowledge graph updates
- AI enrichment

Redis acts as the queue backend and ARQ provides the Python worker implementation.

The API should return quickly after queuing expensive work instead of making the mobile client wait for the entire processing operation.

---

# 🧪 Testing Strategy

Testing should cover both individual components and complete user workflows.

## Backend

Test:

- Authentication
- CRUD operations
- Database models
- Migrations
- Vector search
- RAG retrieval
- Worker jobs
- Failure/retry behavior
- File processing
- Authorization

## Frontend

Test:

- Navigation
- Authentication state
- Loading states
- Empty states
- Error states
- Search
- Capture
- Tasks
- Chat
- Theme switching
- API failures

## End-to-End

The most important scenario is:

```text
Upload PDF
   ↓
Processing
   ↓
Completed
   ↓
Search
   ↓
Ask question
   ↓
Retrieve correct content
   ↓
Generate grounded answer
   ↓
Show citation
```

---

# 🗺️ Roadmap

## Phase 1 — Core Infrastructure

- [x] Expo mobile application foundation
- [x] Core navigation and screens
- [x] FastAPI backend foundation
- [x] PostgreSQL integration
- [x] Alembic migrations
- [x] Authentication foundation
- [x] Redis / background-job architecture
- [ ] Production-ready deployment

## Phase 2 — Knowledge Engine

- [ ] Reliable PDF ingestion
- [ ] Text ingestion
- [ ] Content extraction
- [ ] Chunking
- [ ] Embedding generation
- [ ] pgvector retrieval
- [ ] Processing status and retries
- [ ] Duplicate detection

## Phase 3 — RAG

- [ ] End-to-end retrieval pipeline
- [ ] Context construction
- [ ] Grounded generation
- [ ] Source citations
- [ ] Hybrid retrieval
- [ ] Retrieval evaluation

## Phase 4 — Integrations

- [ ] Google Drive lifecycle
- [ ] GitHub repository selection/import
- [ ] URL ingestion
- [ ] Image/OCR processing
- [ ] Voice-note processing

## Phase 5 — Intelligence

- [ ] Developer Error Memory
- [ ] Knowledge graph
- [ ] Related knowledge suggestions
- [ ] Knowledge-gap detection
- [ ] Learning recommendations
- [ ] Project intelligence

## Phase 6 — Productivity

- [x] Tasks UI and foundation
- [ ] Knowledge ↔ Task relationships
- [ ] Project ↔ Task relationships
- [ ] AI-generated task suggestions
- [ ] Smarter reminders

## Phase 7 — Production

- [ ] Automated tests
- [ ] CI/CD
- [ ] Production database
- [ ] Production worker
- [ ] Monitoring and logging
- [ ] Backups
- [ ] Rate limiting
- [ ] Security audit
- [ ] Mobile release

---

# 📊 Current Project Status

Magnet is an active work-in-progress with a substantially developed mobile UI and backend foundation.

The current priority is moving from **feature foundation** to a reliable **end-to-end knowledge/RAG workflow**.

The most important milestone is:

> **Capture → Process → Index → Retrieve → Answer with citations**

Once this workflow is reliable, additional intelligence such as developer error memory, knowledge graphs, project intelligence, and recommendations can be layered on top.

---

# 🎯 MVP Definition

Magnet's first meaningful MVP is complete when a user can:

1. Capture a real piece of knowledge.
2. Have Magnet process it in the background.
3. Store searchable structured content and embeddings.
4. Ask a natural-language question later.
5. Retrieve relevant personal knowledge.
6. Receive a grounded AI answer.
7. See the source/citation behind the answer.

Everything beyond this improves the product, but this is the core capability that makes Magnet a genuine personal second brain.

---

# 🤝 Development Philosophy

Magnet is being built around a few principles:

### Build for real data

Avoid relying on mock knowledge once a feature reaches implementation stage.

### Keep the mobile app thin

AI keys, database credentials, vector search, and heavy processing belong on the backend.

### Process expensive work asynchronously

The API should coordinate work; background workers should perform expensive processing.

### Make knowledge reusable

A captured piece of information should be useful across search, chat, projects, tasks, and future AI features.

### Prefer connected knowledge over isolated records

Projects, technologies, documents, errors, tasks, and conversations should eventually reinforce one another.

---

# 📄 License

This project is licensed under the **MIT License**.

---

## Magnet

**Capture. Understand. Remember.**

Built as a personal AI-powered second brain for learning, development, and productivity.
