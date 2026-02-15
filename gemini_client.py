import os

from dotenv import load_dotenv
from google import genai


load_dotenv()


def _build_prompt(promise, reason, category):
    return f"""You are helping a user reframe a missed promise.

Original Promise: "{promise}"
Reason for missing: {reason}
Failure Category: {category}

Generate THREE distinct solutions to help this person succeed:

1. Conservative Solution:
- Revised promise: I promise I will ...

2. Moderate Solution:
- Revised promise: I promise I will ...

3. Progressive Solution:
- Revised promise: I promise I will ...

Rules:
- Keep the core intent of the original promise
- Be specific and actionable
- Address the {category} issue directly
- Write the revised promise as a single short sentence that starts with: I promise I will
- Output plain text only: no quotes, no markdown, no **__**, no code blocks
- Sound friendly and human
"""


def _build_update_prompt(promise, reason, category, solution_label):
    return f"""You are updating a missed promise after the user picked a solution.

Original Promise: {promise}
Reason for missing: {reason}
Failure Category: {category}
Selected Solution: {solution_label}

Return ONLY these 3 lines with no extra text:
Name: <short name, 2-6 words>
Promise: I promise I will <one short sentence>
Deadline: <duration like 30m, 1h 15m, or 2h>

Rules:
- Keep the core intent of the original promise
- Be specific and actionable
- Output plain text only: no quotes, no markdown, no **__**, no code blocks
- Sound friendly and human
"""


def _build_create_prompt(raw_text):
    return f"""You are helping format a new promise.

Raw input: {raw_text}

Return ONLY these 3 lines with no extra text:
Name: <short name, 2-6 words>
Type: <self|others|world>
Promise: I promise I will <one short sentence>

Rules:
- Keep the core intent of the raw input
- Promise must start with: I promise I will
- Output plain text only: no quotes, no markdown, no **__**, no code blocks
- Sound friendly and human
"""


def _pick_model(client):
    try:
        models = client.models.list()
    except Exception:
        return None

    for model in models:
        name = getattr(model, "name", None)
        methods = getattr(model, "supported_generation_methods", None)
        if methods and "generateContent" in methods and name:
            return name
    return None


def refine_promise(promise, reason, category):
    if not promise:
        return "Error: Promise is empty; no promise provided"

    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Error: GEMINI_API_KEY is not set"
        client = genai.Client(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL")
        if not model_name:
            model_name = _pick_model(client)
        if not model_name:
            return "Error: No model available; set GEMINI_MODEL"
        response = client.models.generate_content(
            model=model_name,
            contents=_build_prompt(promise, reason, category)
        )
        return response.text
    except Exception as exc:
        return f"Error generating refined promise: {str(exc)}"


def generate_updated_promise(promise, reason, category, solution_label):
    if not promise:
        return "Error: Promise is empty; no promise provided"

    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Error: GEMINI_API_KEY is not set"
        client = genai.Client(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL")
        if not model_name:
            model_name = _pick_model(client)
        if not model_name:
            return "Error: No model available; set GEMINI_MODEL"
        response = client.models.generate_content(
            model=model_name,
            contents=_build_update_prompt(promise, reason, category, solution_label)
        )
        return response.text
    except Exception as exc:
        return f"Error generating updated promise: {str(exc)}"


def format_new_promise(raw_text):
    if not raw_text:
        return "Error: Promise is empty; no promise provided"

    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Error: GEMINI_API_KEY is not set"
        client = genai.Client(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL")
        if not model_name:
            model_name = _pick_model(client)
        if not model_name:
            return "Error: No model available; set GEMINI_MODEL"
        response = client.models.generate_content(
            model=model_name,
            contents=_build_create_prompt(raw_text)
        )
        return response.text
    except Exception as exc:
        return f"Error formatting promise: {str(exc)}"