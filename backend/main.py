
import os
import hashlib
from io import BytesIO
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from pinecone import Pinecone
from pypdf import PdfReader

load_dotenv()

app = FastAPI(title="AI Interview Preparation API")

# Keep this compatible with your React + Vite development server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
PINECONE_NAMESPACE = os.getenv(
    "PINECONE_NAMESPACE", "interview-pdfs"
)

MAX_PDF_SIZE = 15 * 1024 * 1024  # 15 MB
CHUNK_SIZE = 1000                # characters
CHUNK_OVERLAP = 150              # characters
TOP_K = 5                        # retrieved passages


def get_pinecone_index():
    """Connect to the existing Pinecone integrated embedding index."""
    if not PINECONE_API_KEY or not PINECONE_INDEX_NAME:
        raise HTTPException(
            status_code=503,
            detail="Pinecone API key or index name is not configured.",
        )

    pc = Pinecone(api_key=PINECONE_API_KEY)
    return pc.index(PINECONE_INDEX_NAME)


def split_text(text: str):
    """Split text into chunks with a small overlap."""
    text = " ".join(text.split())

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end == len(text):
            break

        start = end - CHUNK_OVERLAP

    return chunks


class InterviewQuestion(BaseModel):
    question: str


@app.get("/health")
def health():
    """Basic API health check; does not call external services."""
    return {"status": "ok"}


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    """Extract a PDF's text, split it into chunks, and index them."""
    filename = Path(file.filename or "document.pdf").name

    if Path(filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    pdf_bytes = await file.read()

    if not pdf_bytes:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(pdf_bytes) > MAX_PDF_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF is too large. Maximum size is 15 MB.",
        )

    try:
        reader = PdfReader(BytesIO(pdf_bytes))

        if reader.is_encrypted:
            raise HTTPException(
                status_code=400,
                detail="Password-protected PDFs are not supported.",
            )

        # Extract and chunk text separately for each page.
        page_chunks = []

        for page_number, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text() or ""

            for chunk_number, chunk in enumerate(
                split_text(page_text), start=1
            ):
                page_chunks.append(
                    {
                        "page": page_number,
                        "chunk_number": chunk_number,
                        "text": chunk,
                    }
                )

    except HTTPException:
        raise
    except Exception as exc:
        print("PDF EXTRACTION ERROR:", type(exc).__name__, str(exc))
        raise HTTPException(
            status_code=400,
            detail="Could not read this PDF. Check that it is a valid PDF.",
        ) from exc

    if not page_chunks:
        raise HTTPException(
            status_code=422,
            detail=(
                "No readable text was found. This may be a scanned PDF; "
                "OCR support is not included in this version."
            ),
        )

    # Use a content hash so uploading the same PDF produces stable IDs.
    file_hash = hashlib.sha256(pdf_bytes).hexdigest()[:20]
    records = []

    for item in page_chunks:
        record_id = (
            f"{file_hash}-p{item['page']}-c{item['chunk_number']}"
        )

        records.append(
            {
                "_id": record_id,
                "chunk_text": item["text"],
                "filename": filename,
                "page": item["page"],
                "chunk_number": item["chunk_number"],
                "file_hash": file_hash,
            }
        )

    try:
        index = get_pinecone_index()

        # Integrated inference embeds chunk_text on the Pinecone side.
        # Batch the records to avoid oversized requests.
        batch_size = 50

        for start in range(0, len(records), batch_size):
            index.upsert_records(
                namespace=PINECONE_NAMESPACE,
                records=records[start : start + batch_size],
            )

    except HTTPException:
        raise
    except Exception as exc:
        print("PINECONE INDEXING ERROR:", type(exc).__name__, str(exc))
        raise HTTPException(
            status_code=502,
            detail="Could not index the PDF in Pinecone. Check backend logs.",
        ) from exc

    return {
        "message": "PDF uploaded and indexed successfully.",
        "filename": filename,
        "pages_read": len(reader.pages),
        "chunks_indexed": len(records),
        "namespace": PINECONE_NAMESPACE,
    }


def retrieve_context(question: str):
    """Find the most relevant indexed passages for a question."""
    index = get_pinecone_index()

    results = index.search(
        namespace=PINECONE_NAMESPACE,
        top_k=TOP_K,
        inputs={"text": question},
    )

    context_parts = []
    sources = []

    for hit in results.result.hits:
        fields = hit.fields or {}
        passage = fields.get("chunk_text", "")

        if not passage:
            continue

        filename = fields.get("filename", "Unknown PDF")
        page = fields.get("page", "Unknown")

        context_parts.append(
            f"Source: {filename}, page {page}\n{passage}"
        )

        sources.append(
            {
                "filename": filename,
                "page": page,
                "score": getattr(hit, "score", None),
            }
        )

    return "\n\n---\n\n".join(context_parts), sources


@app.post("/ask")
def ask_question(request: InterviewQuestion):
    """Retrieve PDF context when available, then ask Groq to answer."""
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured.",
        )

    context = ""
    sources = []

    # RAG is attempted when Pinecone is configured.
    # If the index has no matching records, answer generally.
    if PINECONE_API_KEY and PINECONE_INDEX_NAME:
        try:
            context, sources = retrieve_context(question)
        except Exception as exc:
            print("PINECONE RETRIEVAL ERROR:", type(exc).__name__, str(exc))
            raise HTTPException(
                status_code=502,
                detail="Could not retrieve information from Pinecone.",
            ) from exc

    if context:
        system_prompt = (
            "You are a friendly technical interview tutor. "
            "Use the supplied PDF passages as your primary source. "
            "If the passages do not contain the answer, say so clearly "
            "and then, if useful, provide general knowledge separately. "
            "Never invent quotes, page numbers, or source details. "
            "Explain answers for beginners, with examples or code when useful."
        )

        user_prompt = (
            f"Question:\n{question}\n\n"
            f"Retrieved PDF passages:\n{context}\n\n"
            "Answer the question clearly. Mention the relevant PDF filename "
            "and page when appropriate. Distinguish information from the "
            "PDF from any additional general knowledge."
        )
        used_rag = True
    else:
        system_prompt = (
            "You are a friendly technical interview tutor. "
            "Explain concepts clearly for beginners. Include definitions, "
            "key points, examples, and sample code when useful. "
            "No relevant uploaded PDF passage was retrieved, so answer "
            "using general knowledge rather than claiming to cite a PDF."
        )
        user_prompt = question
        used_rag = False

    try:
        client = Groq(api_key=GROQ_API_KEY)

        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=1200,
        )

        answer = completion.choices[0].message.content

        if not answer:
            raise HTTPException(
                status_code=502,
                detail="Groq returned an empty answer.",
            )

        return {
            "answer": answer,
            "used_rag": used_rag,
            "sources": sources,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("GROQ ERROR:", type(exc).__name__, str(exc))
        raise HTTPException(
            status_code=502,
            detail=f"AI answer generation failed: {type(exc).__name__}",
        ) from exc
