import hashlib
import os
import re
import time

from fastapi import FastAPI
from fastapi import Depends
from fastapi import Form
from fastapi import HTTPException
from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates


from sqlalchemy import Column
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

from gemini_client import refine_promise
from gemini_client import generate_updated_promise
from gemini_client import format_new_promise


CATEGORY_MAP = {
    "1": "TIME_CONSTRAINT",
    "2": "RESOURCE_LIMITATION",
    "3": "EXTERNAL_FACTORS",
    "4": "MOTIVATION_LOSS",
    "5": "UNCLEAR_GOALS",
    "6": "OVERCOMMITMENT",
    "7": "SKILL_GAP",
}

PROMISE_TYPES = {
    "self": "self",
    "others": "others",
    "other": "others",
    "world": "world",
}

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./promises.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

class Promise(Base):
    __tablename__ = "promises"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    promise_type = Column(String)
    content = Column(String)
    created_at = Column(Integer)
    deadline_at = Column(Integer)
    status = Column(String)
    hash_value = Column(String)


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def now_seconds():
    return int(time.time())


def parse_duration(value):
    text = ""
    if value:
        text = value
    text = text.strip().lower()
    if text == "":
        return None

    total = 0
    matches = re.findall(r"(\d+)\s*(h|m|s)", text)
    if not matches:
        return None

    for amount, unit in matches:
        amount = int(amount)
        if unit == "h":
            total += amount * 3600
        elif unit == "m":
            total += amount * 60
        else:
            total += amount

    if total > 0:
        return total
    return None


def format_duration(total_seconds):
    hours = total_seconds // 3600
    remaining_seconds = total_seconds % 3600
    minutes = remaining_seconds // 60
    seconds = remaining_seconds % 60
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if seconds or not parts:
        parts.append(f"{seconds}s")
    return " ".join(parts)


def parse_update(text):
    name = ""
    promise = ""
    deadline = ""
    lines_text = ""
    if text:
        lines_text = text
    for line in lines_text.splitlines():
        line = line.strip()
        if line.lower().startswith("name:"):
            name = line.split(":", 1)[1].strip()
        elif line.lower().startswith("promise:"):
            promise = line.split(":", 1)[1].strip()
        elif line.lower().startswith("deadline:"):
            deadline = line.split(":", 1)[1].strip()
    return name, promise, deadline


def parse_create(text):
    name = ""
    promise_type = ""
    promise = ""
    lines_text = ""
    if text:
        lines_text = text
    for line in lines_text.splitlines():
        line = line.strip()
        if line.lower().startswith("name:"):
            name = line.split(":", 1)[1].strip()
        elif line.lower().startswith("type:"):
            promise_type = line.split(":", 1)[1].strip().lower()
        elif line.lower().startswith("promise:"):
            promise = line.split(":", 1)[1].strip()
    return name, promise_type, promise


def hash_promise(promise_id, created_at, name, promise_type, content):
    base = f"{promise_id}|{created_at}|{name}|{promise_type}|{content}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def get_dashboard_state(db):
    now = now_seconds()
    active_promises = db.query(Promise).filter(Promise.status == "ACTIVE").all()
    for promise in active_promises:
        if promise.deadline_at <= now:
            promise.status = "MISSED"
    db.commit()

    missed_promise = db.query(Promise).filter(Promise.status == "MISSED").order_by(Promise.deadline_at.asc()).first()
    display_promises = db.query(Promise).filter(Promise.status == "ACTIVE").order_by(Promise.deadline_at.asc()).all()
    for promise in display_promises:
        time_left = promise.deadline_at - now
        if time_left < 0:
            time_left = 0
        promise.time_left = format_duration(time_left)
    return display_promises, missed_promise


@app.get("/", response_class=HTMLResponse)
def index(request: Request, db=Depends(get_db)):
    return RedirectResponse("/dashboard", status_code=302)


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request, db=Depends(get_db)):
    display_promises, missed_promise = get_dashboard_state(db)
    if missed_promise:
        return RedirectResponse("/reframe", status_code=302)

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "promises": display_promises,
            "error": "",
        }
    )


