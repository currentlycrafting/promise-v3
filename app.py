import hashlib
import os
import re
import time

from fastapi import FastAPI, Depends, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates

from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# ── DB setup ────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./promises.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

PROMISE_TYPES = {"self": "self", "others": "others", "other": "others", "world": "world"}

# ── Models ───────────────────────────────────────────────────────────────────

class Promise(Base):
    __tablename__ = "promises"
    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String)
    promise_type = Column(String)
    content     = Column(String)
    created_at  = Column(Integer)
    deadline_at = Column(Integer)
    status      = Column(String)
    hash_value  = Column(String)
    participants = Column(String, nullable=True)

Base.metadata.create_all(bind=engine)

# ── Demo seed ────────────────────────────────────────────────────────────────

def seed_demo_data():
    db = SessionLocal()
    try:
        # Wipe all existing rows for a clean demo slate
        db.query(Promise).delete()
        db.commit()

        # Seed fresh demo promises
        now = int(time.time())
        demos = [
            ("Morning Run",          "self",   "I promise I will run 3 times a week",                          30, None),
            ("Read Daily",           "self",   "I promise I will read 20 minutes every night",                 21, None),
            ("Call Home",            "others", "I promise I will call my family every Sunday",                   7, None),
            ("Check In Weekly",      "others", "I promise I will check in with a friend every week",            14, None),
            ("Food Bank Volunteer",  "world",  "I promise I will volunteer at the food bank twice this month",  28, None),
            ("Plastic Free Week",    "world",  "I promise I will go plastic-free for 7 days",                    7, None),
            ("Gym with Khalid",      "others", "I promise I will go to the gym with Khalid every week",         21, "Khalid"),
        ]
        for name, ptype, content, days, participants in demos:
            created = now
            deadline = now + days * 86400
            p = Promise(
                name=name, promise_type=ptype, content=content,
                created_at=created, deadline_at=deadline, status="ACTIVE",
                hash_value=hashlib.sha256(f"0|{created}|{name}|{ptype}|{content}".encode()).hexdigest(),
                participants=participants,
            )
            db.add(p)
        db.commit()
    finally:
        db.close()

seed_demo_data()

# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI()

# Allow the Vite dev server (port 5173) to call FastAPI (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ── Helpers ──────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def now_seconds():
    return int(time.time())

def parse_duration(value: str | None):
    text = (value or "").strip().lower()
    if not text:
        return None
    matches = re.findall(r"(\d+)\s*(d|h|m|s)", text)
    if not matches:
        return None
    total = sum(
        int(a) * (86400 if u == "d" else 3600 if u == "h" else 60 if u == "m" else 1)
        for a, u in matches
    )
    return total or None

def format_duration(total_seconds: int) -> str:
    h, rem = divmod(total_seconds, 3600)
    m, s   = divmod(rem, 60)
    parts  = []
    if h: parts.append(f"{h}h")
    if m: parts.append(f"{m}m")
    if s or not parts: parts.append(f"{s}s")
    return " ".join(parts)

def hash_promise(promise_id, created_at, name, promise_type, content):
    base = f"{promise_id}|{created_at}|{name}|{promise_type}|{content}"
    return hashlib.sha256(base.encode()).hexdigest()

def get_dashboard_state(db):
    now = now_seconds()
    for p in db.query(Promise).filter(Promise.status == "ACTIVE").all():
        if p.deadline_at <= now:
            p.status = "MISSED"
    db.commit()
    missed  = db.query(Promise).filter(Promise.status == "MISSED").order_by(Promise.deadline_at).first()
    active  = db.query(Promise).filter(Promise.status == "ACTIVE").order_by(Promise.deadline_at).all()
    for p in active:
        tl = max(p.deadline_at - now, 0)
        p.time_left = format_duration(tl)
    return active, missed

# ── Pages (keep for legacy / Jinja2 dashboard) ───────────────────────────────

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return RedirectResponse("/dashboard", status_code=302)

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db=Depends(get_db)):
    display, missed = get_dashboard_state(db)
    if missed:
        return RedirectResponse("/reframe", status_code=302)
    return templates.TemplateResponse("dashboard.html", {
        "request": request, "promises": display, "error": ""
    })

