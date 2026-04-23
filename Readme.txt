# RAGmind — Document Intelligence Chatbot

A slick, production-grade RAG (Retrieval-Augmented Generation) chatbot that lets you upload any PDF and ask natural-language questions about it. All processing is **100% local** — no data sent to the cloud.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│               Browser (Custom UI)                │
│  Dark editorial design · Drag-and-drop upload    │
└─────────────────┬────────────────────────────────┘
                  │  HTTP (Flask)
┌─────────────────▼────────────────────────────────┐
│                  app.py  (Flask)                 │
│   /upload → index PDF                            │
│   /chat   → answer question                      │
└────┬──────────────────────┬───────────────────────┘
     │                      │
┌────▼────────┐    ┌────────▼──────────┐
│document_    │    │  rag_pipeline.py  │
│loader.py    │    │  build_rag_chain  │
│PyPDF +      │    │  ask_question     │
│TextSplitter │    └────────┬──────────┘
└────┬────────┘             │
     │              ┌───────▼──────────┐
┌────▼────────┐    │  vector_store.py │
│  ChromaDB   │◄───│  HuggingFace     │
│  (local)    │    │  Embeddings      │
└─────────────┘    └───────┬──────────┘
                           │
                   ┌───────▼──────────┐
                   │  Ollama (Mistral)│
                   │  Local LLM       │
                   └──────────────────┘
```

---

## Quick Start

### 1. Install Ollama and pull Mistral

```bash
# Install from https://ollama.ai
ollama pull mistral
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the server

```bash
python app.py
# Open http://localhost:7860
```

---

## File Structure

```
rag_chatbot/
├── app.py               # Flask server (replaces Gradio)
├── document_loader.py   # PDF loading + text splitting
├── vector_store.py      # ChromaDB + HuggingFace embeddings
├── rag_pipeline.py      # LangChain RAG chain
├── requirements.txt
├── templates/
│   └── index.html       # SPA shell
└── static/
    ├── css/style.css    # Dark editorial UI
    └── js/main.js       # Frontend logic
```

---

## Key Improvements Over Original

| Original | Improved |
|---|---|
| Gradio (generic UI) | Custom Flask + HTML/CSS/JS |
| No logging | Structured logging throughout |
| No error handling | Full try/except with user-friendly messages |
| Bare source list | Formatted source tags with page numbers |
| Single global chain | Clean module boundaries, type hints |
| No drag-and-drop | Drag-and-drop + click upload |
| Static responses | Typing indicator + animated UI |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7860` | Port for Flask server |