@app.get("/reframe", response_class=HTMLResponse)
def reframe_page(request: Request, db=Depends(get_db)):
    display_promises, missed_promise = get_dashboard_state(db)
    if not missed_promise:
        return RedirectResponse("/dashboard", status_code=302)
    return templates.TemplateResponse(
        "reframe.html",
        {
            "request": request,
            "promise": missed_promise,
            "solutions": "",
            "reason": "",
            "category": "",
            "error": "",
        }
    )


@app.post("/promises")
def create_promise(
    request: Request,
    raw_text: str = Form(...),
    deadline: str = Form(...),
    db=Depends(get_db),
):
    formatted = format_new_promise(raw_text)
    parsed = parse_create(formatted)
    name = parsed[0]
    promise_type = parsed[1]
    content = parsed[2]
    if promise_type not in PROMISE_TYPES.values():
        promise_type = "self"

    if not name or not promise_type or not content:
        raise HTTPException(status_code=400, detail="Failed to format promise")

    deadline_seconds = parse_duration(deadline)
    if not deadline_seconds:
        raise HTTPException(status_code=400, detail="Invalid deadline format")

    created_at = now_seconds()
    deadline_at = created_at + deadline_seconds
    hash_value = hash_promise(0, created_at, name, promise_type, content)

    promise = Promise(
        name=name,
        promise_type=promise_type,
        content=content,
        created_at=created_at,
        deadline_at=deadline_at,
        status="ACTIVE",
        hash_value=hash_value,
    )
    db.add(promise)
    db.commit()

    promise.hash_value = hash_promise(promise.id, created_at, name, promise_type, content)
    db.commit()
    return RedirectResponse("/dashboard", status_code=302)


@app.post("/promises/{promise_id}/complete")
def complete_promise(request: Request, promise_id: int, db=Depends(get_db)):
    promise = db.query(Promise).filter(Promise.id == promise_id).first()
    if promise:
        promise.status = "COMPLETED"
        db.commit()
    return RedirectResponse("/dashboard", status_code=302)


@app.post("/reframe/{promise_id}/solutions", response_class=HTMLResponse)
def generate_solutions(
    request: Request,
    promise_id: int,
    reason: str = Form(...),
    category: str = Form(...),
    db=Depends(get_db),
):
    promise = db.query(Promise).filter(Promise.id == promise_id).first()
    if not promise:
        raise HTTPException(status_code=404, detail="Promise not found")

    solutions = refine_promise(promise.content, reason, category)
    display_promises, missed_promise = get_dashboard_state(db)
    if not missed_promise or missed_promise.id != promise.id:
        missed_promise = promise

    return templates.TemplateResponse(
        "reframe.html",
        {
            "request": request,
            "promise": missed_promise,
            "solutions": solutions,
            "reason": reason,
            "category": category,
            "error": "",
        }
    )


@app.post("/reframe/{promise_id}/apply")
def apply_reframe(
    request: Request,
    promise_id: int,
    solution: str = Form(...),
    reason: str = Form(...),
    category: str = Form(...),
    db=Depends(get_db),
):
    promise = db.query(Promise).filter(Promise.id == promise_id).first()
    if not promise:
        raise HTTPException(status_code=404, detail="Promise not found")

    solution_label = "Conservative"
    if solution == "2":
        solution_label = "Moderate"
    if solution == "3":
        solution_label = "Progressive"

    update_text = generate_updated_promise(promise.content, reason, category, solution_label)
    parsed = parse_update(update_text)
    name = parsed[0]
    new_content = parsed[1]
    new_deadline = parsed[2]

    deadline_seconds = parse_duration(new_deadline)
    if not name or not new_content or not deadline_seconds:
        raise HTTPException(status_code=400, detail="Failed to parse update")

    created_at = now_seconds()
    deadline_at = created_at + deadline_seconds
    hash_value = hash_promise(0, created_at, name, promise.promise_type, new_content)

    new_promise = Promise(
        name=name,
        promise_type=promise.promise_type,
        content=new_content,
        created_at=created_at,
        deadline_at=deadline_at,
        status="ACTIVE",
        hash_value=hash_value,
    )
    db.add(new_promise)
    db.delete(promise)
    db.commit()

    new_promise.hash_value = hash_promise(new_promise.id, created_at, name, promise.promise_type, new_content)
    db.commit()
    return RedirectResponse("/dashboard", status_code=302)