@app.get("/reframe", response_class=HTMLResponse)
def reframe_page(request: Request, db=Depends(get_db)):
    display, missed = get_dashboard_state(db)
    if not missed:
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse("reframe.html", {
        "request": request, "promise": missed,
        "solutions": "", "reason": "", "category": "", "error": ""
    })

# ── JSON API (called by the Vite frontend) ────────────────────────────────────

@app.get("/api/promises")
def api_list_promises(db=Depends(get_db)):
    active, missed = get_dashboard_state(db)
    return {
        "promises": [
            {
                "id": p.id, "name": p.name, "content": p.content,
                "promise_type": p.promise_type, "status": p.status,
                "deadline_at": p.deadline_at,
                "time_left": getattr(p, "time_left", ""),
                "participants": p.participants,
            }
            for p in active
        ],
        "missed": {
            "id": missed.id, "name": missed.name, "content": missed.content,
            "promise_type": missed.promise_type, "status": missed.status,
            "deadline_at": missed.deadline_at,
            "participants": missed.participants,
        } if missed else None,
    }

@app.get("/api/promises/{promise_id}")
def api_get_promise(promise_id: int, db=Depends(get_db)):
    p = db.query(Promise).filter(Promise.id == promise_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "id": p.id, "name": p.name, "content": p.content,
        "promise_type": p.promise_type, "status": p.status,
        "deadline_at": p.deadline_at,
        "participants": p.participants,
    }

@app.post("/api/promises")
def api_create_promise(
    name: str = Form(...),
    promise_type: str = Form(...),
    content: str = Form(...),
    deadline: str = Form(...),
    db=Depends(get_db),
):
    """
    The frontend now handles LLM formatting via RunAnywhere.
    It sends already-structured fields (name, type, content) here.
    """
    if promise_type not in PROMISE_TYPES.values():
        promise_type = "self"

    deadline_seconds = parse_duration(deadline)
    if not deadline_seconds:
        raise HTTPException(status_code=400, detail="Invalid deadline format e.g. 1h 30m")

    created_at = now_seconds()
    deadline_at = created_at + deadline_seconds

    p = Promise(
        name=name, promise_type=promise_type, content=content,
        created_at=created_at, deadline_at=deadline_at,
        status="ACTIVE",
        hash_value=hash_promise(0, created_at, name, promise_type, content),
    )
    db.add(p); db.commit()
    p.hash_value = hash_promise(p.id, created_at, name, promise_type, content)
    db.commit()
    return {"id": p.id, "status": "created"}

@app.post("/api/promises/{promise_id}/complete")
def api_complete_promise(promise_id: int, db=Depends(get_db)):
    p = db.query(Promise).filter(Promise.id == promise_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    p.status = "COMPLETED"
    db.commit()
    return {"status": "completed"}

@app.post("/api/promises/{promise_id}/forfeit")
def api_forfeit_promise(promise_id: int, db=Depends(get_db)):
    p = db.query(Promise).filter(Promise.id == promise_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    p.status = "MISSED"
    db.commit()
    return {"status": "missed"}

@app.post("/api/reframe/{promise_id}/apply")
def api_apply_reframe(
    promise_id: int,
    name: str = Form(...),
    content: str = Form(...),
    deadline: str = Form(...),
    db=Depends(get_db),
):
    """
    Frontend calls RunAnywhere to generate + let user pick a solution,
    then sends the chosen structured fields here to save.
    """
    promise = db.query(Promise).filter(Promise.id == promise_id).first()
    if not promise:
        raise HTTPException(status_code=404, detail="Not found")

    deadline_seconds = parse_duration(deadline)
    if not deadline_seconds:
        raise HTTPException(status_code=400, detail="Invalid deadline")

    created_at  = now_seconds()
    deadline_at = created_at + deadline_seconds

    new_p = Promise(
        name=name, promise_type=promise.promise_type, content=content,
        created_at=created_at, deadline_at=deadline_at,
        status="ACTIVE",
        hash_value=hash_promise(0, created_at, name, promise.promise_type, content),
    )
    db.add(new_p)
    db.delete(promise)
    db.commit()
    new_p.hash_value = hash_promise(new_p.id, created_at, name, promise.promise_type, content)
    db.commit()
    return {"id": new_p.id, "status": "reframed"}
